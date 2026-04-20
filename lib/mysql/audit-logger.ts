import fs from 'fs'
import path from 'path'

const LOG_PATH = path.resolve(process.cwd(), '.mysql-audit.log')

export function auditLog(sql: string, params: unknown[]): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    sql: sql.slice(0, 200),
    params,
  })
  try {
    fs.appendFileSync(LOG_PATH, entry + '\n')
  } catch {
    // non-fatal — audit log failure must not break queries
  }
}
