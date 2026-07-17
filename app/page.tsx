import Link from "next/link"
import { BarChart3, ArrowRight } from "lucide-react"
import { TallyEmbed } from "@/components/tally-embed"
import { getFormId } from "@/lib/tally"

export default function HomePage() {
  const formId = getFormId()

  return (
    <main className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Scan. Submit. WILL OBEY
          </span>
          <Link
            href="/results"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <BarChart3 className="size-4" aria-hidden="true" />
            Live results
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div className="lg:sticky lg:top-16">
            <h1 className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
              Scan. Submit.{" "}
              <span className="block text-[52px] leading-none">Will OBEY</span>
            </h1>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              Rate his appearance, drunkenness, and enthusiasm, then suggest a dare to keep things
              interesting.
            </p>
            <Link
              href="/results"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Skip to the results
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              or VOTE for the next challenge
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
            <TallyEmbed formId={formId} />
          </div>
        </div>
      </section>
    </main>
  )
}
