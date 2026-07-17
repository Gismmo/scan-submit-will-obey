import Link from "next/link"
import { ArrowLeft, Users, Star, Inbox } from "lucide-react"
import {
  fetchTallyData,
  aggregate,
  extractDares,
  buildSubmissionsTable,
  type QuestionAggregate,
  type SubmissionsTable as SubmissionsTableData,
} from "@/lib/tally"
import { getDaresMap } from "@/lib/db"
import { DareBoard } from "@/components/results/dare-board"
import { RefreshButton } from "@/components/results/refresh-button"
import { Card, CardContent } from "@/components/ui/card"

export const dynamic = "force-dynamic"

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact per-question rating: just the average, no distribution chart.
function RatingStatCard({ agg }: { agg: QuestionAggregate }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <p className="text-pretty text-sm font-medium leading-snug text-muted-foreground">
          {agg.title}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold text-foreground">
            {agg.average != null ? agg.average.toFixed(1) : "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            avg · {agg.answered} {agg.answered === 1 ? "reply" : "replies"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Full raw table: every submission as a row, every question as a column.
function SubmissionsTable({ table }: { table: SubmissionsTableData }) {
  return (
    <div>
      <h2 className="mb-3 font-display text-xl font-semibold text-foreground">All submissions</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left">
              <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                Submitted
              </th>
              {table.columns.map((col) => (
                <th
                  key={col.id}
                  className="min-w-40 px-4 py-3 font-semibold text-foreground"
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                  {formatWhen(row.submittedAt)}
                </td>
                {table.columns.map((col) => (
                  <td key={col.id} className="px-4 py-3 align-top text-foreground">
                    {row.cells[col.id] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function ResultsContent() {
  const data = await fetchTallyData()
  const summary = aggregate(data)

  const ratingAggs = summary.aggregates.filter((a) => a.kind === "rating" && a.average != null)
  const overallAverage =
    ratingAggs.length > 0
      ? ratingAggs.reduce((s, a) => s + (a.average ?? 0), 0) / ratingAggs.length
      : null

  // Only the dare-suggestion question becomes an interactive board; other
  // free-text questions (e.g. "What is your name?") aren't likeable dares.
  const isDareQuestion = (title: string) => /\b(dare|challenge|task)\b/i.test(title)

  // Dare suggestions with shared like counts + completion status from the DB.
  const dareSections = extractDares(data).filter((s) => isDareQuestion(s.title))
  const dareIds = dareSections.flatMap((s) => s.entries.map((e) => e.id))
  const stateMap = await getDaresMap(dareIds)

  // Merge each dare entry with its stored like count / completion status.
  const dareBoards = dareSections
    .filter((section) => section.entries.length > 0)
    .map((section) => ({
      title: section.title,
      dares: section.entries.map((entry) => {
        const state = stateMap.get(entry.id)
        return {
          id: entry.id,
          text: entry.text,
          submittedAt: entry.submittedAt,
          likes: state?.likes ?? 0,
          completed: state?.completed ?? false,
        }
      }),
    }))

  // Compact rating cards for each rating question (no distribution charts).
  const ratingCards = summary.aggregates.filter((a) => a.kind === "rating")

  // Raw table of every submission with all field values.
  const submissionsTable = buildSubmissionsTable(data)

  if (summary.totalSubmissions === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
          <Inbox className="size-6" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-foreground">No responses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to rate the stag — results appear here in real time.
          </p>
        </div>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Fill out the form
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {dareBoards.map((board) => (
        <DareBoard key={board.title} title={board.title} dares={board.dares} />
      ))}

      <hr className="border-border" />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Users className="size-5" aria-hidden="true" />}
          label="Total submissions"
          value={String(summary.totalSubmissions)}
        />
        <StatCard
          icon={<Star className="size-5" aria-hidden="true" />}
          label="Overall rating"
          value={overallAverage != null ? overallAverage.toFixed(1) : "—"}
        />
      </div>

      {ratingCards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ratingCards.map((agg) => (
            <RatingStatCard key={agg.id} agg={agg} />
          ))}
        </div>
      )}

      <SubmissionsTable table={submissionsTable} />
    </div>
  )
}

export default async function ResultsPage() {
  let content: React.ReactNode
  try {
    content = await ResultsContent()
  } catch (err) {
    content = (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
        <p className="font-display text-lg font-semibold text-foreground">
          Couldn&apos;t load results
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {err instanceof Error ? err.message : "Please try refreshing in a moment."}
        </p>
      </div>
    )
  }

  return (
    <main className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to form
          </Link>
          <RefreshButton />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <div className="mb-8">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Live results
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            Aggregated feedback from everyone who has rated the stag so far.
          </p>
        </div>
        {content}
      </section>
    </main>
  )
}
