# MySQL Migration Design — Bamboo Vet Admin Dashboard

**Date**: 2026-04-18  
**Branch**: `feature/mysql-migration`  
**Scope**: Migrate admin dashboard data queries from Supabase PostgreSQL to corporate MySQL. Supabase Auth stays intact. Product A (RAGflow chatbot) is frozen — zero changes.

---

## 🔴🔴🔴 SAFETY CONSTRAINT — READ THIS FIRST

The target MySQL database (`14.225.203.126`) is a **LIVE CORPORATE PRODUCTION DATABASE** containing years of real sales, tax records, and financial data.

**ABSOLUTE PROHIBITIONS — never execute against this DB:**
- INSERT, UPDATE, DELETE, TRUNCATE, DROP, ALTER, CREATE, RENAME
- GRANT, REVOKE, or any permissions-altering statement
- Any stored procedure, trigger, view, index, or function creation
- Any migration tool, ORM in write mode, or schema sync tool

**REQUIRED SAFETY MEASURES (all must be active):**
1. MySQL user verified read-only via `SHOW GRANTS FOR CURRENT_USER()` before any app query
2. Read-only session: `SET SESSION TRANSACTION READ ONLY` on every connection checkout
3. Query validator (`lib/mysql/validator.ts`) throws on any non-SELECT/SHOW/DESCRIBE/EXPLAIN/CALL string
4. Parameterized queries only — zero string interpolation of user input
5. Connection pool max 5 connections
6. Audit log records every executed query

**If uncertain → STOP and ask. Cost of asking = zero. Cost of mistake = irreversible.**

---

## Section 1: Current Supabase Data Query Audit

### 🔴 Migrate to MySQL (9 service files, 1842 lines)

| File | Lines | RPC calls | Direct `.from()` | Key tables / procs |
|---|---|---|---|---|
| `lib/admin/services/dashboard.ts` | 728 | 13 | 4 | `door`, `dpur`, `product`, `mv_dashboard_kpis` |
| `lib/admin/services/check-customers.ts` | 169 | 7 | 0 | All RPC |
| `lib/admin/services/check-distributor.ts` | 239 | 3 | 0 | All RPC |
| `lib/admin/services/nhap-hang.ts` | 297 | 1 | 1 | `dpur` |
| `lib/admin/services/khach-hang.ts` | 119 | 2 | 0 | All RPC |
| `lib/admin/services/ton-kho.ts` | 129 | 2 | 0 | All RPC |
| `lib/admin/services/dpur-geo.ts` | 41 | 0 | 1 | `dpur` |
| `lib/admin/services/npp-options.ts` | 32 | 0 | 1 | `dpur` |
| `lib/admin/services/ai-analysis.ts` | 88 | 0 | — | Delegates to dashboard.ts |

**Also migrate:**
- `app/api/ai-analysis/route.ts` — 2 RPCs (`dashboard_door_monthly`, `dashboard_dpur_monthly`)
- `app/admin/_actions/refresh-views.ts` — 1 RPC (`refresh_admin_views`) → becomes no-op

**⚠️ Hybrid (split data sources):**
- `app/admin/settings/page.tsx` — `profiles` stays Supabase; `mv_dashboard_kpis` migrates to MySQL

### 🟢 Stay on Supabase — DO NOT TOUCH

| File | Tables | Reason |
|---|---|---|
| `app/api/chat/route.ts` | `conversations`, `messages` | Product A — frozen |
| `app/api/conversations/**` | `conversations`, `messages` | Product A — frozen |
| `app/app/**` | `conversations`, `messages` | Product A — frozen |
| `app/admin/settings/page.tsx` line 20 | `profiles` | Supabase Auth user profile |
| `lib/supabase/client.ts` | — | Auth client — untouched |
| `lib/supabase/server.ts` | — | Auth + service role client — untouched |
| `lib/supabase/middleware.ts` | — | Auth session refresh — untouched |
| `lib/admin/auth.ts` | — | `requireAdmin()` — untouched |

### Scripts (out of scope — dev-only Supabase seeding tools)
`scripts/seed.ts`, `scripts/seed-sales.ts`, `scripts/import-real-data.ts`, `scripts/_import-product.ts`, `scripts/refresh-views.ts` — left on Supabase as-is.

---

## Section 2: PostgreSQL → MySQL Dialect Differences

