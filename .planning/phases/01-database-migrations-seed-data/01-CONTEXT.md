# Phase 1: Database Migrations & Seed Data - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the full Postgres schema for the admin dashboard: 3 new tables (`profiles`, `chat_analytics`, `kb_documents`), 4 materialized views with unique indexes, RLS policies, a `SECURITY DEFINER` trigger for auto-profile creation, and idempotent seed scripts that fill 27 months of realistic analytics data. No UI. No API routes. No auth guards. Just schema + data.

</domain>

<decisions>
## Implementation Decisions

### Migration Order & Existing Table Risks

- **File order** (strict dependency chain):
  1. `YYYYMMDD_add_profiles.sql` — profiles table + RLS + UNIQUE constraint on `facility_code`
  2. `YYYYMMDD_add_chat_analytics.sql` — chat_analytics table + RLS (references `profiles.id` and `conversations.id`)
  3. `YYYYMMDD_add_kb_documents.sql` — kb_documents table + RLS (standalone, no FK deps on new tables)
  4. `YYYYMMDD_add_materialized_views.sql` — all 4 views + unique indexes (depends on ALL tables above + existing `conversations` + `messages`)
  5. `YYYYMMDD_add_profile_trigger.sql` — `handle_new_user()` SECURITY DEFINER trigger (must come after `profiles` exists; placed last to avoid partial-state issues)

