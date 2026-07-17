import "server-only"

const TALLY_API = "https://api.tally.so"

export type TallyOption = { id: string; text: string }

export type TallyQuestion = {
  id: string
  type: string
  title: string
  options: TallyOption[]
}

export type TallyResponse = {
  questionId: string
  answer: unknown
}

export type TallySubmission = {
  id: string
  submittedAt: string | null
  isCompleted: boolean
  responses: TallyResponse[]
}

export type TallyData = {
  questions: TallyQuestion[]
  submissions: TallySubmission[]
}

// The kind of chart/summary we render for a given question.
export type AggregateKind = "choice" | "rating" | "numeric" | "text"

export type ChoiceDatum = { label: string; count: number }

export type QuestionAggregate = {
  id: string
  title: string
  type: string
  kind: AggregateKind
  answered: number
  // choice / rating
  distribution: ChoiceDatum[]
  // rating / numeric
  average: number | null
  min: number | null
  max: number | null
  // text
  textAnswers: string[]
}

export type ResultsSummary = {
  totalSubmissions: number
  completedSubmissions: number
  questionCount: number
  lastSubmittedAt: string | null
  aggregates: QuestionAggregate[]
}

const CHOICE_TYPES = new Set([
  "MULTIPLE_CHOICE",
  "MULTIPLE_CHOICE_OPTION",
  "CHECKBOXES",
  "CHECKBOX",
  "DROPDOWN",
  "MULTI_SELECT",
  "MULTI_SELECT_OPTION",
  "RANKING",
])

const RATING_TYPES = new Set(["RATING", "LINEAR_SCALE", "NPS"])

const NUMERIC_TYPES = new Set(["INPUT_NUMBER"])

function kindForType(type: string): AggregateKind {
  const t = type.toUpperCase()
  if (RATING_TYPES.has(t)) return "rating"
  if (CHOICE_TYPES.has(t)) return "choice"
  if (NUMERIC_TYPES.has(t)) return "numeric"
  return "text"
}

// Options can live in different places across Tally form configurations.
// Search the raw question object for any array of { id, text } shapes.
function extractOptions(raw: any): TallyOption[] {
  const found: TallyOption[] = []
  const seen = new Set<string>()

  const collect = (arr: any[]) => {
    for (const item of arr) {
      if (item && typeof item === "object" && "id" in item && ("text" in item || "label" in item)) {
        const id = String(item.id)
        const text = String(item.text ?? item.label ?? "")
        if (!seen.has(id) && text) {
          seen.add(id)
          found.push({ id, text })
        }
      }
    }
  }

  const walk = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 4) return
    if (Array.isArray(node.options)) collect(node.options)
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (Array.isArray(value)) {
        value.forEach((v) => walk(v, depth + 1))
      } else if (value && typeof value === "object") {
        walk(value, depth + 1)
      }
    }
  }

  walk(raw, 0)
  return found
}

export function getFormId(): string {
  const id = process.env.TALLY_FORM_ID
  if (!id) throw new Error("TALLY_FORM_ID is not set")
  return id
}

