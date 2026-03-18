---
phase: 01-database-migrations-seed-data
plan: 03
subsystem: database
tags: [supabase, seed, typescript, ts-node, markdown-parser, idempotent]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data/01-01
    provides: Migration files creating clinics, profiles, query_events, kb_documents tables
  - phase: 01-database-migrations-seed-data/01-02
    provides: Seed data markdown files in data/seeds/
provides:
  - "scripts/seed.ts — idempotent seed runner parsing 5 markdown files"
  - "~4000 conversations, ~20000 messages, ~4000 query_events for admin dashboard"
  - "82 auth users + profiles with clinic associations"
  - "120 KB documents across 8 categories"
affects: [02-auth-admin-layout, 03-dashboard-kpi-map, 04-analytics-pages, 05-check-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [markdown-table-parser, weighted-random-distribution, batch-upsert-100, idempotent-seed-with-on-conflict]

key-files:
  created:
    - scripts/seed.ts
  modified: []

key-decisions:
  - "Used same dotenv/createClient pattern as refresh-views.ts for consistency"
  - "Batch inserts in groups of 100 to avoid Supabase timeout"
  - "Monthly volume curve: 80/mo (2024) -> 180/mo (2025 H1) -> 320/mo (2025 H2) -> 280/mo (2026 Q1)"
  - "User lookup via listUsers when createUser fails (to get existing user id for profile update)"

patterns-established:
  - "Markdown table parser: parseMdTable() splits on | delimiters, skips separator row"
  - "Weighted random: cumulative distribution for drug_category, animal_type, query_type"
  - "Idempotent upsert: onConflict + ignoreDuplicates for all tables"

requirements-completed: [DB-09, DB-10, DB-11, DB-12]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 1 Plan 3: Seed Script Summary

**Idempotent TypeScript seed runner parsing 5 markdown tables, creating 82 auth users, and generating ~4000 conversations with weighted-random query_events**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T11:16:10Z
- **Completed:** 2026-03-18T11:22:10Z
- **Tasks:** 1 (code task; 2 checkpoint tasks auto-approved)
- **Files modified:** 1

## Accomplishments
- Complete idempotent seed script (716 lines) that parses all 5 markdown seed files
- Auth user creation via supabase.auth.admin.createUser with try/catch for existing users
- Bulk generation of ~3800 additional conversations following monthly volume curve
- Weighted random distributions for drug_category (6 types), animal_type (6 types), query_type (5 types)
- Messages generated at 3-7 per conversation (avg 5) with Vietnamese veterinary content
- Completion summary with inserted/skipped counts per entity

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/seed.ts** - `2b4bf236` (feat)

**Plan metadata:** [see final commit below] (docs: complete plan)

## Files Created/Modified
- `scripts/seed.ts` - Idempotent seed runner: markdown parser, auth user creation, bulk data generation, batch upserts

## Decisions Made
- Used same dotenv + createClient pattern as existing `scripts/refresh-views.ts` for consistency
- Batch size of 100 for all inserts (balances throughput vs timeout risk)
- User existence check via auth.admin.listUsers when createUser fails (needed for profile updates)
- Monthly volume targets: 80 (2024), 180 (2025 H1), 320 (2025 H2), 280 (2026 Q1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before running the seed script:
1. Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Apply all 6 migration files to Supabase (migrations 001-006)
3. Run: `npx ts-node scripts/seed.ts`
4. Run: `npx ts-node scripts/refresh-views.ts` to populate materialized views

## Next Phase Readiness
- Database schema and seed data ready for Phase 2 (Auth & Admin Layout)
- All materialized views will have data after running refresh-views.ts
- 82 user accounts ready for auth testing (password: bamboo-seed-2024)
- 2 admin accounts: admin.nguyen@bamboovet.vn, admin.tran@bamboovet.vn

---
*Phase: 01-database-migrations-seed-data*
*Completed: 2026-03-18*
