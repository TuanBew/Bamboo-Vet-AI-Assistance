import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

const globalForMySQL = globalThis as unknown as { mysqlPool?: Pool }

export function getPool(): Pool {
  if (!globalForMySQL.mysqlPool) {
    const host = process.env.MYSQL_HOST
    if (!host) throw new Error('MYSQL_HOST is not set')

    globalForMySQL.mysqlPool = mysql.createPool({
      host,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      connectionLimit: 5,
      connectTimeout: 10_000,
      // Kill queries that run longer than 30s to prevent server hangs
      timeout: 30_000,
      ssl: process.env.MYSQL_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
    })
  }
  return globalForMySQL.mysqlPool
}
