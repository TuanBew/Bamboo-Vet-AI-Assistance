# MySQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all admin dashboard Supabase data queries with MySQL client calls to the corporate database, while keeping Supabase Auth and Product A (chatbot) completely untouched.

**Architecture:** Foundation-first incremental migration. Build `lib/mysql/` safety layer (validator, pool, client, audit-logger) with exhaustive tests, then migrate service files one-at-a-time from cheapest to most complex. Each service file is verified via dev server before proceeding to the next.

**Tech Stack:** mysql2/promise, Vitest (unit tests), Playwright (E2E), Next.js unstable_cache

**Spec:** `docs/superpowers/specs/2026-04-18-mysql-migration-design.md`

**Branch:** `feature/mysql-migration` (git worktree at `../bamboo-mysql-migration/`)

**SAFETY:** The target MySQL database is LIVE PRODUCTION. All code MUST go through `lib/mysql/validator.ts`. Only SELECT/SHOW/DESCRIBE/EXPLAIN/CALL are permitted. If uncertain, STOP and ask.

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `lib/mysql/validator.ts` | SQL safety gate — rejects any non-SELECT/CALL query |
| `lib/mysql/audit-logger.ts` | Append-only query log (`.mysql-audit.log`) |
| `lib/mysql/pool.ts` | Connection pool singleton (5 connections, read-only sessions) |
| `lib/mysql/client.ts` | Public API: `query<T>()` and `callSp<T>()` |
| `lib/mysql/__tests__/validator.test.ts` | ~40 validator test cases |
| `lib/mysql/__tests__/client.test.ts` | Client unit tests (mocked pool) |
| `scripts/test-mysql-connection.ts` | One-shot connection verifier (never imported by app) |

### Files to modify

| File | Change |
|------|--------|
| `.env.example` | Add MySQL placeholder env vars |
| `.gitignore` | Add `.mysql-audit.log` |
| `lib/admin/services/npp-options.ts` | Replace Supabase `.from()` with `query()` |
| `lib/admin/services/dpur-geo.ts` | Replace Supabase `.from()` with `query()` |
| `lib/admin/services/ton-kho.ts` | Replace Supabase RPCs with `callSp()` |
| `lib/admin/services/nhap-hang.ts` | Replace Supabase `.from()` with `query()` |
| `lib/admin/services/khach-hang.ts` | Replace Supabase RPCs with `callSp()` |
| `lib/admin/services/check-distributor.ts` | Replace Supabase RPCs with `callSp()` |
| `lib/admin/services/check-customers.ts` | Replace Supabase RPCs with `callSp()` |
| `app/api/ai-analysis/route.ts` | Replace Supabase RPCs with `callSp()` |
| `lib/admin/services/dashboard.ts` | Replace all Supabase calls with `query()` + `callSp()` |
| `app/admin/settings/page.tsx` | Replace `mv_dashboard_kpis` query with MySQL `query()` |
| `app/admin/_actions/refresh-views.ts` | Convert to no-op (return success immediately) |

### Files NOT touched (frozen)

| File | Reason |
|------|--------|
| `app/api/chat/route.ts` | Product A — frozen |
| `app/api/conversations/**` | Product A — frozen |
| `app/app/**` | Product A — frozen |
| `lib/supabase/*` | Auth layer — untouched |
| `lib/admin/auth.ts` | Auth guard — untouched |
| `scripts/seed*.ts` | Dev-only Supabase tools |

---

## Migration Pattern Reference

Every service file follows this pattern. Reference this when reading Tasks 6-15.

**Import replacement:**
```ts
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { query, callSp } from '@/lib/mysql/client'
```

**RPC replacement:**
```ts
// LEGACY SUPABASE: const { data, error } = await db.rpc('sp_name', { p_npp: filters.npp, p_year: filters.year })
// LEGACY SUPABASE: if (error) console.error(error)
// LEGACY SUPABASE: const result = (data ?? {}) as SomeType
const [result = {} as SomeType] = await callSp<SomeType>('sp_name', [filters.npp, filters.year])
```

**Direct table query replacement:**
```ts
// LEGACY SUPABASE: const { data } = await db.from('dpur').select('col1, col2').eq('site_code', npp).gte('date', start)
const data = await query<{ col1: string; col2: string }>(
  'SELECT `col1`, `col2` FROM `dpur` WHERE `site_code` = ? AND `date` >= ?',
  [npp, start]
)
```

**Response shape difference:**
- Supabase: `{ data, error }` — `data` is the result, `error` is null on success
- MySQL `query()`: returns `T[]` directly, throws on error
- MySQL `callSp()`: returns `T[]` (first result set from CALL), throws on error
- For SPs returning a single complex object: access `result[0]`
- For SPs returning an array of rows: use `result` directly

---

### Task 1: SQL Validator (TDD)