- **Existing table risk: ZERO** — Phase 1 adds only new tables. `conversations` and `messages` are read by materialized views (JOIN only) — no ALTER TABLE, no schema change, no RLS modification on existing tables.
- **Risk area: `auth.users` foreign key** — `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`. Migration must not run if `auth.users` is unavailable (it isn't in managed Supabase, but worth noting).
- **Risk area: `chat_analytics` references `profiles`** — migration 2 must run after migration 1 completes. Numbered filenames + sequential execution in the seed script enforces this.
- **Migration file naming**: Use real date prefix (e.g., `20260318_add_profiles.sql`). Supabase CLI reads migrations in alphanumeric order; timestamps guarantee order.
- **Migration location**: `supabase/migrations/` (new directory — does not exist yet; planner must create it).

### Seed Data Approach

- **Claude's full discretion** — the agent decides all specific content (names, emails, clinic names, facility codes, message text, document names, etc.). The agent follows the spec's volume and distribution tables exactly but generates all actual data values autonomously.
- **Spec volumes to follow precisely** (these are locked, not discretionary):
  - 80 non-admin profiles + 2 admin profiles = 82 total
  - ~4,000 conversations (one `chat_analytics` row per conversation)
  - ~20,000 messages (avg 5 per conversation, mix of `user` + `assistant` roles)
  - 120 `kb_documents`
- **Spec distributions to follow precisely**:
  - Geographic: Hà Nội 15, TP.HCM 18, Đà Nẵng 8, Bình Dương 7, Đồng Nai 6, Cần Thơ 5, Hải Phòng 5, Nghệ An 4, Lâm Đồng 4, Khác 8
  - Clinic type: `phong_kham` 28, `nha_thuoc` 22, `thu_y` 18, `my_pham` 8, `khac` 4
  - Monthly query volume: 2024 ~80/month, 2025 H1 ~180/month, 2025 H2 ~320/month, 2026 Q1 ~280/month
  - Drug groups: kháng sinh 35%, vitamin 20%, vắc-xin 18%, hormone 12%, kháng ký sinh trùng 10%, khác 5%
  - Animal types: trâu bò 30%, lợn 25%, gà 20%, chó mèo 15%, thủy sản 7%, khác 3%
  - Query types: điều trị 35%, chẩn đoán 28%, liều lượng 20%, phòng bệnh 12%, khác 5%
- **Seed data files**: `data/seeds/` directory (new). One TypeScript module per entity: `profiles.ts`, `conversations.ts`, `messages.ts`, `chat_analytics.ts`, `kb_documents.ts`. Each exports a typed array — no inline generation logic in the entry script.
- **Auth user creation**: Use `supabase.auth.admin.createUser({ email, password, email_confirm: true })` for each seeded user. This creates the `auth.users` row; the trigger then auto-creates the `profiles` row. After trigger fires, a second `UPDATE profiles SET ...` adds geographic/clinic fields.
- **Admin users**: 2 admin profiles promoted via `UPDATE profiles SET is_admin = true WHERE email IN (...)` at the end of the seed script.
- **Time range**: January 2024 → March 2026 (27 months). Conversations are distributed across this range per the volume schedule above.

### Idempotent Upsert Strategy

- **Primary guard (seed entry script)**: Before inserting anything, `SELECT COUNT(*) FROM profiles` — if `> 0`, print "Already seeded — skipping" and exit with code 0. This is the fast path for accidental re-runs.
- **Secondary guard (individual upserts)**: All data tables use `INSERT ... ON CONFLICT DO NOTHING`:
  - `profiles`: conflict on `id` (primary key = auth user UUID)
  - `conversations`: conflict on `id`
  - `messages`: conflict on `id`
  - `chat_analytics`: conflict on `conversation_id` (one analytics row per conversation; add UNIQUE constraint on `conversation_id`)
  - `kb_documents`: conflict on `doc_code` (add UNIQUE constraint on `doc_code`)
- **Auth user idempotency**: `supabase.auth.admin.createUser()` throws if user already exists. Wrap in try/catch — catch `User already registered` errors and continue. Log the skip.
- **Materialized view refresh**: `scripts/refresh-views.ts` runs after seed completes. Uses `REFRESH MATERIALIZED VIEW CONCURRENTLY` for `mv_monthly_queries`, `mv_daily_queries`, `mv_category_stats`. Uses plain `REFRESH MATERIALIZED VIEW` for `mv_dashboard_kpis` (cannot use CONCURRENTLY — single-row aggregate with no unique key).
- **Run command**: `npx tsx scripts/seed.ts && npx tsx scripts/refresh-views.ts`

### Claude's Discretion

- All specific data values in seed files (names, addresses, message content, document names, relevance scores within spec range 0.60–0.99)
- Exact date/time distribution of conversations within each month
- Per-user query volume variation (spec says: heavy >50/month = ~15% of users, medium 10–50 = ~50%, light <10 = ~35%)
- KB document chunk counts (spec says 10–200 per doc)
- TypeScript types and interfaces for seed data arrays

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Data Model
- `docs/2026-03-18-admin-dashboard-design.md` §3 — Full table DDL for `profiles`, `chat_analytics`, `kb_documents`, all 4 materialized views, RLS policies, trigger definition
- `docs/2026-03-18-admin-dashboard-design.md` §9 — Seed data strategy: volumes, geographic distribution, clinic type distribution, query volume schedule, category distributions

### Existing Schema (read before writing migrations)
- `supabase/schema.sql` — Existing `conversations` and `messages` tables; existing `update_conversation_timestamp` SECURITY DEFINER trigger; existing RLS policies. Migrations must not alter any of this.

### Project Requirements
- `.planning/REQUIREMENTS.md` — DB-01 through DB-12: all Phase 1 requirements with acceptance criteria

### Pitfalls (mandatory reading before implementation)
- `.planning/research/PITFALLS.md` — Items #1–#6 are Phase 1 relevant: migration file uniqueness, SECURITY DEFINER trigger, unique indexes in same migration file as view creation, `mv_dashboard_kpis` non-concurrent refresh constraint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/server.ts` — exports `createServiceClient()` (service role, bypasses RLS) and `createClient()` (anon). Seed script must use `createServiceClient()` for all DB writes and `supabase.auth.admin.*` for user management.
- Existing trigger pattern in `supabase/schema.sql` (`update_conversation_timestamp`): existing SECURITY DEFINER trigger for reference — same pattern for `handle_new_user()`.

### Established Patterns
- **No existing migrations directory**: `supabase/migrations/` does not exist. Must be created. Current schema lives in `supabase/schema.sql` (monolithic). New additions use separate migration files — do NOT modify `schema.sql`.
- **No existing scripts directory**: `scripts/` does not exist. Must be created.
- **TypeScript everywhere**: project uses strict TypeScript. Seed files and scripts must be `.ts`, run via `npx tsx`.
- **Environment**: Supabase URL and keys in `.env.local` (gitignored). Seed script reads from `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY`.

### Integration Points
- `supabase/schema.sql` — existing schema; read before writing migrations to avoid conflicts
- `auth.users` (Supabase managed) — profiles FK target; trigger fires on INSERT here
- `.env.local` — service role key needed by seed script and refresh-views script

</code_context>

<specifics>
## Specific Ideas

- Migration filenames use today's date prefix: `20260318_add_profiles.sql`, `20260318_add_chat_analytics.sql`, etc. (same-day migrations = alphanumeric order matches dependency order)
- The `chat_analytics` table needs a `UNIQUE (conversation_id)` constraint (not in spec DDL but required for seed idempotency ON CONFLICT)
- The `kb_documents` table needs a `UNIQUE (doc_code)` constraint (same reason)
- These UNIQUE constraints should be added in the same migration file as each table's CREATE TABLE statement

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-migrations-seed-data*
*Context gathered: 2026-03-18*
