"use client"

import { useEffect, useState, useTransition } from "react"
import { Heart, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { likeDare, completeDare } from "@/app/actions/dares"

export type DareItem = {
  id: string
  text: string
  submittedAt: string | null
  likes: number
  completed: boolean
}

const LIKED_KEY = "liked-dares"

function readLikedSet(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(LIKED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeLikedSet(set: Set<string>) {
  try {
    window.localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // ignore storage failures
  }
}

function DareRow({ dare }: { dare: DareItem }) {
  const [likes, setLikes] = useState(dare.likes)
  const [completed, setCompleted] = useState(dare.completed)
  const [liked, setLiked] = useState(false)
  const [isPending, start] = useTransition()

  // Sync liked state from localStorage on mount.
  useEffect(() => {
    setLiked(readLikedSet().has(dare.id))
  }, [dare.id])

  function toggleLike() {
    const nextLiked = !liked
    // Optimistic update.
    setLiked(nextLiked)
    setLikes((n) => Math.max(0, n + (nextLiked ? 1 : -1)))

    const set = readLikedSet()
    if (nextLiked) set.add(dare.id)
    else set.delete(dare.id)
    writeLikedSet(set)

    start(async () => {
      const state = await likeDare({
        id: dare.id,
        text: dare.text,
        submittedAt: dare.submittedAt,
        liked: nextLiked,
      })
      setLikes(state.likes)
      setCompleted(state.completed)
    })
  }

  function toggleCompleted(next: boolean) {
    setCompleted(next)
    start(async () => {
      const state = await completeDare({
        id: dare.id,
        text: dare.text,
        submittedAt: dare.submittedAt,
        completed: next,
      })
      setLikes(state.likes)
      setCompleted(state.completed)
    })
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        completed && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        {completed && (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        )}
        <p
          className={cn(
            "text-pretty leading-relaxed text-foreground",
            completed && "text-muted-foreground line-through",
          )}
        >
          {dare.text}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleLike}
          disabled={isPending}
          aria-pressed={liked}
          aria-label={liked ? "Remove your like" : "Like this dare"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
            liked
              ? "border-accent bg-accent/15 text-accent-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("size-4", liked && "fill-current")} aria-hidden="true" />
          {likes}
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
          <Checkbox
            checked={completed}
            onCheckedChange={(v) => toggleCompleted(v === true)}
            disabled={isPending}
            aria-label="Mark dare as completed"
          />
          Done
        </label>
      </div>
    </li>
  )
}

export function DareBoard({ title, dares }: { title: string; dares: DareItem[] }) {
  // Most-liked first, then completed sink to the bottom.
  const sorted = [...dares].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return b.likes - a.likes
  })

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-pretty text-lg font-semibold leading-snug">
            {title}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {dares.length} {dares.length === 1 ? "idea" : "ideas"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {dares.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No dares suggested yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map((dare) => (
              <DareRow key={dare.id} dare={dare} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
