"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
      disabled={isPending}
    >
      <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
      {isPending ? "Refreshing…" : "Refresh"}
    </button>
  )
}