Stored procedures are already mirrored on MySQL by the senior engineer — no function body translation needed. Dialect differences apply only to the ~10 direct `.from()` table queries we rewrite as raw SQL.

| Topic | PostgreSQL | MySQL (target) |
|---|---|---|
| Identifier quoting | `"double_quotes"` | `` `backticks` `` |
| String concat | `col \|\| ' '` | `CONCAT(col, ' ')` |
| Date format | `TO_CHAR(d, 'YYYY-MM')` | `DATE_FORMAT(d, '%Y-%m')` |
| Boolean literals | `TRUE / FALSE` | `1 / 0` (MySQL 8 also accepts `TRUE/FALSE`) |
| Parameterized placeholders | `$1, $2` | `?, ?` |
| `LIMIT / OFFSET` | `LIMIT n OFFSET m` | Identical |
| `IS NULL / IS NOT NULL` | Identical | Identical |
| `NOW()` | Identical | Identical |
| Count with exact flag | `(count: 'exact', head: true)` | `SELECT COUNT(*) AS count` |
| Array / JSONB types | Used in Postgres functions | Not needed — functions already on MySQL |

**Table name discovery gate**: The task brief uses `_dppur` but the codebase and stored-proc names use `dpur`. Run `SHOW TABLES` at first connection and confirm before writing any SELECT query.

---

## Section 3: MySQL Data Layer Architecture

### Module tree

```
lib/mysql/
├── pool.ts           — connection pool singleton (max 5, SSL, read-only session)
├── validator.ts      — SQL safety gate
├── client.ts         — public API: query<T>() and callSp<T>()
├── audit-logger.ts   — appends every query to .mysql-audit.log
└── __tests__/
    ├── validator.test.ts
    └── client.test.ts
```

### Public API

```ts
// lib/mysql/client.ts — the ONLY way to execute queries
export async function query<T>(sql: string, params: unknown[]): Promise<T[]>
export async function callSp<T>(name: string, params: unknown[]): Promise<T[]>
```

- `query()`: validate → log → `pool.execute(sql, params)` → return rows
- `callSp()`: build `CALL name(?,?,?)` from `params.length` placeholders → validate → log → execute → return rows

**Why `params` is an array, not a Record**: MySQL stored procs use positional parameters `(?,?,?)`. Using a Record at call sites would silently reorder params if object key order ever drifted. Arrays make the order explicit and auditable at every call site. Convention: match the MySQL proc's parameter declaration order (confirmed via `DESCRIBE PROCEDURE RESULT sp_name` at connection time).

### Pool configuration

```ts
// lib/mysql/pool.ts
createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  connectionLimit: 5,
  connectTimeout: 10_000,
  ssl: process.env.MYSQL_SSL === 'true'
    ? { rejectUnauthorized: true }   // attempt first
    : undefined,                     // fallback if SSL unavailable — flag to user
})
// After each connection checkout:
// conn.query('SET SESSION TRANSACTION READ ONLY')
```

### How service files change (example)

```ts
// LEGACY SUPABASE: kept as fallback during MySQL migration
// const { data } = await db.rpc('dashboard_npp_list')
// const list = data ?? []

const list = await callSp<NppOption>('dashboard_npp_list', {})

// LEGACY SUPABASE: kept as fallback during MySQL migration
// const { data } = await db.from('dpur').select('Vnpp').not('Vnpp', 'is', null)
// const npps = data ?? []

const npps = await query<{ Vnpp: string }>(
  'SELECT DISTINCT `Vnpp` FROM `dpur` WHERE `Vnpp` IS NOT NULL ORDER BY `Vnpp`',
  []
)
```

### Migration order (Approach 3 — Foundation-first incremental)

1. `lib/mysql/` foundation + exhaustive validator unit tests
2. `scripts/test-mysql-connection.ts` — one-shot connection verifier (never imported by app)
3. Service files in order (cheapest first):
   - `npp-options.ts`
   - `dpur-geo.ts`
   - `ton-kho.ts`
   - `nhap-hang.ts`
   - `khach-hang.ts`
   - `check-distributor.ts`
   - `check-customers.ts`
   - `ai-analysis.ts` + `app/api/ai-analysis/route.ts`
   - `dashboard.ts` (largest, last)
4. Settings page hybrid wiring
5. `refresh-views.ts` no-op conversion
6. Full Playwright end-to-end

---

## Section 4: Safety Layer Design

