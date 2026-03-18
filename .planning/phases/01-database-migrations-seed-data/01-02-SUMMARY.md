---
phase: 01-database-migrations-seed-data
plan: 02
subsystem: database
tags: [seed-data, markdown-tables, vietnamese, analytics]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data (plan 01)
    provides: Migration SQL files defining clinics, profiles, query_events, kb_documents tables
provides:
  - 5 markdown seed data files in data/seeds/ with complete Vietnamese veterinary data
  - 20 clinics across 12 provinces
  - 82 user profiles (80 non-admin + 2 admin) with exact geographic and clinic type distributions
  - 210 conversations + 210 query_events covering Jan 2024 to Mar 2026
  - 120 KB documents across 8 categories
affects: [01-03-seed-script, phase-03-dashboard, phase-05-check-clinics]

# Tech tracking
tech-stack:
  added: []
  patterns: [markdown-table-seed-format, uuid-prefix-convention, deterministic-seed-generation]

key-files:
  created:
    - data/seeds/clinics.md
    - data/seeds/profiles.md
    - data/seeds/conversations.md
    - data/seeds/query_events.md
    - data/seeds/kb_documents.md
  modified: []

key-decisions:
  - "Added 2 extra clinics (Thai Nguyen thu_y, Khanh Hoa my_pham) to support Others province users while maintaining exact type distribution"
  - "Used deterministic seeded RNG in generator scripts for reproducible data"
  - "210 template rows for conversations/query_events (seed script will amplify to ~4000)"
  - "Others province mapped to Thua Thien Hue + Thai Nguyen + Khanh Hoa"

patterns-established:
  - "UUID prefix convention: c0a1... for clinics, p0a2... for profiles, cv... for conversations, qe... for query_events"
  - "Seed files use pipe-delimited markdown tables parseable by simple regex"

requirements-completed: [DB-09, DB-10, DB-11]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 01 Plan 02: Seed Data Summary

**5 markdown seed files with 632 total rows of realistic Vietnamese veterinary data covering 27 months, exact geographic/type distributions, and all 3 clinic activity color states**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T11:05:06Z
- **Completed:** 2026-03-18T11:12:44Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments
- Created 20 clinics across 12 Vietnamese provinces with realistic coordinates and names
- Built exactly 82 user profiles matching mandatory province distribution (15 HN, 18 HCM, etc.) and clinic type distribution (28 phong_kham, 22 nha_thuoc, 18 thu_y, 8 my_pham, 4 khac)
- Generated 210 paired conversation/query_event rows with volume growth curve (3/month early 2024 to 12/month late 2025)
- Created 120 KB documents across 8 veterinary categories with correct doc_type and status distributions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create clinics.md seed data** - `e00b8d90` (feat)
2. **Task 2: Create profiles.md seed data** - `a6464b6a` (feat)
3. **Task 3: Create conversations.md and query_events.md** - `0f89848f` (feat)
4. **Task 4: Create kb_documents.md seed data** - `4ba791cd` (feat)

## Files Created/Modified
- `data/seeds/clinics.md` - 20 clinic rows with Vietnamese names, coordinates, type distribution
- `data/seeds/profiles.md` - 82 user profiles (80 non-admin + 2 admin) with exact distributions
- `data/seeds/conversations.md` - 210 conversation stubs spanning Jan 2024 to Mar 2026
- `data/seeds/query_events.md` - 210 query events with category distributions and response times
- `data/seeds/kb_documents.md` - 120 knowledge base documents across 8 categories

## Decisions Made
- Added 2 extra clinics to clinics.md (Thai Nguyen thu_y, Khanh Hoa my_pham) so that "Others" province users could have proper clinic_id FKs while maintaining exact type distribution counts
- Used node.js generator scripts with deterministic seeded RNG for reproducible data generation (scripts removed after use)
- Mapped "Others (mixed) = 8" to 3 provinces: Thua Thien Hue (4 khac), Thai Nguyen (2 thu_y), Khanh Hoa (2 my_pham)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added 2 extra clinics for Others province coverage**
- **Found during:** Task 2 (profiles.md creation)
- **Issue:** Original 18 clinics only covered 9 named provinces. The spec requires 8 users in "Others (mixed)" provinces with correct clinic types (thu_y + my_pham quotas), but no clinics existed in Other provinces for those types.
- **Fix:** Added clinic 019 (thu_y, Thai Nguyen) and clinic 020 (my_pham, Khanh Hoa) to clinics.md
- **Files modified:** data/seeds/clinics.md
- **Verification:** Province and type distributions both verified exact
- **Committed in:** a6464b6a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy both province and type distribution constraints simultaneously. No scope creep.

## Issues Encountered
None - all tasks executed successfully after the clinic addition.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 seed data files ready for Plan 03 (seed script) to parse and insert into database
- FK references are consistent across all files
- Seed script will need to amplify 210 template rows to ~4000 conversations/query_events

---
*Phase: 01-database-migrations-seed-data*
*Completed: 2026-03-18*
