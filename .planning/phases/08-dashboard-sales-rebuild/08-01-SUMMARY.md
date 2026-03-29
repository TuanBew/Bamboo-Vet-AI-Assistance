---
phase: 08-dashboard-sales-rebuild
plan: 01
subsystem: database
tags: [sql, migration, seed, sidebar, i18n]

requires:
  - phase: 06-security-polish
    provides: "customers, customer_purchases, distributor_staff tables"
provides:
  - "staff_id FK on customer_purchases for staff performance queries"
  - "supplier_id FK on customers for NPP filtering"
  - "Cleaned sidebar (no check-users/check-clinics)"
  - "Vietnamese dashboard sales keys for new dashboard UI"
  - "Seed script staff_id assignment step"
affects: [08-dashboard-sales-rebuild]

tech-stack:
  added: []
  patterns: ["ALTER TABLE ADD COLUMN IF NOT EXISTS for incremental schema evolution"]

key-files:
  created:
    - supabase/migrations/20260329_011_add_staff_id_to_customer_purchases.sql
  modified:
    - scripts/seed-sales.ts
    - components/admin/AdminSidebar.tsx
    - lib/i18n/vietnamese.ts

key-decisions:
  - "Kept legacy chatbot dashboard VI keys with deprecation comment to avoid breaking current DashboardClient.tsx"
  - "check-users/check-clinics service files left intact (only page/API directories deleted)"

patterns-established:
  - "Legacy key retention: mark deprecated keys with comment, remove when consumer is rewritten"

requirements-completed: [DASH2-01]

duration: 4min
completed: 2026-03-29
---

# Phase 8 Plan 01: Data Prerequisites + Page Cleanup Summary

**Migration 011 adds staff_id/supplier_id FKs, deletes check-users/check-clinics pages, updates sidebar and VI dictionary with sales dashboard keys**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T10:33:47Z
- **Completed:** 2026-03-29T10:38:01Z
- **Tasks:** 2
- **Files modified:** 13 (12 in Task 1 including deletions, 1 in Task 2)

## Accomplishments
- Migration 011 adds staff_id FK to customer_purchases and supplier_id FK to customers with indexes
- Deleted 5 directories: check-users pages, check-clinics pages, users API (9 files total)
- AdminSidebar reduced from 4 to 2 items in CHECKED section
- Vietnamese dictionary updated with 22 new sales dashboard keys
- Seed script extended with idempotent staff_id assignment step using deterministic hash

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Migration 011 + delete check-users/check-clinics files + update sidebar** - `ec96e974` (feat)
2. **Task 2: Update seed script to assign staff_id to customer_purchases** - `7ac17d3e` (feat)

## Files Created/Modified
- `supabase/migrations/20260329_011_add_staff_id_to_customer_purchases.sql` - Adds staff_id FK to customer_purchases + supplier_id FK to customers
- `components/admin/AdminSidebar.tsx` - Removed check-users/check-clinics nav items and MessageSquare/Hospital icons
- `lib/i18n/vietnamese.ts` - Removed nav.checkUsers/checkClinics, added 22 new dashboard sales keys, kept legacy keys with deprecation comment
- `scripts/seed-sales.ts` - New step 6/6 assigns staff_id to customer_purchases via distributor_staff lookup
- Deleted: `app/admin/check-users/`, `app/admin/check-clinics/`, `app/api/admin/check-users/`, `app/api/admin/check-clinics/`, `app/api/admin/users/`

## Decisions Made
- Kept legacy chatbot dashboard VI keys (totalSessions, byDrugGroup, etc.) with deprecation comment because current DashboardClient.tsx still references them. Removing them would break tsc. They will be removed when DashboardClient.tsx is rewritten in Plan 02+.
- Left check-users and check-clinics service files (lib/admin/services/) intact since they are not imported anywhere after page deletion and may be useful reference for future work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retained legacy dashboard VI keys to prevent TypeScript errors**
- **Found during:** Task 1 (Vietnamese dictionary update)
- **Issue:** Plan instructed removing chatbot-specific keys (totalSessions, byDrugGroup, etc.) but DashboardClient.tsx still references them, causing tsc failure
- **Fix:** Kept legacy keys with deprecation comment marking them for removal when dashboard is rebuilt
- **Files modified:** lib/i18n/vietnamese.ts
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** ec96e974 (Task 1 commit)

**2. [Rule 3 - Blocking] Cleaned .next/types cache after deleting page directories**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** .next/types/validator.ts had stale references to deleted check-users/check-clinics modules
- **Fix:** Deleted .next/types/ directory (generated cache, regenerated on next build)
- **Verification:** npx tsc --noEmit passes clean after cache clear

---

**Total deviations:** 2 auto-fixed (1 bug prevention, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for build correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required. Migration 011 must be applied to the live database before running seed-sales.ts.

## Next Phase Readiness
- Migration 011 ready to apply (staff_id + supplier_id columns)
- Seed script ready to populate staff_id after migration
- Sidebar and VI dictionary prepared for new dashboard UI
- Plans 02+ can now build the dashboard components using the new data schema

---
*Phase: 08-dashboard-sales-rebuild*
*Completed: 2026-03-29*
