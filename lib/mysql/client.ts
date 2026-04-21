import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from './pool'
import { validateQuery } from './validator'
import { logQuery } from './audit-logger'

export async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  validateQuery(sql)
  const start = performance.now()
  const conn = await getPool().getConnection()
  try {
    const [rows] = await conn.query<RowDataPacket[]>(sql, params as never)
    logQuery(sql, Math.round(performance.now() - start))
    return rows as T[]
  } finally {
    conn.release()
  }
}

export async function callSp<T>(name: string, params: unknown[]): Promise<T[]> {
  const placeholders = params.length > 0 ? params.map(() => '?').join(',') : ''
  const sql = placeholders ? `CALL ${name}(${placeholders})` : `CALL ${name}()`
  validateQuery(sql)
  const start = performance.now()
  const conn = await getPool().getConnection()
  try {
    const [raw] = await conn.query(sql, params as never)
    logQuery(sql, Math.round(performance.now() - start))
    if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
      return raw[0] as T[]
    }
    return []
  } finally {
    conn.release()
  }
}
