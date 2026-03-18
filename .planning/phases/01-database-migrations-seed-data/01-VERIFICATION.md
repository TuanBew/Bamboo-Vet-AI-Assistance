---
phase: 01-database-migrations-seed-data
verified: 2026-03-18T12:00:00Z
status: human_needed
score: 11/12 must-haves verified (automated); 1 requires human execution
re_verification: false
human_verification:
  - test: "Apply all 6 migration files to Supabase via SQL Editor in order (001-006), then run npx ts-node scripts/seed.ts, then run npx ts-node scripts/refresh-views.ts"
    expected: "Migrations apply without SQL errors; seed script prints completion summary (~20 clinics, 82 profiles, ~4000 conversations, ~20000 messages, ~4000 query_events, 120 kb_documents inserted/skipped); refresh-views.ts prints 'All 4 views refreshed successfully'; SELECT * FROM mv_dashboard_kpis returns 1 row with non-zero totals"
    why_human: "Database execution cannot be verified statically. The seed script programmatically generates bulk rows and calls auth.admin.createUser — these require a live Supabase connection and valid .env.local credentials to verify."
  - test: "Run seed script a second time (idempotency check)"
    expected: "Script exits 0, prints '0 inserted, N skipped' (or near-zero inserts) for clinics/kb_documents. Profiles reports all skipped. No duplicate-key errors."
    why_human: "Requires live database connection to confirm ON CONFLICT DO NOTHING behavior works in practice."
  - test: "Verify message timestamps (minor data quality issue)"
    expected: "Messages have created_at near their parent conversation's date, not near current date. Currently seed.ts line 487 uses Date.now() - randomInt(0,1000000) which generates timestamps within ~16 minutes of execution time regardless of conversation date."
    why_human: "This is a data quality issue, not a blocking schema issue. Materialized views are unaffected (they use conversations.created_at). A human should decide if message timestamps need correction for UI display."
---

# Phase 1: Database Migrations & Seed Data — Verification Report

**Phase Goal:** The Postgres schema is fully deployed and populated — every table, materialized view, unique index, RLS policy, and SECURITY DEFINER trigger exists; running scripts/seed.ts once fills the database with realistic 27-month analytics data; running refresh-views.ts succeeds without errors for all four views.

