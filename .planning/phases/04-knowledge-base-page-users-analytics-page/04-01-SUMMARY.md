---
phase: 04-ton-kho-khach-hang
plan: 01
subsystem: database
tags: [supabase, migration, rls, seed-data, inventory, customers]

requires:
  - phase: 03-nhap-hang
    provides: products table schema and seed data (62 products)
provides:
  - inventory_snapshots table with 806 rows of weekly stock data
  - customers table with 200 rows across 8 customer types
  - customer_purchases table with 730 purchase rows
  - Updated AdminSidebar with ton-kho and khach-hang navigation
affects: [04-02-ton-kho-page, 04-03-khach-hang-page]

tech-stack:
  added: []
  patterns: [deterministic seed generation with sin-based hash for reproducible data]

key-files:
  created:
    - supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql
    - data/seeds/inventory_snapshots.ts
    - data/seeds/customers.ts
    - data/seeds/customer_purchases.ts
  modified:
    - scripts/seed.ts
    - components/admin/AdminSidebar.tsx

key-decisions:
  - "Deterministic sin-based hash for reproducible seed data without external RNG library"
  - "Customer purchase count 730 ensures purchasing customer count exceeds active count (pattern from reference design)"

patterns-established:
  - "Seed data files export typed arrays with cross-references via code fields (product_code, customer_code)"

requirements-completed: [TK-01]

duration: 9min
completed: 2026-03-20
---

# Phase 4 Plan 01: Database Foundation + Teardown Summary

**3 new tables (inventory_snapshots, customers, customer_purchases) with RLS, 1736 seed rows, old KB/Users files deleted, sidebar updated to ton-kho/khach-hang**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-20T04:58:41Z
- **Completed:** 2026-03-20T05:08:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created migration with 3 tables, indexes, and RLS policies matching prior migration pattern
- Generated 806 inventory snapshots (62 products x 13 weekly dates), 200 customers with correct type distribution, 730 customer purchases
- Deleted 8 old knowledge-base/users files and directories
- Updated AdminSidebar with Warehouse icon and correct hrefs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL + seed data files** - `0524c3e6` (feat)
2. **Task 2: Update seed script + delete old files + update sidebar** - `0b809eb3` (feat)

## Files Created/Modified
- `supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql` - 3 tables with RLS policies
- `data/seeds/inventory_snapshots.ts` - 806 deterministic inventory snapshot rows
- `data/seeds/customers.ts` - 200 customers across 8 types (TH 28%, GSO 34%, PHA 14%)
- `data/seeds/customer_purchases.ts` - 730 purchase rows with >300K high-value coverage
- `scripts/seed.ts` - Added seedInventorySnapshots, seedCustomers, seedCustomerPurchases
- `components/admin/AdminSidebar.tsx` - Replaced BookOpen with Warehouse, updated hrefs

## Decisions Made
- Used deterministic sin-based hash for reproducible seed data generation without external libraries
- Customer purchase distribution ensures 177 customers exceed 300K VND threshold for khach-hang high-value section
- Seed functions follow existing pattern: idempotency check, code-to-id map lookup, batch upsert

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript error in existing TonKhoClient.tsx**
- **Found during:** Task 2 (build verification)
- **Issue:** Prior phase 4 run left TonKhoClient.tsx with a Recharts LabelList formatter type error
- **Fix:** Linter auto-applied `as never` cast to formatter prop
- **Files modified:** app/admin/ton-kho/TonKhoClient.tsx
- **Verification:** `npx next build` passes
- **Committed in:** Not separately committed (linter auto-fix, not in git diff)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Build-blocking TS error from prior run. Linter auto-resolved. No scope creep.

## Issues Encountered
- Build lock contention required killing stale node processes before successful verification build

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 tables ready for ton-kho page (Plan 02) and khach-hang page (Plan 03)
- Seed script ready to populate data after migration is applied
- Existing ton-kho and khach-hang page stubs from prior run are functional and may be kept or overwritten by Plans 02/03

---
*Phase: 04-ton-kho-khach-hang*
*Completed: 2026-03-20*