**Files:**
- Create: `lib/mysql/__tests__/validator.test.ts`
- Create: `lib/mysql/validator.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// lib/mysql/__tests__/validator.test.ts
import { describe, it, expect } from 'vitest'
import { validateQuery, SafetyError } from '../validator'

describe('validateQuery', () => {
  // ---------------------------------------------------------------
  // MUST REJECT — dangerous SQL
  // ---------------------------------------------------------------
  describe('rejects write/DDL/DCL statements', () => {
    const dangerousCases: Array<[string, string]> = [
      ['INSERT INTO door VALUES (?)', 'INSERT'],
      ['UPDATE door SET col = ?', 'UPDATE'],
      ['DELETE FROM door WHERE id = ?', 'DELETE'],
      ['DROP TABLE door', 'DROP'],
      ['ALTER TABLE door ADD col INT', 'ALTER'],
      ['CREATE TABLE test (id INT)', 'CREATE'],
      ['TRUNCATE TABLE door', 'TRUNCATE'],
      ['RENAME TABLE door TO door2', 'RENAME'],
      ['GRANT SELECT ON door TO user', 'GRANT'],
      ['REVOKE SELECT ON door FROM user', 'REVOKE'],
      ['MERGE INTO door USING src ON (...)', 'MERGE'],
      ['REPLACE INTO door VALUES (?)', 'REPLACE'],
      ['LOAD DATA INFILE "/tmp/data" INTO TABLE door', 'LOAD'],
      ['SET @x = 1', 'SET'],
      ['LOCK TABLES door READ', 'LOCK'],
      ['UNLOCK TABLES', 'UNLOCK'],
      ['USE other_db', 'USE'],
    ]

    for (const [sql, label] of dangerousCases) {
      it(`rejects ${label}: ${sql.slice(0, 50)}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects case variations', () => {
    const cases: string[] = [
      'DrOp TaBlE door',
      'INSERT into door values (?)',
      'dElEtE FROM door',
      '  UPDATE door SET x = 1',
      '\n\tDROP TABLE door',
    ]
    for (const sql of cases) {
      it(`rejects: ${sql.trim().slice(0, 40)}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects body-level dangerous keywords', () => {
    const cases: Array<[string, string]> = [
      ['SELECT 1; DELETE FROM door', 'multi-statement with DELETE'],
      ['SELECT * FROM door INTO OUTFILE "/tmp/x"', 'OUTFILE in body'],
      ['SELECT * FROM door INTO DUMPFILE "/tmp/x"', 'DUMPFILE in body'],
    ]
    for (const [sql, label] of cases) {
      it(`rejects ${label}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects comment smuggling', () => {
    it('strips block comments and still rejects dangerous keywords', () => {
      expect(() => validateQuery('SELECT 1 /* DROP TABLE door */')).not.toThrow()
    })

    it('rejects if dangerous keyword is outside comment', () => {
      expect(() => validateQuery('/* safe */ DROP TABLE door')).toThrow(SafetyError)
    })
  })

  describe('rejects multi-statement queries', () => {
    it('rejects semicolon before end', () => {
      expect(() => validateQuery('SELECT 1; SELECT 2')).toThrow(SafetyError)
    })

    it('allows trailing semicolon', () => {
      expect(() => validateQuery('SELECT 1;')).not.toThrow()
    })
  })

  describe('rejects invalid CALL names', () => {
    const invalidNames: Array<[string, string]> = [
      ["CALL '; DROP TABLE door; --()", 'injection attempt'],
      ['CALL 123.bad()', 'dotted name'],
      ['CALL sp name()', 'space in name'],
      ['CALL ()', 'missing name'],
    ]
    for (const [sql, label] of invalidNames) {
      it(`rejects CALL with ${label}`, () => {
        expect(() => validateQuery(sql)).toThrow(SafetyError)
      })
    }
  })

  describe('rejects empty/whitespace input', () => {
    it('rejects empty string', () => {
      expect(() => validateQuery('')).toThrow(SafetyError)
    })
    it('rejects whitespace only', () => {
      expect(() => validateQuery('   \n\t  ')).toThrow(SafetyError)
    })
  })

  // ---------------------------------------------------------------
  // MUST ALLOW — safe SQL
  // ---------------------------------------------------------------
  describe('allows safe SELECT queries', () => {
    const safeCases: string[] = [
      'SELECT * FROM `door`',
      'SELECT `col1`, `col2` FROM `door` WHERE `id` = ?',
      'SELECT COUNT(*) AS count FROM `product`',
      'SELECT DISTINCT `Vnpp` FROM `dpur` WHERE `Vnpp` IS NOT NULL ORDER BY `Vnpp`',
      'SELECT `site_code`, `site_name` FROM `dpur` ORDER BY `site_name` LIMIT 1000',
      "SELECT * FROM `door` WHERE `off_date` >= ? AND `off_date` <= ? AND `ship_from_code` = ? LIMIT 50000",
    ]
    for (const sql of safeCases) {
      it(`allows: ${sql.slice(0, 60)}...`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })

  describe('allows SHOW/DESCRIBE/EXPLAIN', () => {
    const cases: string[] = [
      'SHOW TABLES',
      'SHOW DATABASES',
      'SHOW GRANTS FOR CURRENT_USER()',
      'DESCRIBE door',
      'DESC dpur',
      'EXPLAIN SELECT * FROM door WHERE id = ?',
    ]
    for (const sql of cases) {
      it(`allows: ${sql}`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })

  describe('allows CTE queries', () => {
    it('allows WITH ... SELECT', () => {
      expect(() =>
        validateQuery('WITH cte AS (SELECT 1 AS n) SELECT * FROM cte')
      ).not.toThrow()
    })
  })

  describe('allows valid CALL statements', () => {
    const cases: string[] = [
      'CALL dashboard_npp_list()',
      'CALL get_ton_kho_data(?,?,?,?)',
      'CALL get_check_customers_list(?,?,?,?,?,?,?,?,?,?)',
    ]
    for (const sql of cases) {
      it(`allows: ${sql}`, () => {
        expect(() => validateQuery(sql)).not.toThrow()
      })
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/mysql/__tests__/validator.test.ts`
Expected: FAIL — module `../validator` not found

- [ ] **Step 3: Write the validator implementation**

```ts
// lib/mysql/validator.ts
export class SafetyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafetyError'
  }
}

const FIRST_TOKEN_ALLOWLIST = new Set([
  'select', 'show', 'describe', 'desc', 'explain', 'with', 'call',
])

const BODY_BLOCKLIST = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'rename', 'grant', 'revoke', 'merge', 'replace', 'load', 'outfile',
  'dumpfile', 'set', 'lock', 'unlock', 'use',
]

const BODY_BLOCKLIST_REGEX = new RegExp(
  `\\b(${BODY_BLOCKLIST.join('|')})\\b`, 'i'
)

export function validateQuery(sql: string): void {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const normalised = stripped.replace(/\s+/g, ' ').trim().toLowerCase()

  if (!normalised) {
    throw new SafetyError('Empty query')
  }

  const firstToken = normalised.split(/\s/)[0]

  if (!FIRST_TOKEN_ALLOWLIST.has(firstToken)) {
    throw new SafetyError(`Disallowed SQL command: ${firstToken.toUpperCase()}`)
  }

  if (firstToken !== 'call') {
    const bodyAfterFirst = normalised.slice(firstToken.length)
    if (BODY_BLOCKLIST_REGEX.test(bodyAfterFirst)) {
      const match = bodyAfterFirst.match(BODY_BLOCKLIST_REGEX)
      throw new SafetyError(`Dangerous keyword in query body: ${match?.[1]?.toUpperCase()}`)
    }
  }

  const semiIndex = normalised.lastIndexOf(';')
  if (semiIndex !== -1 && semiIndex < normalised.length - 1) {
    throw new SafetyError('Multi-statement query detected')
  }

  if (firstToken === 'call') {
    const nameMatch = normalised.match(/^call\s+([^\s(]+)/)
    if (!nameMatch || !/^[a-z][a-z0-9_]*$/i.test(nameMatch[1])) {
      throw new SafetyError(`Invalid stored procedure name: ${nameMatch?.[1] ?? '(none)'}`)
    }
  }
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `npx vitest run lib/mysql/__tests__/validator.test.ts`
Expected: ALL PASS (~40 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/mysql/validator.ts lib/mysql/__tests__/validator.test.ts
git commit -m "feat(mysql): add SQL validator with exhaustive safety tests"
```

---

### Task 2: Audit Logger

**Files:**
- Create: `lib/mysql/audit-logger.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write the audit logger**

```ts
// lib/mysql/audit-logger.ts
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
```

- [ ] **Step 2: Add `.mysql-audit.log` to `.gitignore`**

Append to `.gitignore`:
```
# MySQL audit log (local dev, never committed)
.mysql-audit.log
```

- [ ] **Step 3: Commit**

```bash
git add lib/mysql/audit-logger.ts .gitignore
git commit -m "feat(mysql): add audit logger for query tracking"
```

---

### Task 3: Connection Pool + Install mysql2

**Files:**
- Create: `lib/mysql/pool.ts`
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install mysql2**

Run: `npm install mysql2`

- [ ] **Step 2: Write the pool singleton**

```ts
// lib/mysql/pool.ts
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
      ssl: process.env.MYSQL_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
    })
  }
  return globalForMySQL.mysqlPool
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/mysql/pool.ts package.json package-lock.json
git commit -m "feat(mysql): add connection pool singleton with mysql2"
```

---

### Task 4: MySQL Client (TDD)

**Files:**
- Create: `lib/mysql/__tests__/client.test.ts`
- Create: `lib/mysql/client.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// lib/mysql/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('mysql2/promise', () => {
  const mockConn = {
    execute: vi.fn(),
    query: vi.fn(),
    release: vi.fn(),
  }
  const mockPool = {
    getConnection: vi.fn().mockResolvedValue(mockConn),
  }
  return {
    default: { createPool: vi.fn().mockReturnValue(mockPool) },
    createPool: vi.fn().mockReturnValue(mockPool),
  }
})

vi.mock('../audit-logger', () => ({
  logQuery: vi.fn(),
}))

import { query, callSp } from '../client'
import { SafetyError } from '../validator'
import { logQuery } from '../audit-logger'
import { getPool } from '../pool'

function getMockConn() {
  const pool = getPool()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pool as any).getConnection.__mockReturnValue ?? pool.getConnection()
}

describe('query()', () => {
  let mockConn: { execute: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConn = await getPool().getConnection() as typeof mockConn
    mockConn.query.mockResolvedValue([])
    mockConn.execute.mockResolvedValue([[{ id: 1, name: 'test' }], []])
  })

  it('returns rows from execute', async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1 }, { id: 2 }], []])
    const result = await query<{ id: number }>('SELECT `id` FROM `door`', [])
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('passes params to execute', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT * FROM `door` WHERE `id` = ?', [42])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'SELECT * FROM `door` WHERE `id` = ?',
      [42]
    )
  })

  it('sets read-only session before execute', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(mockConn.query).toHaveBeenCalledWith('SET SESSION TRANSACTION READ ONLY')
    const queryOrder = mockConn.query.mock.invocationCallOrder[0]
    const executeOrder = mockConn.execute.mock.invocationCallOrder[0]
    expect(queryOrder).toBeLessThan(executeOrder)
  })

  it('releases connection on success', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(mockConn.release).toHaveBeenCalled()
  })

  it('releases connection on error', async () => {
    mockConn.execute.mockRejectedValue(new Error('DB down'))
    await expect(query('SELECT 1', [])).rejects.toThrow('DB down')
    expect(mockConn.release).toHaveBeenCalled()
  })

  it('throws SafetyError for dangerous SQL', async () => {
    await expect(query('DROP TABLE door', [])).rejects.toThrow(SafetyError)
    expect(mockConn.execute).not.toHaveBeenCalled()
  })

  it('calls audit logger with sql and duration', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(logQuery).toHaveBeenCalledWith('SELECT 1', expect.any(Number))
  })
})

describe('callSp()', () => {
  let mockConn: { execute: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConn = await getPool().getConnection() as typeof mockConn
    mockConn.query.mockResolvedValue([])
  })

  it('builds CALL statement from name and params', async () => {
    mockConn.execute.mockResolvedValue([
      [[ { id: 1 } ], { affectedRows: 0 }],
      [],
    ])
    await callSp('sp_name', ['a', 42])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'CALL sp_name(?,?)',
      ['a', 42]
    )
  })

  it('handles empty params', async () => {
    mockConn.execute.mockResolvedValue([
      [[ { id: 1 } ], { affectedRows: 0 }],
      [],
    ])
    await callSp('dashboard_npp_list', [])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'CALL dashboard_npp_list()',
      []
    )
  })

  it('extracts first result set from CALL response', async () => {
    const rows = [{ code: 'A', name: 'NPP A' }, { code: 'B', name: 'NPP B' }]
    mockConn.execute.mockResolvedValue([
      [rows, { affectedRows: 0 }],
      [],
    ])
    const result = await callSp<{ code: string; name: string }>('sp_name', [])
    expect(result).toEqual(rows)
  })

  it('returns empty array when SP returns no result set', async () => {
    mockConn.execute.mockResolvedValue([
      [{ affectedRows: 0 }],
      [],
    ])
    const result = await callSp('sp_name', [])
    expect(result).toEqual([])
  })

  it('throws SafetyError for invalid SP name', async () => {
    await expect(callSp("'; DROP TABLE", [])).rejects.toThrow(SafetyError)
    expect(mockConn.execute).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/mysql/__tests__/client.test.ts`
Expected: FAIL — module `../client` not found

- [ ] **Step 3: Write the client implementation**

```ts
// lib/mysql/client.ts
import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from './pool'
import { validateQuery } from './validator'
import { logQuery } from './audit-logger'

export async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  validateQuery(sql)
  const start = performance.now()
  const conn = await getPool().getConnection()
  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY')
    const [rows] = await conn.execute<RowDataPacket[]>(sql, params)
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
    await conn.query('SET SESSION TRANSACTION READ ONLY')
    const [raw] = await conn.execute(sql, params)
    logQuery(sql, Math.round(performance.now() - start))
    if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
      return raw[0] as T[]
    }
    return []
  } finally {
    conn.release()
  }
}
```

- [ ] **Step 4: Run test to verify all pass**

Run: `npx vitest run lib/mysql/__tests__/client.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add lib/mysql/client.ts lib/mysql/__tests__/client.test.ts
git commit -m "feat(mysql): add query() and callSp() client with unit tests"
```

---

### Task 5: Environment Config + Connection Test Script

**Files:**
- Modify: `.env.example`
- Create: `scripts/test-mysql-connection.ts`

- [ ] **Step 1: Add MySQL placeholders to `.env.example`**

Append to `.env.example`:
```
# Corporate MySQL (read-only access)
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=your-database-name
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_SSL=true
```

- [ ] **Step 2: Write the connection test script**

```ts
// scripts/test-mysql-connection.ts
import mysql from 'mysql2/promise'

async function main() {
  const host = process.env.MYSQL_HOST
  if (!host) {
    console.error('MYSQL_HOST not set. Add MySQL vars to .env.local')
    process.exit(1)
  }

  console.log(`Connecting to ${host}:${process.env.MYSQL_PORT ?? 3306}...`)

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectTimeout: 10_000,
    ssl: process.env.MYSQL_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
  })

  try {
    // 1. Basic connectivity
    const [ping] = await conn.execute('SELECT 1 AS ok')
    console.log('1. SELECT 1:', (ping as Array<{ ok: number }>)[0]?.ok === 1 ? 'OK' : 'FAIL')

    // 2. Privilege verification
    const [grants] = await conn.execute('SHOW GRANTS FOR CURRENT_USER()')
    console.log('2. GRANTS:')
    for (const row of grants as Array<Record<string, string>>) {
      const grant = Object.values(row)[0]
      console.log('   ', grant)
      if (/INSERT|UPDATE|DELETE|DROP|ALTER|CREATE/i.test(grant) && !/GRANT.*SELECT/i.test(grant)) {
        console.error('   WRITE GRANTS DETECTED — STOP IMMEDIATELY')
        process.exit(1)
      }
    }

    // 3. Table discovery
    const [tables] = await conn.execute('SHOW TABLES')
    const tableNames = (tables as Array<Record<string, string>>).map(r => Object.values(r)[0])
    console.log(`3. Tables (${tableNames.length} total):`)
    const expected = ['door', 'dpur', 'product', 'mv_dashboard_kpis']
    for (const t of expected) {
      const found = tableNames.includes(t)
      const altName = '_dp' + t.slice(1)
      const altFound = tableNames.includes(altName)
      if (found) {
        console.log(`   ${t}: FOUND`)
      } else if (altFound) {
        console.log(`   ${t}: NOT FOUND — but ${altName} EXISTS (use this name)`)
      } else {
        console.log(`   ${t}: NOT FOUND`)
      }
    }

    // 4. Column inventory
    for (const t of ['door', 'dpur', 'product']) {
      const tableName = tableNames.includes(t) ? t : tableNames.find(n => n.includes(t.replace('d', '')))
      if (tableName) {
        const [cols] = await conn.execute(`DESCRIBE \`${tableName}\``)
        const colNames = (cols as Array<{ Field: string }>).map(c => c.Field)
        console.log(`4. ${tableName} columns (${colNames.length}): ${colNames.join(', ')}`)
      }
    }

    // 5. Test a CALL statement
    try {
      const [spResult] = await conn.execute('CALL dashboard_npp_list()')
      const firstSet = Array.isArray(spResult) && Array.isArray(spResult[0]) ? spResult[0] : spResult
      console.log(`5. CALL dashboard_npp_list(): ${Array.isArray(firstSet) ? firstSet.length : 0} rows`)
      if (Array.isArray(firstSet) && firstSet.length > 0) {
        console.log('   First row:', JSON.stringify(firstSet[0]).slice(0, 200))
      }
    } catch (err) {
      console.log(`5. CALL dashboard_npp_list(): ERROR — ${(err as Error).message}`)
    }

    console.log('\nConnection test complete.')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('Connection failed:', err.message)
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
    console.error('Your IP may not be whitelisted on the MySQL server.')
    console.error('Share your public IP with the senior engineer to get access.')
  }
  process.exit(1)
})
```

- [ ] **Step 3: Add `.env.local` MySQL credentials (manually — never committed)**

Ensure `.env.local` contains:
```
MYSQL_HOST=14.225.203.126
MYSQL_PORT=3306
MYSQL_DATABASE=dashboard_bamboovet
MYSQL_USER=dashboard_bamboovet
MYSQL_PASSWORD=@Gapro800
MYSQL_SSL=true
```

- [ ] **Step 4: Run the connection test**

Run: `npx tsx scripts/test-mysql-connection.ts`
Expected: All 5 checks pass. If SSL fails, set `MYSQL_SSL=false` in `.env.local` and re-run.

**GATE CHECK:**
- If write grants detected → STOP. Do not proceed. Report to user.
- If `dpur` not found but `_dppur` exists → update all SQL in subsequent tasks to use `_dppur`.
- If CALL fails → stored procedures may not be available. Report to user.
- Record table names and column names for use in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add .env.example scripts/test-mysql-connection.ts
git commit -m "feat(mysql): add env config and connection test script"
```

---

### Task 6: Migrate npp-options.ts

**Files:**
- Modify: `lib/admin/services/npp-options.ts`

- [ ] **Step 1: Write the migrated file**

Replace the entire file content:

```ts
// lib/admin/services/npp-options.ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { query } from '@/lib/mysql/client'

async function _getNppOptions(): Promise<Array<{ site_code: string; site_name: string }>> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data, error } = await db
  // LEGACY SUPABASE:   .from('dpur')
  // LEGACY SUPABASE:   .select('site_code, site_name')
  // LEGACY SUPABASE:   .order('site_name')
  // LEGACY SUPABASE:   .limit(1000)
  // LEGACY SUPABASE: if (error || !data) return []

  const data = await query<{ site_code: string; site_name: string }>(
    'SELECT `site_code`, `site_name` FROM `dpur` ORDER BY `site_name` LIMIT 1000',
    []
  )

  const seen = new Map<string, { site_code: string; site_name: string }>()
  for (const row of data) {
    const code = (row.site_code as string)?.trim()
    if (code && !seen.has(code)) {
      seen.set(code, {
        site_code: code,
        site_name: (row.site_name as string)?.trim() || code,
      })
    }
  }
  return [...seen.values()]
}

export const getNppOptions = unstable_cache(
  _getNppOptions,
  ['npp-options'],
  { tags: ['npp-options'], revalidate: 86400 }
)
```

- [ ] **Step 2: Run unit tests to check for regressions**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/npp-options.ts
git commit -m "migrate(mysql): npp-options — replace Supabase .from() with query()"
```

---

### Task 7: Migrate dpur-geo.ts

**Files:**
- Modify: `lib/admin/services/dpur-geo.ts`

- [ ] **Step 1: Write the migrated file**

Replace the entire file content:

```ts
// lib/admin/services/dpur-geo.ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { query } from '@/lib/mysql/client'

export interface DpurGeoEntry {
  site_name: string
  region: string
  area: string
  dist_province: string
}

async function _getDpurGeoLookup(): Promise<DpurGeoEntry[]> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data, error } = await db
  // LEGACY SUPABASE:   .from('dpur')
  // LEGACY SUPABASE:   .select('site_name, region, area, dist_province')
  // LEGACY SUPABASE: if (error || !data) return []

  const data = await query<{ site_name: string; region: string; area: string; dist_province: string }>(
    'SELECT `site_name`, `region`, `area`, `dist_province` FROM `dpur`',
    []
  )

  const seen = new Set<string>()
  const result: DpurGeoEntry[] = []
  for (const r of data) {
    const name = (r.site_name as string)?.trim() || ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push({
      site_name:     name,
      region:        (r.region as string)        || '',
      area:          (r.area as string)          || '',
      dist_province: (r.dist_province as string) || '',
    })
  }
  return result
}