### Validator (`lib/mysql/validator.ts`)

```ts
export class SafetyError extends Error {}
export function validateQuery(sql: string): void
```

**Algorithm:**
1. Normalise: lowercase, collapse whitespace, strip block comments `/* ... */`
2. Extract first token
3. **First-token allowlist**: `select`, `show`, `describe`, `desc`, `explain`, `with`, `call` — anything else → `throw new SafetyError`
4. **Body blocklist** (word-boundary regex): rejects if any of these appear as tokens in the normalised string:
   `insert`, `update`, `delete`, `drop`, `alter`, `create`, `truncate`, `rename`, `grant`, `revoke`, `merge`, `replace`, `exec`, `execute`, `load`, `outfile`, `dumpfile`
5. **Multi-statement guard**: rejects if `;` appears before the final character
6. **CALL name guard**: if first token is `call`, procedure name must match `/^[a-z0-9_]+$/i`

### Audit logger (`lib/mysql/audit-logger.ts`)

- File: `.mysql-audit.log` (gitignored, project root)
- Format per line: `{"ts":"ISO","sql":"SELECT … WHERE col = ?","duration_ms":42}`
- Params replaced with `?` — no actual values logged (no PII/data leakage)
- Append-only, sync write (dev-only — performance is not a concern)

### Privilege check (mandatory before Step 3 work begins)

```sql
SHOW GRANTS FOR CURRENT_USER();
```

Permitted grants: `SELECT`, `SHOW VIEW`, `PROCESS`, `EXECUTE`  
**Any other grant → STOP. Escalate to user. Do not proceed.**

---

## Section 5: Query-by-Query Migration Map

### All 27 RPC calls → `callSp()`

| Supabase `.rpc()` name | `callSp()` call | File |
|---|---|---|
| `refresh_admin_views` | **No-op** (returns `{ success: true }`) | `_actions/refresh-views.ts` |
| `dashboard_npp_list` | `callSp('dashboard_npp_list', {})` | `dashboard.ts` |
| `dashboard_categories` | `callSp('dashboard_categories', {})` | `dashboard.ts` |
| `dashboard_brands` | `callSp('dashboard_brands', {})` | `dashboard.ts` |
| `dashboard_channels` | `callSp('dashboard_channels', {})` | `dashboard.ts` |
| `dashboard_door_yearly` | `callSp('dashboard_door_yearly', {p_npp,p_nganh,p_thuong_hieu,p_kenh})` | `dashboard.ts` |
| `dashboard_door_monthly` | `callSp('dashboard_door_monthly', {p_npp,p_nganh,p_thuong_hieu,p_kenh})` | `dashboard.ts`, `ai-analysis/route.ts` |
| `dashboard_dpur_yearly` | `callSp('dashboard_dpur_yearly', {p_npp,p_nganh,p_thuong_hieu})` | `dashboard.ts` |
| `dashboard_dpur_monthly` | `callSp('dashboard_dpur_monthly', {p_npp,p_nganh,p_thuong_hieu})` | `dashboard.ts`, `ai-analysis/route.ts` |
| `dashboard_total_customer_count` | `callSp('dashboard_total_customer_count', {p_npp,p_nganh,p_thuong_hieu,p_kenh})` | `dashboard.ts` |
| `get_khach_hang_summary` | `callSp('get_khach_hang_summary', {p_npp})` | `khach-hang.ts` |
| `get_khach_hang_geo` | `callSp('get_khach_hang_geo', {p_npp})` | `khach-hang.ts` |
| `get_ton_kho_filter_options` | `callSp('get_ton_kho_filter_options', {})` | `ton-kho.ts` |
| `get_ton_kho_data` | `callSp('get_ton_kho_data', {…})` | `ton-kho.ts` |
| `get_check_customers_map_pins` | `callSp('get_check_customers_map_pins', {…})` | `check-customers.ts` |
| `get_check_customers_list` | `callSp('get_check_customers_list', {…})` | `check-customers.ts` |
| `get_door_npp_options` | `callSp('get_door_npp_options', {})` | `check-customers.ts` |
| `get_check_customers_class_options` | `callSp('get_check_customers_class_options', {})` | `check-customers.ts` |
| `get_check_customers_locations` | `callSp('get_check_customers_locations', {})` | `check-customers.ts` |
| `get_check_customers_autocomplete` | `callSp('get_check_customers_autocomplete', {…})` | `check-customers.ts` |
| `get_customer_revenue` | `callSp('get_customer_revenue', {…})` | `check-customers.ts` |
| `get_check_distributor_pivot` | `callSp('get_check_distributor_pivot', {…})` | `check-distributor.ts` |
| `get_check_distributor_filter_options` | `callSp('get_check_distributor_filter_options', {…})` | `check-distributor.ts` |
| `get_check_distributor_detail` | `callSp('get_check_distributor_detail', {…})` | `check-distributor.ts` |