export async function fetchTallyData(): Promise<TallyData> {
  const apiKey = process.env.TALLY_API_KEY
  const formId = process.env.TALLY_FORM_ID
  if (!apiKey || !formId) {
    throw new Error("Missing TALLY_API_KEY or TALLY_FORM_ID environment variable")
  }

  const questions: TallyQuestion[] = []
  const submissions: TallySubmission[] = []
  let page = 1
  let hasMore = true

  while (hasMore && page <= 50) {
    const res = await fetch(
      `${TALLY_API}/forms/${formId}/submissions?page=${page}&limit=100&filter=completed`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        // Live data — don't cache aggressively.
        cache: "no-store",
      },
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Tally API error ${res.status}: ${body.slice(0, 300)}`)
    }

    const data: any = await res.json()

    if (page === 1 && Array.isArray(data.questions)) {
      for (const q of data.questions) {
        questions.push({
          id: String(q.id),
          type: String(q.type ?? "UNKNOWN"),
          title: String(q.title ?? "Untitled question"),
          options: extractOptions(q),
        })
      }
    }

    for (const s of data.submissions ?? []) {
      submissions.push({
        id: String(s.id),
        submittedAt: s.submittedAt ?? null,
        isCompleted: Boolean(s.isCompleted ?? true),
        responses: (s.responses ?? []).map((r: any) => ({
          questionId: String(r.questionId),
          answer: r.answer,
        })),
      })
    }

    hasMore = Boolean(data.hasMore)
    page += 1
  }

  return { questions, submissions }
}

// Turn a raw answer + option map into an array of display labels.
function answerToLabels(answer: unknown, optionMap: Map<string, string>): string[] {
  if (answer == null) return []

  const mapOne = (v: unknown): string | null => {
    if (v == null) return null
    if (typeof v === "object") {
      const obj = v as any
      if ("text" in obj) return String(obj.text)
      if ("label" in obj) return String(obj.label)
      if ("id" in obj) return optionMap.get(String(obj.id)) ?? String(obj.id)
      return null
    }
    const str = String(v)
    return optionMap.get(str) ?? str
  }

  if (Array.isArray(answer)) {
    return answer.map(mapOne).filter((x): x is string => x != null && x !== "")
  }
  const single = mapOne(answer)
  return single != null && single !== "" ? [single] : []
}

function answerToNumber(answer: unknown): number | null {
  if (typeof answer === "number") return answer
  if (typeof answer === "string" && answer.trim() !== "" && !Number.isNaN(Number(answer))) {
    return Number(answer)
  }
  if (Array.isArray(answer) && answer.length === 1) return answerToNumber(answer[0])
  return null
}

export type DareEntry = { id: string; text: string; submittedAt: string | null }
export type DareSection = { questionId: string; title: string; entries: DareEntry[] }

// Pull individual free-text answers (e.g. dare suggestions) with their
// originating submission id so each one can be tracked (liked / completed).
export function extractDares(data: TallyData): DareSection[] {
  const sections: DareSection[] = []

  for (const q of data.questions) {
    if (kindForType(q.type) !== "text") continue
    const optionMap = new Map(q.options.map((o) => [o.id, o.text]))
    const entries: DareEntry[] = []

    for (const s of data.submissions) {
      const r = s.responses.find((x) => x.questionId === q.id)
      if (!r) continue
      const text = answerToLabels(r.answer, optionMap).join(", ").trim()
      if (text) entries.push({ id: `${s.id}__${q.id}`, text, submittedAt: s.submittedAt })
    }

    sections.push({ questionId: q.id, title: q.title, entries })
  }

  return sections
}

export function aggregate(data: TallyData): ResultsSummary {
  const { questions, submissions } = data

  // Index responses by question id.
  const byQuestion = new Map<string, unknown[]>()
  for (const q of questions) byQuestion.set(q.id, [])
  for (const s of submissions) {
    for (const r of s.responses) {
      if (!byQuestion.has(r.questionId)) byQuestion.set(r.questionId, [])
      byQuestion.get(r.questionId)!.push(r.answer)
    }
  }

  const aggregates: QuestionAggregate[] = questions.map((q) => {
    const answers = byQuestion.get(q.id) ?? []
    const kind = kindForType(q.type)
    const optionMap = new Map(q.options.map((o) => [o.id, o.text]))

    const agg: QuestionAggregate = {
      id: q.id,
      title: q.title,
      type: q.type,
      kind,
      answered: 0,
      distribution: [],
      average: null,
      min: null,
      max: null,
      textAnswers: [],
    }

    if (kind === "choice") {
      const counts = new Map<string, number>()
      // Seed known options so 0-count options still show.
      for (const o of q.options) counts.set(o.text, 0)
      let answered = 0
      for (const a of answers) {
        const labels = answerToLabels(a, optionMap)
        if (labels.length > 0) answered += 1
        for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
      }
      agg.answered = answered
      agg.distribution = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
    } else if (kind === "rating" || kind === "numeric") {
      const nums: number[] = []
      for (const a of answers) {
        const n = answerToNumber(a)
        if (n != null) nums.push(n)
      }
      agg.answered = nums.length
      if (nums.length > 0) {
        agg.average = nums.reduce((s, n) => s + n, 0) / nums.length
        agg.min = Math.min(...nums)
        agg.max = Math.max(...nums)
        // Distribution across the observed integer scale.
        const scaleMin = Math.min(agg.min, kind === "rating" ? 1 : agg.min)
        const scaleMax = Math.max(agg.max, kind === "rating" ? 5 : agg.max)
        const counts = new Map<number, number>()
        for (let i = scaleMin; i <= scaleMax; i++) counts.set(i, 0)
        for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1)
        agg.distribution = Array.from(counts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([value, count]) => ({ label: String(value), count }))
      }
    } else {
      const texts: string[] = []
      for (const a of answers) {
        const labels = answerToLabels(a, optionMap)
        for (const label of labels) {
          const trimmed = label.trim()
          if (trimmed) texts.push(trimmed)
        }
      }
      agg.answered = texts.length
      agg.textAnswers = texts
    }

    return agg
  })

  const lastSubmittedAt = submissions.reduce<string | null>((latest, s) => {
    if (!s.submittedAt) return latest
    if (!latest || s.submittedAt > latest) return s.submittedAt
    return latest
  }, null)

  return {
    totalSubmissions: submissions.length,
    completedSubmissions: submissions.filter((s) => s.isCompleted).length,
    questionCount: questions.length,
    lastSubmittedAt,
    aggregates,
  }
}
