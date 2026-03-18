---
phase: 01-database-migrations-seed-data
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, rls, materialized-views, triggers]

# Dependency graph
requires: []
provides:
  - clinics table with RLS
  - profiles ALTER with admin/clinic columns
  - query_events table with conversation_id UNIQUE
  - kb_documents table with service-role RLS
  - SECURITY DEFINER trigger for auto profile creation
  - 4 materialized views (mv_monthly_queries, mv_daily_queries, mv_category_stats, mv_dashboard_kpis)
  - refresh_admin_views() Postgres function
  - refresh-views.ts script
affects: [01-02-seed-data, 02-auth-admin-guards, 03-dashboard-api, 04-analytics-pages]

# Tech tracking
tech-stack:
  added: [dotenv]
  patterns: [numbered-migration-files, IF-NOT-EXISTS-guards, SECURITY-DEFINER-functions, materialized-view-refresh-via-rpc]

key-files:
  created:
    - supabase/migrations/20260318_001_create_clinics.sql
    - supabase/migrations/20260318_002_alter_profiles.sql
    - supabase/migrations/20260318_003_create_query_events.sql
    - supabase/migrations/20260318_004_create_kb_documents.sql
    - supabase/migrations/20260318_005_add_profile_trigger.sql
    - supabase/migrations/20260318_006_create_materialized_views.sql
    - scripts/refresh-views.ts
  modified: []

key-decisions:
  - "All migrations use IF NOT EXISTS / IF EXISTS guards for idempotent re-runs"
  - "profiles table created if missing then ALTERed — handles both fresh and existing Supabase setups"
  - "RLS policies checked via pg_policies before creation to avoid duplicates"

patterns-established:
  - "Migration numbering: 20260318_NNN_description.sql — alphanumeric sort equals dependency order"
  - "Service role for admin reads, authenticated for user writes — consistent RLS pattern across all 4 tables"
  - "Materialized view refresh via supabase.rpc() calling a SECURITY DEFINER function"

requirements-completed: [DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-12]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 1 Plan 1: Database Migrations & Views Summary

**6 Supabase migration files with clinics, profiles ALTER, query_events, kb_documents, SECURITY DEFINER trigger, 4 materialized views, and refresh_admin_views() RPC function**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T11:00:23Z
- **Completed:** 2026-03-18T11:02:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created 6 numbered SQL migration files in strict FK dependency order
- All 4 tables (clinics, profiles, query_events, kb_documents) have RLS policies
- 4 materialized views with 3 UNIQUE indexes (for CONCURRENTLY refresh) and 1 without
- refresh_admin_views() Postgres function callable via supabase.rpc()
- refresh-views.ts script with dotenv loading and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 6 migration SQL files** - `a56ec350` (feat)
2. **Task 2: Create refresh-views.ts script** - `842122b7` (feat)

## Files Created/Modified
- `supabase/migrations/20260318_001_create_clinics.sql` - Clinics table with RLS
- `supabase/migrations/20260318_002_alter_profiles.sql` - Profiles ALTER with admin columns, idempotent policies
- `supabase/migrations/20260318_003_create_query_events.sql` - Query events with conversation_id UNIQUE, indexes
- `supabase/migrations/20260318_004_create_kb_documents.sql` - KB documents with service-role RLS
- `supabase/migrations/20260318_005_add_profile_trigger.sql` - SECURITY DEFINER trigger for auto profile creation
- `supabase/migrations/20260318_006_create_materialized_views.sql` - 4 materialized views + refresh function
- `scripts/refresh-views.ts` - View refresh script using supabase.rpc()

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All table schemas ready for seed data (Plan 01-02)
- Materialized views ready for dashboard API queries (Phase 3+)
- Trigger ready for auth user creation in seed script

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (a56ec350, 842122b7) verified in git log.

---
*Phase: 01-database-migrations-seed-data*
*Completed: 2026-03-18*
