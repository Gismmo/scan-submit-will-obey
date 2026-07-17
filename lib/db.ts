import "server-only"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export type DareState = { likes: number; completed: boolean }

// Fetch stored like counts / completion status for a set of dare ids.
export async function getDaresMap(ids: string[]): Promise<Map<string, DareState>> {
  const map = new Map<string, DareState>()
  if (ids.length === 0) return map

  const rows = (await sql`
    SELECT submission_id, likes, completed
    FROM dares
    WHERE submission_id = ANY(${ids})
  `) as { submission_id: string; likes: number; completed: boolean }[]

  for (const r of rows) {
    map.set(r.submission_id, { likes: Number(r.likes), completed: r.completed })
  }
  return map
}

// Make sure a row exists before we mutate it.
async function upsertDare(id: string, dareText: string, submittedAt: string | null) {
  await sql`
    INSERT INTO dares (submission_id, dare_text, submitted_at)
    VALUES (${id}, ${dareText}, ${submittedAt})
    ON CONFLICT (submission_id) DO UPDATE SET dare_text = EXCLUDED.dare_text
  `
}

export async function applyLike(
  id: string,
  dareText: string,
  submittedAt: string | null,
  delta: number,
): Promise<DareState> {
  await upsertDare(id, dareText, submittedAt)
  const rows = (await sql`
    UPDATE dares
    SET likes = GREATEST(0, likes + ${delta})
    WHERE submission_id = ${id}
    RETURNING likes, completed
  `) as { likes: number; completed: boolean }[]
  const r = rows[0]
  return { likes: Number(r.likes), completed: r.completed }
}

export async function setCompleted(
  id: string,
  dareText: string,
  submittedAt: string | null,
  completed: boolean,
): Promise<DareState> {
  await upsertDare(id, dareText, submittedAt)
  const rows = (await sql`
    UPDATE dares
    SET completed = ${completed}
    WHERE submission_id = ${id}
    RETURNING likes, completed
  `) as { likes: number; completed: boolean }[]
  const r = rows[0]
  return { likes: Number(r.likes), completed: r.completed }
}
