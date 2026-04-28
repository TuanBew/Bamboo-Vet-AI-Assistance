import { appendFileSync } from 'fs'
import { join } from 'path'

const LOG_PATH = join(process.cwd(), '.mysql-audit.log')

export function logQuery(sql: string, durationMs: number): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    sql,
    duration_ms: durationMs,
  })
  // Vercel's filesystem is read-only — use console.log instead (captured in function logs)
  if (process.env.VERCEL) {
    console.log('[mysql-audit]', entry)
    return
  }
  try {
    appendFileSync(LOG_PATH, entry + '\n')
  } catch {
    // Audit log write failure must never crash the app
  }
}
