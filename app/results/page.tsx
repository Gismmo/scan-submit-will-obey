import Link from "next/link"
import { ArrowLeft, Users, Star, Inbox } from "lucide-react"
import { fetchTallyData, aggregate, extractDares, type QuestionAggregate } from "@/lib/tally"
import { getDaresMap } from "@/lib/db"
import { QuestionChart } from "@/components/results/question-chart"
import { DareBoard } from "@/components/results/dare-board"
import { RefreshButton } from "@/components/results/refresh-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

function QuestionCard({ agg }: { agg: QuestionAggregate }) {
  const isText = agg.kind === "text"
  const isRating = agg.kind === "rating"

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-pretty text-base font-semibold leading-snug">
            {agg.title}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {agg.answered} {agg.answered === 1 ? "reply" : "replies"}
          </Badge>
        </div>
        {isRating && agg.average != null && (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground">
              {agg.average.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              average · range {agg.min}–{agg.max}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {agg.answered === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No responses yet.</p>
        ) : isText ? (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {agg.textAnswers.map((text, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm leading-relaxed text-foreground"
              >
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <QuestionChart data={agg.distribution} horizontal={agg.kind === "choice"} />
        )}
      </CardContent>
    </Card>
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

  // Dare suggestions with shared like counts + completion status from the DB.
  const dareSections = extractDares(data)
  const dareIds = dareSections.flatMap((s) => s.entries.map((e) => e.id))
  const stateMap = await getDaresMap(dareIds)

  // Charts only cover non-text questions; dares get their own board.
  const chartAggs = summary.aggregates.filter((a) => a.kind !== "text")

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <StatCard
          icon={<MessageSquareText className="size-5" aria-hidden="true" />}
          label="Written replies"
          value={String(textReplies)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {summary.aggregates.map((agg) => (
          <QuestionCard key={agg.id} agg={agg} />
        ))}
      </div>
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
