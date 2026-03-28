---
phase: 06-security-polish
plan: 06
subsystem: database
tags: [seed-data, generators, batch-insert, supabase, deterministic]

# Dependency graph
requires:
  - phase: 06-security-polish
    provides: "Plan 05 TS generators (profiles, conversations, messages, chat_analytics, query_events)"
provides:
  - "Expanded business data generators: 450 customers, 90 products, 10 suppliers, 1746 purchases, 133 orders"
  - "Rewritten seed runner with batch inserts and TS generator imports"
affects: [06-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["batchInsert helper with configurable chunk sizes for 50K+ rows", "weighted province distribution for geographic clustering"]

key-files:
  created: []
  modified:
    - data/seeds/suppliers.ts
    - data/seeds/products.ts
    - data/seeds/customers.ts
    - data/seeds/customer_purchases.ts
    - data/seeds/purchase_orders.ts
    - data/seeds/purchase_order_items.ts
    - scripts/seed.ts

key-decisions:
  - "Province distribution uses weighted hash for geographic clustering (HCMC 25%, Ha Noi 15%, Da Nang 8%)"
  - "Customer purchases use month-based generation loop instead of per-customer loop for 27-month coverage"
  - "Purchase order supplier pattern expanded to 20-entry rotation for all 10 suppliers"
  - "Seed runner uses static imports instead of dynamic for type safety and bundling"

patterns-established:
  - "batchInsert: generic helper with chunkSize, onConflict, useInsert options for all table insertions"
  - "Seasonal multiplier pattern for purchase volume distribution across months"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-28
---

# Phase 06 Plan 06: Seed Data Expansion Summary

**Expanded business generators to 450 customers, 90 products, 10 suppliers, 1,746 purchases across 27 months with rewritten batch-insert seed runner**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T14:28:21Z
- **Completed:** 2026-03-28T14:37:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Expanded all business data generators to target volumes with realistic distributions
- Rewritten seed runner imports all 14 TS generators with batchInsert helper for 50K+ row handling
- All 27 months (Jan 2024 - Mar 2026) covered with no zero-purchase or zero-order months
- Geographic distribution weighted: HCMC 25%, Ha Noi 15%, Da Nang 8%, 70% geo-located

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand business data generators** - `d0dba7f4` (feat)
2. **Task 2: Rewrite seed runner** - `1791b3b4` (feat)

## Files Created/Modified
- `data/seeds/suppliers.ts` - Expanded from 5 to 10 suppliers with Vietnamese vet companies
- `data/seeds/products.ts` - Expanded from 62 to 90 products with vaccines, vitamins, hormones, antiparasitics
- `data/seeds/customers.ts` - Expanded from 200 to 450 with weighted geographic distribution
- `data/seeds/customer_purchases.ts` - Rewritten to span 27 months with seasonal patterns (1,746 records)
- `data/seeds/purchase_orders.ts` - Expanded from 95 to 133 orders with growth curve
- `data/seeds/purchase_order_items.ts` - Updated for expanded catalog (857 items, 3-10 per order)
- `scripts/seed.ts` - Complete rewrite: static TS imports, batchInsert helper, FK dependency order

## Decisions Made
- Province distribution uses weighted deterministic hash instead of simple modulo for realistic geographic clustering
- Customer purchases restructured from per-customer to per-month generation to guarantee 27-month coverage
- Seed runner uses static imports (not dynamic `await import()`) for better type safety
- ProfileSeed uses `latitude`/`longitude` fields (not `lat`/`lng`) matching the generator interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ProfileSeed field name mismatch**
- **Found during:** Task 2 (Seed runner rewrite)
- **Issue:** Plan referenced `profile.lat`/`profile.lng`/`profile.clinic_id`/`profile.user_type` but ProfileSeed interface uses `latitude`/`longitude` and has no `clinic_id`/`user_type` fields
- **Fix:** Used correct field names from ProfileSeed interface (`profile.latitude`, `profile.longitude`) and removed non-existent fields
- **Files modified:** scripts/seed.ts
- **Verification:** TypeScript type-check passes for profile data mapping
- **Committed in:** 1791b3b4

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All seed data generators expanded to target volumes
- Seed runner ready to populate database with 50K+ rows
- Plan 07 can proceed with final verification/polish

---
*Phase: 06-security-polish*
*Completed: 2026-03-28*
