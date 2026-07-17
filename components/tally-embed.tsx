"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void }
  }
}

const TALLY_SCRIPT = "https://tally.so/widgets/embed.js"

export function TallyEmbed({ formId }: { formId: string }) {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load Tally's embed script so the iframe auto-resizes to its content.
  useEffect(() => {
    const loadEmbeds = () => window.Tally?.loadEmbeds()

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TALLY_SCRIPT}"]`)
    if (existing) {
      loadEmbeds()
      return
    }

    const script = document.createElement("script")
    script.src = TALLY_SCRIPT
    script.async = true
    script.onload = loadEmbeds
    document.body.appendChild(script)
  }, [])

  // Listen for the form submission event emitted by the embedded Tally iframe.
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return
      if (!e.data.includes("Tally.FormSubmitted")) return

      setRedirecting(true)
      // Give Tally a moment to persist the submission before we read the API.
      setTimeout(() => {
        router.push("/results")
      }, 1200)
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [router])

  const src = `https://tally.so/embed/${formId}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`

  return (
    <div className="relative w-full">
      {!loaded && !redirecting && (
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="ml-2 text-sm text-muted-foreground">Loading form…</span>
        </div>
      )}

      {redirecting && (
        <div
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card"
          role="status"
        >
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Thanks! Taking you to the results…</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={src}
        title="Rate the Stag feedback form"
        loading="lazy"
        width="100%"
        height="500"
        onLoad={() => setLoaded(true)}
        className={redirecting ? "hidden" : loaded ? "block w-full" : "invisible absolute"}
      />
    </div>
  )
}