*Note: `{…}` param sets confirmed at execution time by reading the service file body + running `DESCRIBE PROCEDURE RESULT sp_name` on MySQL.*

### Direct `.from()` table queries → `query()`

| Table | Query shape | File |
|---|---|---|
| `dpur` (DISTINCT Vnpp) | `SELECT DISTINCT \`Vnpp\` FROM \`dpur\` WHERE \`Vnpp\` IS NOT NULL ORDER BY \`Vnpp\`` | `npp-options.ts` |
| `dpur` (geo data) | Parameterized SELECT — columns confirmed via `DESCRIBE dpur` at connection | `dpur-geo.ts` |
| `dpur` (nhap-hang orders) | Parameterized SELECT with date/npp filters — confirmed at execution | `nhap-hang.ts` |
| `door` (dashboard monthly) | Parameterized SELECT with month/year/npp filters — confirmed at execution | `dashboard.ts` |
| `dpur` (dashboard monthly) | Parameterized SELECT with month/year/npp filters — confirmed at execution | `dashboard.ts` |
| `product` (SKU count) | `SELECT COUNT(*) AS count FROM \`product\`` | `dashboard.ts` |
| `mv_dashboard_kpis` (settings) | `SELECT * FROM \`mv_dashboard_kpis\` ORDER BY refreshed_at DESC LIMIT 1` | `settings/page.tsx` |

---

## Section 6: Environment & Configuration Plan

### `.env.local` additions (never committed)
```
MYSQL_HOST=14.225.203.126
MYSQL_PORT=3306
MYSQL_DATABASE=dashboard_bamboovet
MYSQL_USER=dashboard_bamboovet
MYSQL_PASSWORD=@Gapro800
MYSQL_SSL=true
```

### `.env.example` additions (committed — placeholder values only)
```
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=your-database-name
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_SSL=true
```

### Supabase env vars — unchanged
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — not modified.

---

## Section 7: Fallback & Rollback Strategy

### Inline comment format
Old Supabase code is commented out immediately above the new MySQL code:

```ts
// LEGACY SUPABASE: kept as fallback during MySQL migration
// const { data } = await db.rpc('dashboard_npp_list')
// const list = data ?? []

const list = await callSp<NppOption>('dashboard_npp_list', {})
```

### Per-service rollback
Uncomment the `LEGACY SUPABASE` block, delete the MySQL line. One-step, no branch switching.

### Full rollback
```bash
git checkout main -- lib/admin/services/
git checkout main -- app/api/ai-analysis/route.ts
git checkout main -- app/admin/_actions/refresh-views.ts
git checkout main -- app/admin/settings/page.tsx
```

### "Làm mới dữ liệu" button
`app/admin/_actions/refresh-views.ts` becomes a no-op returning `{ success: true }` immediately. The button still appears and responds — it just doesn't trigger a DB operation since MySQL tables are refreshed externally by the senior engineer.

---

## Section 8: Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Local IP not whitelisted on MySQL server | High | Blocker | First step in Step 2 — `SELECT 1` failure → report local public IP to user, wait for whitelist |
| SSL handshake fails (no cert on public-IP MySQL) | Medium | Minor delay | Fall back to `rejectUnauthorized: false`, flag as security note for senior |
| `dpur` vs `_dppur` table name mismatch | Low | Query errors | `SHOW TABLES` before writing any SELECT — resolve name before proceeding |
| Stored proc param order differs from Supabase | Low | Wrong data rendered | `DESCRIBE PROCEDURE RESULT` + compare output shape against Supabase baseline per service |
| MySQL user has write privileges | Low | Critical safety issue | `SHOW GRANTS` mandatory before any app code — write grants found → stop + escalate immediately |
| Public IP exposure of MySQL server | Confirmed | Security concern | Out of scope to fix; documented here as a finding for the senior (VPN/SSH tunnel recommended long-term) |
| Network latency (Vietnam → local dev) | High | Slow page loads in dev | Pool `connectTimeout: 10_000`; existing loading states handle slow responses gracefully |
| Product A conversations broken | Near-zero | Critical | `conversations`/`messages` tables never touched — Supabase client unchanged in chat routes |
| Validator bypass / comment-smuggling | Near-zero | Critical | Validator normalises SQL and strips block comments before first-token check |

