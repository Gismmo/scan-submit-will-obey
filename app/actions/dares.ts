"use server"

import { applyLike, setCompleted, type DareState } from "@/lib/db"
import { revalidatePath } from "next/cache"

export type DareActionInput = {
  id: string
  text: string
  submittedAt: string | null
}

export async function likeDare(
  input: DareActionInput & { liked: boolean },
): Promise<DareState> {
  const state = await applyLike(input.id, input.text, input.submittedAt, input.liked ? 1 : -1)
  revalidatePath("/results")
  return state
}

export async function completeDare(
  input: DareActionInput & { completed: boolean },
): Promise<DareState> {
  const state = await setCompleted(input.id, input.text, input.submittedAt, input.completed)
  revalidatePath("/results")
  return state
}