export const getDpurGeoLookup = unstable_cache(
  _getDpurGeoLookup,
  ['geo-data'],
  { tags: ['geo-data'], revalidate: 86400 }
)
```

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/dpur-geo.ts
git commit -m "migrate(mysql): dpur-geo — replace Supabase .from() with query()"
```

---

### Task 8: Migrate ton-kho.ts

**Files:**
- Modify: `lib/admin/services/ton-kho.ts`

This file has 2 RPCs and no direct table queries. The types and business logic stay identical.

- [ ] **Step 1: Replace imports and data fetching**

Replace lines 1-2 (imports):
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { callSp } from '@/lib/mysql/client'
```

Replace lines 78-103 (the data fetching in `_getTonKhoData`):
```ts
async function _getTonKhoData(
  filters: TonKhoFilters
): Promise<TonKhoData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const [filterRes, dataRes] = await Promise.all([
  // LEGACY SUPABASE:   db.rpc('get_ton_kho_filter_options'),
  // LEGACY SUPABASE:   db.rpc('get_ton_kho_data', {
  // LEGACY SUPABASE:     p_snapshot_date: filters.snapshot_date,
  // LEGACY SUPABASE:     p_npp: filters.npp,
  // LEGACY SUPABASE:     p_brand: filters.brand,
  // LEGACY SUPABASE:     p_search: filters.search,
  // LEGACY SUPABASE:   }),
  // LEGACY SUPABASE: ])
  // LEGACY SUPABASE: if (filterRes.error) console.error('Ton kho filter options RPC error:', filterRes.error)
  // LEGACY SUPABASE: if (dataRes.error) console.error('Ton kho data RPC error:', dataRes.error)
  // LEGACY SUPABASE: const filterOpts = (filterRes.data ?? {}) as FilterOptionsRpcResult
  // LEGACY SUPABASE: const rpc = (dataRes.data ?? {}) as TonKhoRpcResult

  const [filterRows, dataRows] = await Promise.all([
    callSp<FilterOptionsRpcResult>('get_ton_kho_filter_options', []),
    callSp<TonKhoRpcResult>('get_ton_kho_data', [
      filters.snapshot_date,
      filters.npp,
      filters.brand,
      filters.search,
    ]),
  ])

  const filterOpts = filterRows[0] ?? ({} as FilterOptionsRpcResult)
  const rpc = dataRows[0] ?? ({} as TonKhoRpcResult)
```

The rest of the function (lines 104-129) stays identical — it only reads from `filterOpts` and `rpc`.

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/ton-kho.ts
git commit -m "migrate(mysql): ton-kho — replace Supabase RPCs with callSp()"
```

---

### Task 9: Migrate nhap-hang.ts

**Files:**
- Modify: `lib/admin/services/nhap-hang.ts`

This file has 1 direct `.from('dpur')` query (the main data fetch). All business logic (revenue calculations, aggregation maps, top-10) stays identical.

- [ ] **Step 1: Replace imports**

Replace lines 1-3:
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { query } from '@/lib/mysql/client'
import { getNppOptions } from './npp-options'
```

- [ ] **Step 2: Replace the data fetch in `_getNhapHangData`**

Replace lines 81-121 (db creation through row mapping):
```ts
async function _getNhapHangData(
  filters: NhapHangFilters
): Promise<NhapHangData> {
  // LEGACY SUPABASE: const db = createServiceClient()

  const startOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const lastDay = new Date(filters.year, filters.month, 0).getDate()
  const endOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-${lastDay}`

  // 1. Get NPP list (always all, for dropdown) — 24h cached
  const nppOptions = await getNppOptions()
  const suppliers = nppOptions.map(o => ({ id: o.site_code, name: o.site_name }))

  // 2. Fetch month rows from dpur
  // LEGACY SUPABASE: let query = db.from('dpur').select('docno,...').gte('pur_date', startOfMonth).lte('pur_date', endOfMonth)
  // LEGACY SUPABASE: if (filters.npp) query = query.eq('site_code', filters.npp)
  // LEGACY SUPABASE: const { data: rawRows } = await query

  const conditions = ['`pur_date` >= ?', '`pur_date` <= ?']
  const params: unknown[] = [startOfMonth, endOfMonth]
  if (filters.npp) {
    conditions.push('`site_code` = ?')
    params.push(filters.npp)
  }

  const rawRows = await query<Record<string, unknown>>(
    `SELECT \`docno\`, \`site_code\`, \`site_name\`, \`sku_code\`, \`sku_name\`,
            \`pur_date\`, \`trntyp\`, \`pr_qty\`, \`pr_amt\`, \`pr_tax_amt\`,
            \`program_id\`, \`category\`, \`brand\`, \`product\`
     FROM \`dpur\`
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  const rows: DpurRow[] = (rawRows ?? []).map(r => ({
    docno: r.docno as string,
    site_code: r.site_code as string,
    site_name: r.site_name as string,
    sku_code: r.sku_code as string,
    sku_name: r.sku_name as string,
    pur_date: r.pur_date as string,
    trntyp: r.trntyp as string,
    pr_qty: Number(r.pr_qty ?? 0),
    pr_amt: Number(r.pr_amt ?? 0),
    pr_tax_amt: Number(r.pr_tax_amt ?? 0),
    program_id: String(r.program_id ?? '0'),
    category: r.category as string || 'Khac',
    brand: r.brand as string || 'Khac',
    product: r.product as string || 'Khac',
  }))
```

Lines 123-297 (all business logic from `receiveRows` filter through return statement) stay **exactly the same** — no changes needed.

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add lib/admin/services/nhap-hang.ts
git commit -m "migrate(mysql): nhap-hang — replace Supabase .from() with query()"
```

---

### Task 10: Migrate khach-hang.ts

**Files:**
- Modify: `lib/admin/services/khach-hang.ts`

This file has 2 RPCs. All types and business logic stay identical.

- [ ] **Step 1: Replace imports and data fetching**

Replace lines 1-2:
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { callSp } from '@/lib/mysql/client'
```

Replace lines 74-89 (the data fetching in `_getKhachHangData`):
```ts
async function _getKhachHangData(
  filters: KhachHangFilters
): Promise<KhachHangData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const [summaryRes, geoRes] = await Promise.all([
  // LEGACY SUPABASE:   db.rpc('get_khach_hang_summary', { p_npp: filters.npp }),
  // LEGACY SUPABASE:   db.rpc('get_khach_hang_geo', { p_npp: filters.npp }),
  // LEGACY SUPABASE: ])
  // LEGACY SUPABASE: if (summaryRes.error) console.error(...)
  // LEGACY SUPABASE: if (geoRes.error) console.error(...)
  // LEGACY SUPABASE: const s = (summaryRes.data as any) ?? {}
  // LEGACY SUPABASE: const geoPoints: CustomerGeoPoint[] = Array.isArray(geoRes.data) ? geoRes.data : []

  const [summaryRows, geoRows] = await Promise.all([
    callSp<Record<string, unknown>>('get_khach_hang_summary', [filters.npp]),
    callSp<CustomerGeoPoint>('get_khach_hang_geo', [filters.npp]),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (summaryRows[0] as any) ?? {}
  const geoPoints: CustomerGeoPoint[] = geoRows
```

Lines 91-119 (building the return object) stay **exactly the same**.

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/khach-hang.ts
git commit -m "migrate(mysql): khach-hang — replace Supabase RPCs with callSp()"
```

---

### Task 11: Migrate check-distributor.ts

**Files:**
- Modify: `lib/admin/services/check-distributor.ts`

This file has 3 RPCs. The `matchGeo` helper and all business logic stay identical.

- [ ] **Step 1: Replace imports**

Replace lines 1-3:
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { callSp } from '@/lib/mysql/client'
import { getDpurGeoLookup, type DpurGeoEntry } from './dpur-geo'
```

- [ ] **Step 2: Replace data fetching in `_getCheckDistributorData`**

Replace lines 94-117:
```ts
async function _getCheckDistributorData(
  filters: CheckDistributorFilters
): Promise<CheckDistributorData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const [[pivotResult, optionsResult], dpurSites] = await Promise.all([
  // LEGACY SUPABASE:   Promise.all([
  // LEGACY SUPABASE:     db.rpc('get_check_distributor_pivot', {...}),
  // LEGACY SUPABASE:     db.rpc('get_check_distributor_filter_options', { p_year: filters.year }),
  // LEGACY SUPABASE:   ]),
  // LEGACY SUPABASE:   getDpurGeoLookup(),
  // LEGACY SUPABASE: ])

  const [[pivotRows, optionsRows], dpurSites] = await Promise.all([
    Promise.all([
      callSp<Record<string, unknown>>('get_check_distributor_pivot', [
        filters.year,
        filters.system_type,
        filters.ship_from,
        filters.category,
        filters.brand,
        filters.search,
        filters.page,
        filters.page_size,
      ]),
      callSp<Record<string, unknown>>('get_check_distributor_filter_options', [
        filters.year,
      ]),
    ]),
    getDpurGeoLookup(),
  ])

  // Parse pivot result
  // LEGACY SUPABASE: const pivotPayload = pivotResult.data as {...} | null
  const pivotPayload = (pivotRows[0] ?? null) as {
    total: number
    data: Array<{
      distributor_code: string
      distributor_name: string
      m1: number; m2: number; m3: number; m4: number
      m5: number; m6: number; m7: number; m8: number
      m9: number; m10: number; m11: number; m12: number
    }>
  } | null
```

Lines 132-172 (mapping rows to distributor data, filter options, return) stay **exactly the same**.

- [ ] **Step 3: Replace data fetching in `getDistributorDetail`**

Replace lines 184-196:
```ts
export async function getDistributorDetail(
  id: string,
  month: number,
  year: number
): Promise<DistributorDetailData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.rpc('get_check_distributor_detail', {
  // LEGACY SUPABASE:   p_ship_from_code: id, p_month: month, p_year: year,
  // LEGACY SUPABASE: })

  const rows = await callSp<Record<string, unknown>>('get_check_distributor_detail', [
    id, month, year,
  ])

  const result = (rows[0] ?? null) as {
    distributor_name: string
    distributor_id: string
    year: number
    month: number
    staff: Array<{
      staff_id: string
      staff_name: string
      daily_data: Array<{ day: number; revenue: number; customer_count: number }>
    }>
  } | null
```

Lines 209-239 (the `if (!result)` fallback through return) stay **exactly the same**.

- [ ] **Step 4: Also update the filter options parsing**

Replace lines 150-157:
```ts
  // LEGACY SUPABASE: const opts = optionsResult.data as {...} | null
  const opts = (optionsRows[0] ?? null) as {
    categories: string[] | null
    brands: string[] | null
    system_types: string[] | null
    ship_froms: string[] | null
  } | null
```

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add lib/admin/services/check-distributor.ts
git commit -m "migrate(mysql): check-distributor — replace Supabase RPCs with callSp()"
```

---

### Task 12: Migrate check-customers.ts

**Files:**
- Modify: `lib/admin/services/check-customers.ts`

This file has 7 RPCs (4 in the main function, 3 in standalone functions). All types stay identical.

- [ ] **Step 1: Replace imports**

Replace lines 1-2:
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { callSp } from '@/lib/mysql/client'
```

- [ ] **Step 2: Replace data fetching in `_getCheckCustomersData`**

Replace lines 77-121:
```ts
async function _getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const [mapPinsResult, customersResult, nppResult, classResult] = await Promise.all([...])

  const [mapPinsRows, customersRows, nppRows, classRows] = await Promise.all([
    callSp<MapPin>('get_check_customers_map_pins', [
      filters.distributor_id,
    ]),
    callSp<Record<string, unknown>>('get_check_customers_list', [
      filters.distributor_id,
      filters.search,
      filters.page,
      filters.page_size,
      filters.customer_key_filter,
      filters.customer_name_filter,
      filters.province,
      filters.town,
      filters.cust_class_key,
      filters.has_geo,
    ]),
    callSp<{ ship_from_code: string; ship_from_name: string }>('get_door_npp_options', []),
    callSp<CustClassOption>('get_check_customers_class_options', []),
  ])

  const mapPinsRaw = mapPinsRows
  const customersPayload = (customersRows[0] ?? null) as {
    total: number
    data: CustomerRow[]
  } | null
  const nppRaw = nppRows
  const classRaw = classRows

  return {
    map_pins: mapPinsRaw,
    customers: {
      data: customersPayload?.data ?? [],
      total: customersPayload?.total ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
    npp_options: nppRaw,
    cust_class_options: classRaw,
  }
}
```

- [ ] **Step 3: Replace standalone functions**

Replace `getCustomerLocations` (lines 133-137):
```ts
export async function getCustomerLocations(): Promise<LocationHierarchy> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.rpc('get_check_customers_locations')
  const rows = await callSp<LocationHierarchy>('get_check_customers_locations', [])
  return (rows[0] ?? { provinces: [], towns: [] }) as LocationHierarchy
}
```

Replace `getCustomerAutocomplete` (lines 143-155):
```ts
export async function getCustomerAutocomplete(
  field: 'customer_key' | 'customer_name',
  query: string,
  limit = 10
): Promise<string[]> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.rpc('get_check_customers_autocomplete', {...})
  const rows = await callSp<{ value: string }>('get_check_customers_autocomplete', [
    field, query, limit,
  ])
  return rows.map(r => r.value ?? (r as unknown as string))
}
```

Replace `getCustomerRevenue` (lines 161-169):
```ts
export async function getCustomerRevenue(
  customerKey: string
): Promise<RevenuePivotRow[]> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.rpc('get_customer_revenue', { p_customer_key: customerKey })
  return await callSp<RevenuePivotRow>('get_customer_revenue', [customerKey])
}
```

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lib/admin/services/check-customers.ts
git commit -m "migrate(mysql): check-customers — replace 7 Supabase RPCs with callSp()"
```

---

### Task 13: Migrate ai-analysis route

**Files:**
- Modify: `app/api/ai-analysis/route.ts`

This file has 2 RPCs (`dashboard_door_monthly`, `dashboard_dpur_monthly`). The Gemini API call and prompt building stay identical.

- [ ] **Step 1: Replace imports and data fetching**

Replace lines 1-9 (imports):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { callSp } from '@/lib/mysql/client'
import {
  aggregateForGemini,
  buildGeminiPrompt,
  stripMarkdownWrapper,
  type MonthlyRow,
} from '@/lib/admin/services/ai-analysis'
```

Replace lines 20-35 (data fetching inside the POST handler):
```ts
    // LEGACY SUPABASE: const db = createServiceClient()
    // LEGACY SUPABASE: const [salesResult, purchaseResult] = await Promise.all([
    // LEGACY SUPABASE:   db.rpc('dashboard_door_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '', p_kenh: '' }),
    // LEGACY SUPABASE:   db.rpc('dashboard_dpur_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '' }),
    // LEGACY SUPABASE: ])

    const [salesRows, purchaseRows_raw] = await Promise.all([
      callSp<{ year: number; month: number; ban_hang: number }>('dashboard_door_monthly', ['', '', '', '']),
      callSp<{ year: number; month: number; nhap_hang: number }>('dashboard_dpur_monthly', ['', '', '']),
    ])

    const salesMonthly: MonthlyRow[] = salesRows.map(
      r => ({ year: r.year, month: r.month, value: r.ban_hang ?? 0 })
    )

    const purchaseMonthly: MonthlyRow[] = purchaseRows_raw.map(
      r => ({ year: r.year, month: r.month, value: r.nhap_hang ?? 0 })
    )

    const currentDate = new Date().toISOString().slice(0, 10)
    const payload = aggregateForGemini(salesMonthly, purchaseMonthly, currentDate)
```

Lines 39-73 (Gemini API call through return) stay **exactly the same**.

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS (the ai-analysis route test should still pass since it tests the pure functions, not the data fetching)

- [ ] **Step 3: Commit**

```bash
git add app/api/ai-analysis/route.ts
git commit -m "migrate(mysql): ai-analysis route — replace Supabase RPCs with callSp()"
```

---

### Task 14: Migrate dashboard.ts

**Files:**
- Modify: `lib/admin/services/dashboard.ts`

This is the largest file (728 lines) with 9 RPCs + 5 direct table queries. All business logic (sections 5-12: daily series, metrics box, pie charts, KPI row, staff list, customer section, top 10) stays **identical** — only the data fetching in sections 1-2 changes.

- [ ] **Step 1: Replace imports**

Replace lines 1-3:
```ts
import { unstable_cache } from 'next/cache'
// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
import { query, callSp } from '@/lib/mysql/client'
import { computeMovingAverageForecast } from '@/lib/admin/forecast'
```

- [ ] **Step 2: Replace the data fetching in `getDashboardData` (section 1 — building queries)**

Replace lines 200-228 (the `db = createServiceClient()` through month-scoped query building):

```ts
export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData> {
  // LEGACY SUPABASE: const db = createServiceClient()
  const { year, month } = parseMonth(filters.month)
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`
  const daysInMonth = lastDayOfMonth(year, month)
  const prevYear = year - 1
  const prevStartOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-01`
  const prevEndOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-${lastDayOfMonth(prevYear, month)}`

  const npp = filters.npp
  const nganh = filters.nganhHang
  const th = filters.thuongHieu
  const kenh = filters.kenh

  // Build dynamic WHERE clauses for month-scoped queries
  const doorConditions = ['`off_date` >= ?', '`off_date` <= ?']
  const doorParams: unknown[] = [startOfMonth, endOfMonth]
  if (npp)   { doorConditions.push('`ship_from_code` = ?'); doorParams.push(npp) }
  if (nganh) { doorConditions.push('`category` = ?'); doorParams.push(nganh) }
  if (th)    { doorConditions.push('`brand` = ?'); doorParams.push(th) }
  if (kenh)  { doorConditions.push('`v_chanel` = ?'); doorParams.push(kenh) }

  const dpurConditions = ['`pur_date` >= ?', '`pur_date` <= ?']
  const dpurParams: unknown[] = [startOfMonth, endOfMonth]
  if (npp)   { dpurConditions.push('`site_code` = ?'); dpurParams.push(npp) }
  if (nganh) { dpurConditions.push('`category` = ?'); dpurParams.push(nganh) }
  if (th)    { dpurConditions.push('`brand` = ?'); dpurParams.push(th) }

  const prevDoorConditions = ['`off_date` >= ?', '`off_date` <= ?']
  const prevDoorParams: unknown[] = [prevStartOfMonth, prevEndOfMonth]
  if (npp)   { prevDoorConditions.push('`ship_from_code` = ?'); prevDoorParams.push(npp) }
  if (nganh) { prevDoorConditions.push('`category` = ?'); prevDoorParams.push(nganh) }
  if (th)    { prevDoorConditions.push('`brand` = ?'); prevDoorParams.push(th) }
  if (kenh)  { prevDoorConditions.push('`v_chanel` = ?'); prevDoorParams.push(kenh) }

  const prevDpurConditions = ['`pur_date` >= ?', '`pur_date` <= ?']
  const prevDpurParams: unknown[] = [prevStartOfMonth, prevEndOfMonth]
  if (npp)   { prevDpurConditions.push('`site_code` = ?'); prevDpurParams.push(npp) }
  if (nganh) { prevDpurConditions.push('`category` = ?'); prevDpurParams.push(nganh) }
  if (th)    { prevDpurConditions.push('`brand` = ?'); prevDpurParams.push(th) }
```

- [ ] **Step 3: Replace the parallel query execution (section 2)**

Replace lines 261-301 (the `Promise.all` block):

```ts
  // LEGACY SUPABASE: const [...results] = await Promise.all([
  //   db.rpc('dashboard_npp_list'), db.rpc('dashboard_categories'), ...
  //   monthDoorFetch, monthDpurFetch, prevDoorFetch, prevDpurFetch,
  //   db.from('product').select(..., { count: 'exact', head: true }),
  //   db.rpc('dashboard_total_customer_count', {...}),
  // ])

  const DOOR_COLS = '`saleperson_key`,`saleperson_name`,`customer_key`,`customer_name`,' +
    '`cust_class_key`,`cust_class_name`,`sku_code`,`sku_name`,`category`,`brand`,' +
    '`product`,`off_date`,`off_qty`,`off_amt`,`off_dsc`,`off_tax_amt`,`lat`,`long`'

  const DPUR_MONTH_COLS = '`pur_date`,`pr_qty`,`pr_amt`,`pr_tax_amt`,`trntyp`,' +
    '`sku_code`,`sku_name`,`category`,`brand`,`product`'

  const [
    nppListRows,
    categoriesRows,
    brandsRows,
    channelsRows,
    doorYearlyRows,
    doorMonthlyRows,
    dpurYearlyRows,
    dpurMonthlyRows,
    monthDoorRows_raw,
    monthDpurRows_raw,
    prevDoorRows_raw,
    prevDpurRows_raw,
    skuCountRows,
    totalCustomersRows,
  ] = await Promise.all([
    callSp<{ ship_from_code: string; ship_from_name: string }>('dashboard_npp_list', []),
    callSp<{ category: string }>('dashboard_categories', []),
    callSp<{ brand: string }>('dashboard_brands', []),
    callSp<{ v_chanel: string }>('dashboard_channels', []),

    callSp<{ yr: number; ban_hang: number }>('dashboard_door_yearly', [npp, nganh, th, kenh]),
    callSp<{ yr: number; mo: number; ban_hang: number }>('dashboard_door_monthly', [npp, nganh, th, kenh]),
    callSp<{ yr: number; nhap_hang: number }>('dashboard_dpur_yearly', [npp, nganh, th]),
    callSp<{ yr: number; mo: number; nhap_hang: number }>('dashboard_dpur_monthly', [npp, nganh, th]),

    query<DoorRow>(
      `SELECT ${DOOR_COLS} FROM \`door\` WHERE ${doorConditions.join(' AND ')} LIMIT 50000`,
      doorParams
    ),
    query<DpurRow>(
      `SELECT ${DPUR_MONTH_COLS} FROM \`dpur\` WHERE ${dpurConditions.join(' AND ')} LIMIT 50000`,
      dpurParams
    ),
    query<{ off_date: string; off_qty: number; off_amt: number; off_dsc: number | null; off_tax_amt: number }>(
      `SELECT \`off_date\`,\`off_qty\`,\`off_amt\`,\`off_dsc\`,\`off_tax_amt\` FROM \`door\` WHERE ${prevDoorConditions.join(' AND ')} LIMIT 50000`,
      prevDoorParams
    ),
    query<{ pur_date: string; pr_amt: number; pr_tax_amt: number; trntyp: string }>(
      `SELECT \`pur_date\`,\`pr_amt\`,\`pr_tax_amt\`,\`trntyp\` FROM \`dpur\` WHERE ${prevDpurConditions.join(' AND ')} LIMIT 50000`,
      prevDpurParams
    ),

    query<{ count: number }>('SELECT COUNT(*) AS `count` FROM `product`', []),
    callSp<{ count: number }>('dashboard_total_customer_count', [npp, nganh, th, kenh]),
  ])
```

- [ ] **Step 4: Replace the results processing (section 2 continued)**

Replace lines 306-315 (filter options processing):
```ts
  // Process filter options (no .data wrapper — results are direct arrays)
  const nppMap = new Map<string, string>()
  for (const row of nppListRows) {
    nppMap.set(row.ship_from_code, row.ship_from_name || row.ship_from_code)
  }
  const npp_list = Array.from(nppMap.entries()).map(([id, name]) => ({ id, name }))

  const nganh_hang = categoriesRows.map(r => r.category)
  const thuong_hieu = brandsRows.map(r => r.brand)
  const kenh_list = channelsRows.map(r => r.v_chanel)
  const filter_options = { nganh_hang, thuong_hieu, kenh_list }
```

Replace lines 320-339 (yearly series):
```ts
  // Yearly series
  const yearlyBanMap = new Map<number, number>()
  for (const row of doorYearlyRows) {
    if (row.yr) yearlyBanMap.set(row.yr, row.ban_hang ?? 0)
  }
  const yearlyNhapMap = new Map<number, number>()
  for (const row of dpurYearlyRows) {
    if (row.yr) yearlyNhapMap.set(row.yr, row.nhap_hang ?? 0)
  }
```

(The rest of yearly_series building stays the same.)

Replace lines 344-389 (monthly series):
```ts
  // Monthly series
  const monthlyBanMap = new Map<string, number>()
  for (const row of doorMonthlyRows) {
    if (row.yr && row.mo) {
      monthlyBanMap.set(`${row.yr}-${row.mo}`, row.ban_hang ?? 0)
    }
  }
  const monthlyNhapMap = new Map<string, number>()
  for (const row of dpurMonthlyRows) {
    if (row.yr && row.mo) {
      monthlyNhapMap.set(`${row.yr}-${row.mo}`, row.nhap_hang ?? 0)
    }
  }
```

(The rest of monthly_series + forecast stays the same.)

Replace lines 394-397 (month-scoped row data):
```ts
  // Month-scoped row data (already typed from query<T>)
  const monthDoorRows = monthDoorRows_raw
  const monthDpurRows = monthDpurRows_raw
  const prevDoorRows = prevDoorRows_raw
  const prevDpurRows = prevDpurRows_raw
```

Replace lines 437-448 (metrics box — SKU total and customer total):
```ts
  const customers_total = totalCustomersRows[0]?.count ?? Number(totalCustomersRows[0] ?? 0)

  const metrics_box: DashboardData['metrics_box'] = {
    nhap_hang: nhapHangMonth,
    ban_hang: banHangMonth,
    customers_active: activeCustomerKeys.size,
    customers_total,
    sku_sold: soldSkuCodes.size,
    sku_total: skuCountRows[0]?.count ?? 0,
    nhan_vien: nhanVienInMonth.size,
  }
```

**Sections 6-12 (daily series, pie charts, KPI row, staff list, customer section, top 10)** stay **exactly the same** — they only operate on the row arrays which have the same shape.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add lib/admin/services/dashboard.ts
git commit -m "migrate(mysql): dashboard — replace 9 RPCs + 5 table queries with callSp()/query()"
```

---

### Task 15: Settings Page Hybrid + Refresh Action No-op

**Files:**
- Modify: `app/admin/settings/page.tsx`
- Modify: `app/admin/_actions/refresh-views.ts`

- [ ] **Step 1: Replace `mv_dashboard_kpis` query in settings page**

In `app/admin/settings/page.tsx`, add MySQL import and replace the KPIs query:

```ts
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { query as mysqlQuery } from '@/lib/mysql/client'
import { Badge } from '@/components/ui/badge'
import { RefreshButton } from './refresh-button'

export default async function AdminSettingsPage() {
  // Auth check stays on Supabase
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Cai dat</h1>
        <p className="text-gray-400">Khong tim thay nguoi dung</p>
      </div>
    )
  }

  // Profile stays on Supabase (auth data)
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // LEGACY SUPABASE: const { data: kpis } = await svc
  // LEGACY SUPABASE:   .from('mv_dashboard_kpis')
  // LEGACY SUPABASE:   .select('refreshed_at')
  // LEGACY SUPABASE:   .single()
  const kpiRows = await mysqlQuery<{ refreshed_at: string }>(
    'SELECT `refreshed_at` FROM `mv_dashboard_kpis` ORDER BY `refreshed_at` DESC LIMIT 1',
    []
  )
  const kpis = kpiRows[0] ?? null

  const refreshedAt = kpis?.refreshed_at
    ? new Date(kpis.refreshed_at).toLocaleString('vi-VN')
    : 'Chua co du lieu'
```

(The rest of the JSX stays the same.)

- [ ] **Step 2: Convert refresh-views to no-op**

Replace entire `app/admin/_actions/refresh-views.ts`:

```ts
'use server'

import { revalidateTag } from 'next/cache'

// LEGACY SUPABASE: import { createServiceClient } from '@/lib/supabase/server'
// LEGACY SUPABASE: const svc = createServiceClient()
// LEGACY SUPABASE: const { error } = await svc.rpc('refresh_admin_views')
// MySQL tables are refreshed externally by the senior engineer.
// This action now only invalidates Next.js caches.

export async function refreshMaterializedViews() {
  revalidateTag('dashboard-fast')
  revalidateTag('dashboard-slow')
  revalidateTag('nhap-hang')
  revalidateTag('ton-kho')
  revalidateTag('khach-hang')
  revalidateTag('check-customers')
  revalidateTag('check-distributor')

  return { success: true as const }
}
```

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add app/admin/settings/page.tsx app/admin/_actions/refresh-views.ts
git commit -m "migrate(mysql): settings hybrid (profiles=Supabase, kpis=MySQL) + refresh no-op"
```

---

### Task 16: Full Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run full unit test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Start dev server and verify each admin page**

Run: `npm run dev`

Verify each page loads and renders data (not empty, not error state):
1. `/admin/dashboard` — KPI cards, charts, staff table, map
2. `/admin/nhap-hang` — KPI cards, orders table, charts
3. `/admin/ton-kho` — KPI cards, product table, charts
4. `/admin/khach-hang` — charts, breakdown tables
5. `/admin/check-customers` — map, customer table, filters
6. `/admin/check-distributor` — pivot table, detail dialog
7. `/admin/settings` — admin info, last refresh timestamp
8. Click "Lam moi du lieu" button — should succeed (no-op)

- [ ] **Step 3: Test AI Analysis Board**

Navigate to the AI Analysis Board page. Click "Phan tich" button. Verify Gemini analysis renders with sales/purchase data.

- [ ] **Step 4: Verify Supabase Auth still works**

1. Log out → redirected to `/login`
2. Log in → redirected to `/admin/dashboard`
3. Non-admin user → redirected to `/login` from `/admin/*`

- [ ] **Step 5: Review audit log**

Run: `head -20 .mysql-audit.log`
Expected: Every line starts with `SELECT` or `CALL` fingerprint. No other SQL commands.

Run: `grep -iv '"sql":"select\|"sql":"call' .mysql-audit.log`
Expected: Empty output (no non-SELECT/CALL queries)

- [ ] **Step 6: Run Playwright E2E tests**

Run: `npm run test:e2e`
Expected: ALL PASS

- [ ] **Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(mysql): post-migration adjustments from E2E verification"
```

---

## Discovery Gates

These are resolved during Task 5 (connection test). Results may require changes to subsequent tasks:

| Gate | Resolution | Impact |
|------|-----------|--------|
| Table name: `dpur` vs `_dppur` | Run `SHOW TABLES` | If `_dppur`: find-replace `dpur` → `_dppur` in all SQL strings |
| Write grants on MySQL user | Run `SHOW GRANTS` | If write grants: **STOP. Do not proceed.** Escalate to user. |
| SSL availability | Try `MYSQL_SSL=true` | If fails: set `MYSQL_SSL=false`, document as security finding |
| SP response format | Run `CALL dashboard_npp_list()` | If result shape differs: adapt `callSp` return handling |
| SP parameter order | Compare with Supabase named params | If order differs: update param arrays in service files |

## Rollback

Per-service rollback: uncomment `LEGACY SUPABASE` lines, delete the MySQL lines below them.

Full rollback:
```bash
git checkout main -- lib/admin/services/
git checkout main -- app/api/ai-analysis/route.ts
git checkout main -- app/admin/_actions/refresh-views.ts
git checkout main -- app/admin/settings/page.tsx
```