---

## Section 9: Testing Strategy

### Pyramid (bottom → top, each layer gates the next)

**Layer 1 — Validator unit tests** (`lib/mysql/__tests__/validator.test.ts`)  
~40 cases, all must be green before any connection work:
- All dangerous keywords: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, RENAME, GRANT, REVOKE, MERGE, REPLACE, EXEC, EXECUTE, LOAD, OUTFILE, DUMPFILE
- Case variations: `DrOp tAbLe`, `  INSERT  `, `\nDELETE`
- Comment smuggling: `SELECT 1 /* DROP TABLE door */`
- Multi-statement: `SELECT 1; DELETE FROM door`
- CALL name injection: `CALL '; DROP TABLE door; --`
- Valid queries pass: `SELECT`, `SHOW TABLES`, `DESCRIBE door`, `WITH cte AS (...) SELECT`, `CALL dashboard_npp_list()`

**Layer 2 — Client unit tests** (`lib/mysql/__tests__/client.test.ts`)  
`vi.mock('mysql2/promise')` — no real DB connection:
- `query()` calls `validateQuery` before `pool.execute()`
- `callSp()` builds `CALL name(?,?,?)` correctly from params object
- Both call audit-logger on success and on error
- Pool enforces read-only session on connection

**Layer 3 — Per-service unit tests**  
`vi.mock('@/lib/mysql/client')` — mirror existing Supabase mock pattern:
- Each service function returns correct TypeScript shape
- Business logic preserved (revenue formula, `Dprogram_ID` exclusion, `Trntyp` filtering)
- Edge cases: empty results, null fields, date boundaries

**Layer 4 — Connection integration** (`scripts/test-mysql-connection.ts`)  
Run once manually during Step 2 (never imported by the app):
- `SELECT 1` — basic connectivity
- `SHOW GRANTS FOR CURRENT_USER()` — privilege verification
- `SHOW TABLES` — table name discovery (`dpur` vs `_dppur`)
- `DESCRIBE door`, `DESCRIBE dpur`, `DESCRIBE product` — column inventory
- Exits 0 on success, prints warnings on any mismatch

**Layer 5 — Playwright E2E** (primary verification, runs after each service file migrates)
- Every admin page loads and renders data (not empty, not error state)
- Filters work: month, NPP, category, brand
- AI Analysis Board functions end-to-end
- Supabase Auth login/logout still works
- Console: zero errors
- Screenshot comparison: before/after migration per page

**Audit log review** (after every service file migrated):
```bash
cat .mysql-audit.log | grep -v '^{"ts"' | head  # should return nothing
```
Every line must start with a `SELECT` or `CALL` fingerprint. Any other prefix → stop immediately.

---

## Success Criteria

- [ ] Every data query on admin dashboard reads from corporate MySQL
- [ ] Supabase Auth still works (login, session, Google OAuth)
- [ ] Zero non-SELECT/CALL queries executed (verified via audit log)
- [ ] MySQL user verified SELECT-only (`SHOW GRANTS`)
- [ ] Validator rejects all write/DDL statements (unit tests green)
- [ ] All queries parameterized — no string interpolation
- [ ] All admin pages render correctly (Playwright verified)
- [ ] Business logic preserved (revenue formula, `Dprogram_ID`, `Trntyp`)
- [ ] AI Analysis Board works with MySQL data
- [ ] Forecasting algorithm works with MySQL data
- [ ] Supabase data code commented (not deleted), ready for rollback
- [ ] Performance comparable to Supabase (documented)
- [ ] No existing features broken
- [ ] All tests pass (unit, integration, Playwright)
- [ ] Documentation complete

---

## Out of Scope

- Any deployment or hosting changes
- Replacing Supabase Auth
- Any schema changes to MySQL
- Any write operations to MySQL
- Scripts folder migration
- Changes to Product A (RAGflow chatbot)
- Fixing public IP exposure of corporate MySQL (finding documented; fix is DBA's responsibility)
