import { appendFileSync } from 'fs'
import { join } from 'path'

const LOG_PATH = join(process.cwd(), '.mysql-audit.log')

export function logQuery(sql: string, durationMs: number): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    sql,
    duration_ms: durationMs,
  })
  try {
    appendFileSync(LOG_PATH, entry + '\n')
  } catch {
    // Audit log write failure must never crash the app
  }
}