**Verified:** 2026-03-18T12:00:00Z
**Status:** human_needed (automated checks passed; database execution requires human verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Six numbered migration files exist in supabase/migrations/ in strict FK dependency order | VERIFIED | `ls supabase/migrations/` returns exactly 6 files: 001-006, alphanumeric order = dependency order |
| 2 | clinics table has all required columns including code UNIQUE | VERIFIED | Migration 001 contains `CREATE TABLE IF NOT EXISTS clinics` with all 10 columns; `code text NOT NULL UNIQUE` present |
| 3 | profiles table gains is_admin, clinic_id (FK clinics), province, district, lat, lng, user_type | VERIFIED | Migration 002 has all 7 `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements with correct types and FK |
| 4 | query_events table has conversation_id UNIQUE constraint, RLS allowing authenticated INSERT only | VERIFIED | Migration 003: `CONSTRAINT query_events_conversation_id_unique UNIQUE (conversation_id)` + policy `authenticated_insert_own_query_events` present |
| 5 | kb_documents table has doc_code UNIQUE, service-role-only RLS | VERIFIED | Migration 004: `doc_code text NOT NULL UNIQUE` + `service_role_all_kb_documents` policy present |
| 6 | SECURITY DEFINER trigger on auth.users auto-creates profiles row with ON CONFLICT DO NOTHING | VERIFIED | Migration 005: `handle_new_user()` function with `SECURITY DEFINER`, `ON CONFLICT (id) DO NOTHING`, trigger `on_auth_user_created AFTER INSERT ON auth.users` |
| 7 | Four materialized views exist; three with UNIQUE indexes for REFRESH CONCURRENTLY, one without | VERIFIED | Migration 006: all 4 views created; 3 `CREATE UNIQUE INDEX IF NOT EXISTS` statements; mv_dashboard_kpis has no unique index (confirmed by grep count = 3) |
| 8 | refresh-views.ts calls refresh_admin_views RPC function to refresh all 4 views | VERIFIED | `scripts/refresh-views.ts` line 36: `supabase.rpc('refresh_admin_views')`; error handling and env validation present |
| 9 | All materialized views use query_events (NOT chat_analytics) | VERIFIED | Migration 006: 3 occurrences of `JOIN query_events qe ON qe.conversation_id = c.id`; zero occurrences of `chat_analytics` |
| 10 | Seed data files exist with correct volumes: 20 clinics, 82 profiles, 210 conversations, 210 query_events, 120 kb_documents | VERIFIED | File row counts confirmed: clinics.md=20 data rows, profiles.md=82 data rows, conversations.md=210, query_events.md=210, kb_documents.md=120 |
| 11 | seed.ts is fully idempotent with markdown parser, auth user creation, bulk generation, completion summary | VERIFIED | scripts/seed.ts is 716 lines; contains `parseMdTable()`, `auth.admin.createUser` with try/catch, `onConflict` + `ignoreDuplicates: true` on all tables, completion summary with inserted/skipped per entity |
| 12 | Running seed.ts + refresh-views.ts succeeds without errors and populates all views | NEEDS HUMAN | Cannot verify database execution statically; requires live Supabase connection |

**Score:** 11/12 truths verified automatically; 1 requires human execution

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260318_001_create_clinics.sql` | clinics table DDL + RLS | VERIFIED | Contains `CREATE TABLE IF NOT EXISTS clinics` + `code text NOT NULL UNIQUE` + 2 RLS policies |
| `supabase/migrations/20260318_002_alter_profiles.sql` | profiles ALTER with admin columns | VERIFIED | Contains `is_admin boolean NOT NULL DEFAULT false` + `clinic_id uuid REFERENCES clinics(id)` + 5 other columns |
| `supabase/migrations/20260318_003_create_query_events.sql` | query_events table DDL + RLS | VERIFIED | Contains `CREATE TABLE IF NOT EXISTS query_events` + `UNIQUE (conversation_id)` + 2 RLS policies + 3 indexes |
| `supabase/migrations/20260318_004_create_kb_documents.sql` | kb_documents table DDL | VERIFIED | Contains `CREATE TABLE IF NOT EXISTS kb_documents` + `doc_code text NOT NULL UNIQUE` + service-role RLS |
| `supabase/migrations/20260318_005_add_profile_trigger.sql` | SECURITY DEFINER trigger | VERIFIED | Contains `handle_new_user()` SECURITY DEFINER function + `on_auth_user_created` trigger with `ON CONFLICT (id) DO NOTHING` |
| `supabase/migrations/20260318_006_create_materialized_views.sql` | 4 materialized views + refresh function | VERIFIED | Contains all 4 view definitions + 3 unique indexes + `refresh_admin_views()` SECURITY DEFINER function |
| `scripts/refresh-views.ts` | View refresh script | VERIFIED | 47 lines; calls `supabase.rpc('refresh_admin_views')`; validates env vars; exits 1 on error |
| `scripts/seed.ts` | Idempotent seed runner | VERIFIED | 716 lines; parseMdTable(); all 5 .md files referenced; auth.admin.createUser with try/catch; bulk generation; completion summary |
| `data/seeds/clinics.md` | 20 clinic rows | VERIFIED | 20 data rows; all columns filled; Vietnamese names; type distribution: phong_kham/nha_thuoc/thu_y/my_pham/khac |
| `data/seeds/profiles.md` | 82 profile rows (80 non-admin + 2 admin) | VERIFIED | 82 data rows; 2 rows with `| true |` (admin); clinic_id references valid clinic UUIDs from clinics.md |
| `data/seeds/conversations.md` | 210 template conversations | VERIFIED | 210 data rows; spanning Jan 2024–Mar 2026; Vietnamese titles |
| `data/seeds/query_events.md` | 210 query_events (1:1 with conversations) | VERIFIED | 210 data rows; same count as conversations.md confirming 1:1 relationship |
| `data/seeds/kb_documents.md` | 120 KB documents | VERIFIED | 120 data rows; no id column (auto-generated); doc_code as conflict key |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `20260318_002_alter_profiles.sql` | `20260318_001_create_clinics.sql` | clinic_id FK references clinics(id) | WIRED | `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id)` confirmed |
| `20260318_003_create_query_events.sql` | `supabase/schema.sql` | conversation_id FK references conversations(id) | WIRED | `conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE` confirmed |
| `20260318_006_create_materialized_views.sql` | `20260318_003_create_query_events.sql` | Views SELECT from query_events | WIRED | 3 JOIN clauses `JOIN query_events qe ON qe.conversation_id = c.id` confirmed; no chat_analytics |
| `scripts/refresh-views.ts` | `20260318_006_create_materialized_views.sql` | Calls refresh_admin_views Postgres function | WIRED | `supabase.rpc('refresh_admin_views')` confirmed; function defined in migration 006 |
| `data/seeds/profiles.md` | `data/seeds/clinics.md` | clinic_id column references clinic UUIDs | WIRED | profiles.md column 5 is clinic_id; values use `c0a10001-...` prefix matching clinics.md IDs |
| `data/seeds/query_events.md` | `data/seeds/conversations.md` | conversation_id references conversation IDs | WIRED | Both files have 210 rows; conversation_id column present in query_events.md header |
| `scripts/seed.ts` | `data/seeds/clinics.md` | Parses markdown table for clinic rows | WIRED | `parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'clinics.md'))` at line 204 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DB-01 | 01-01 | Profiles auto-created by SECURITY DEFINER trigger on auth.users insert with geographic fields | SATISFIED (partial) | Migration 005 implements trigger with ON CONFLICT DO NOTHING. NOTE: REQUIREMENTS.md specifies `ward, region, facility_code, staff_code` but plan-phase args overrode spec — migration 002 implements `is_admin, clinic_id, province, district, lat, lng, user_type` instead. Schema override is documented in CONTEXT.md as deliberate. |
| DB-02 | 01-01 | profiles.is_admin defaults to false | SATISFIED | Migration 002: `is_admin boolean NOT NULL DEFAULT false` confirmed |
| DB-03 | 01-01 | chat_analytics table (spec name) — implemented as query_events (schema override) | SATISFIED | query_events table with drug_category, animal_type, query_type, service-role read RLS; schema override documented in CONTEXT.md |
| DB-04 | 01-01 | kb_documents table | SATISFIED | Migration 004: all required columns (doc_code, doc_name, chunk_count, doc_type, category, drug_group, source, relevance_score, status) present |
| DB-05 | 01-01 | mv_monthly_queries with UNIQUE INDEX (user_id, year, month) | SATISFIED | Migration 006: view defined + `idx_mv_monthly_queries_unique ON mv_monthly_queries (user_id, year, month)` |
| DB-06 | 01-01 | mv_daily_queries with UNIQUE INDEX (user_id, year, month, day) | SATISFIED | Migration 006: view defined + `idx_mv_daily_queries_unique ON mv_daily_queries (user_id, year, month, day)` |
| DB-07 | 01-01 | mv_category_stats with UNIQUE INDEX on all 7 columns | SATISFIED | Migration 006: view defined + `idx_mv_category_stats_unique ON mv_category_stats (year, month, province, clinic_type, drug_category, animal_type, query_type)` |
| DB-08 | 01-01 | mv_dashboard_kpis single-row aggregate, plain REFRESH only | SATISFIED | Migration 006: view defined; comment confirms no unique index; refresh_admin_views() uses plain `REFRESH MATERIALIZED VIEW mv_dashboard_kpis` |
| DB-09 | 01-02, 01-03 | Seed 82 profiles (80 non-admin + 2 admin) with geographic/clinic-type distributions | SATISFIED | profiles.md: 82 rows, 2 admin; seed.ts: auth.admin.createUser per profile; geographic distribution matches spec per SUMMARY |
| DB-10 | 01-02, 01-03 | ~4000 conversations + ~20000 messages + ~4000 query_events with volume curve | SATISFIED (requires human for execution) | seed.ts: getMonthlyTarget() implements 80/month (2024), 180/month (2025 H1), 320/month (2025 H2), 280/month (2026 Q1); bulk generation logic present; 210 template rows; actual DB insertion needs human verification |
| DB-11 | 01-02, 01-03 | 120 kb_documents with 8 drug categories, 3 doc types, relevance 0.60-0.99 | SATISFIED | kb_documents.md: 120 rows confirmed; doc_type column header present; seed.ts: parses and inserts without id column |
| DB-12 | 01-01, 01-03 | refresh-views.ts refreshes 4 views (3 CONCURRENTLY, 1 plain) via service role | SATISFIED | refresh-views.ts calls supabase.rpc('refresh_admin_views'); function in migration 006 executes 3 CONCURRENTLY + 1 plain REFRESH |

**All 12 DB requirements have code evidence. DB-10 requires human execution verification for actual row counts.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/seed.ts` | 487 | `// placeholder` comment on message `created_at` — uses `Date.now() - randomInt(0, 1000000)` instead of conversation's actual date | Warning | Messages will have timestamps within ~16 minutes of seed execution time, not aligned with parent conversation dates (Jan 2024–Mar 2026). Materialized views are unaffected (they use `conversations.created_at` for time grouping). UI pages showing message-level timestamps may display incorrect dates. |

No migration SQL anti-patterns found. No empty implementations in migration files or refresh-views.ts.

---

### Human Verification Required

#### 1. Apply Migrations and Verify Schema

**Test:** Open Supabase Dashboard SQL Editor. Run each migration file in order (001 through 006). After each, check for SQL errors.

**Expected:** All 6 migrations apply without errors. Verify tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('clinics', 'profiles', 'query_events', 'kb_documents');
-- Should return 4 rows

SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
-- Should return: mv_monthly_queries, mv_daily_queries, mv_category_stats, mv_dashboard_kpis

SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';
-- Should include: on_auth_user_created

SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('clinics', 'profiles', 'query_events', 'kb_documents');
-- Should show 2 policies for clinics, 3 for profiles, 2 for query_events, 1 for kb_documents
```

**Why human:** SQL execution against a live Supabase instance cannot be performed statically.

---

#### 2. Run Seed Script and Verify Data Volumes

**Test:** Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Run:
```
npx ts-node scripts/seed.ts
```

**Expected output (approximate):**
```
=== Bamboo Vet Seed Script ===
...
=== Seed Complete ===
Clinics:       20 inserted, 0 skipped
Profiles:      82 inserted, 0 skipped
Conversations: ~3800+ inserted, 0 skipped
Messages:      ~15000-20000 inserted, 0 skipped
Query Events:  ~3800+ inserted, 0 skipped
KB Documents:  120 inserted, 0 skipped
```

**Why human:** auth.admin.createUser and bulk DB inserts require a live Supabase connection.

---

#### 3. Run Seed Script a Second Time (Idempotency Check)

**Test:** Run `npx ts-node scripts/seed.ts` a second time immediately after the first run.

**Expected:** Script exits 0. No duplicate-key errors. Clinics and KB Documents show "0 inserted, N skipped". Profiles show "0 inserted, 82 skipped". Conversations/Messages/Query Events show near-zero new inserts (existing count check prevents regeneration).

**Why human:** Idempotency requires actual DB state to verify.

---

#### 4. Run refresh-views.ts and Verify View Data

**Test:** After seeding, run:
```
npx ts-node scripts/refresh-views.ts
```
Then in SQL Editor:
```sql
SELECT COUNT(*) FROM mv_monthly_queries;   -- should be > 0
SELECT COUNT(*) FROM mv_daily_queries;     -- should be > 0
SELECT COUNT(*) FROM mv_category_stats;    -- should be > 0
SELECT * FROM mv_dashboard_kpis;           -- should be 1 row with non-zero totals
```

**Expected:** Script prints "All 4 views refreshed successfully (Nms)". All view queries return non-zero row counts. mv_dashboard_kpis shows total_sessions > 0, total_queries > 0, total_users > 0, total_documents = 120, total_staff = 80.

**Why human:** View refresh requires live connection; the `refresh_admin_views()` function must exist in the database.

---

#### 5. Message Timestamp Data Quality Decision

**Test:** After seeding, run:
```sql
SELECT m.created_at, c.created_at as conversation_date
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
LIMIT 5;
```

**Expected:** Decide whether message timestamps need to match conversation dates. Currently `scripts/seed.ts:487` uses `Date.now()` with a small random offset rather than the conversation's actual date.

**Why human:** This is a product decision — the materialized views are unaffected, but UI pages displaying individual message timestamps may show incorrect historical dates.

---

### Notes on Schema Override (DB-01 / DB-03)

REQUIREMENTS.md DB-01 specifies geographic fields including `ward`, `region`, `facility_code`, and `staff_code` which do NOT appear in migration 002. REQUIREMENTS.md DB-03 refers to a table named `chat_analytics` which was replaced by `query_events`. These are deliberate overrides documented in `01-CONTEXT.md` ("Schema decisions that override the spec"). The CONTEXT.md states these are "LOCKED by plan-phase args" — the user explicitly changed the schema before planning. Both requirements are marked SATISFIED against the overridden schema.

---

### Gaps Summary

No gaps blocking the phase goal at the code artifact level. All 13 key artifacts exist, are substantive (no stubs), and are properly wired. The phase is blocked only by the need for a human to execute the scripts against a live database to confirm the 27-month analytics data populates correctly.

The one code-level warning (message timestamp placeholder at seed.ts:487) does not block the phase goal because materialized views use `conversations.created_at` for time grouping, not `messages.created_at`. The messages table is not queried in any materialized view.

---

_Verified: 2026-03-18T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
