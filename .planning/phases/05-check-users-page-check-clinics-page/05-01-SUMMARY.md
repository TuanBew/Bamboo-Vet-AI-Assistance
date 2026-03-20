---
phase: 05-check-users-page-check-clinics-page
plan: 01
subsystem: api, database
tags: [supabase, next-api, service-layer, migration, seed-data]

# Dependency graph
requires:
  - phase: 03-nhap-hang-page
    provides: suppliers, products, purchase_orders tables and service pattern
  - phase: 04-knowledge-base-page-users-analytics-page
    provides: customers, customer_purchases tables
provides:
  - display_programs and distributor_staff database tables
  - ALTER customers with address/street/ward/image_url columns
  - ALTER suppliers with region/zone columns
  - getCheckCustomersData service (map_pins, paginated customers, revenue_pivot, display_programs)
  - getCheckDistributorData service (paginated distributors with monthly_data, filter_options)
  - getDistributorDetail service (staff daily breakdown)
  - 3 API routes: check-customers, check-distributor, check-distributor/[id]/detail
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-hash-mock-data, brand-month-pivot-aggregation]

key-files:
  created:
    - supabase/migrations/20260320_009_add_check_customers_distributor_tables.sql
    - data/seeds/display-programs.ts
    - data/seeds/distributor-staff.ts
    - lib/admin/services/check-customers.ts
    - lib/admin/services/check-distributor.ts
    - app/api/admin/check-customers/route.ts
    - app/api/admin/check-distributor/route.ts
    - app/api/admin/check-distributor/[id]/detail/route.ts
  modified:
    - scripts/seed.ts

key-decisions:
  - "Deterministic hash for distributor staff daily data (no real staff->order link exists)"
  - "Revenue pivot aggregates customer_purchases by product manufacturer (brand) and month"
  - "All geo-located customers returned as map_pins regardless of distributor filter"

patterns-established:
  - "Brand-month pivot: group customer_purchases by product manufacturer + YYYY-MM, return as Record<string, number>"
  - "Deterministic mock daily data: sin-based hash with compound seed string for reproducible values"

requirements-completed: [CHKU-01, CHKC-01, CHKC-02]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 5 Plan 1: Data Layer Summary

**Migration + seed data + service layer + 3 API routes for check-customers and check-distributor pages**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T13:44:20Z
- **Completed:** 2026-03-20T13:51:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Database migration adding display_programs and distributor_staff tables plus ALTER on customers/suppliers
- Service layer with typed interfaces matching CONTEXT.md API shapes exactly
- 3 API routes with requireAdmin() guard following established nhap-hang pattern
- Seed data: 5 display programs, 15 distributor staff, region/zone for 5 suppliers, address fields for all customers

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration + seed data** - `0a4348b8` (feat)
2. **Task 2: Service layer + API routes** - `344fa86a` (feat)

## Files Created/Modified
- `supabase/migrations/20260320_009_add_check_customers_distributor_tables.sql` - DDL for 2 new tables + 2 ALTER statements + RLS + indexes
- `data/seeds/display-programs.ts` - 5 display program seed records
- `data/seeds/distributor-staff.ts` - 15 distributor staff seed records (3 per supplier)
- `scripts/seed.ts` - 4 new seed functions: seedDisplayPrograms, seedDistributorStaff, updateSuppliersRegionZone, updateCustomersAddressFields
- `lib/admin/services/check-customers.ts` - getCheckCustomersData with map_pins, paginated customers, revenue_pivot, display_programs
- `lib/admin/services/check-distributor.ts` - getCheckDistributorData with monthly pivot + getDistributorDetail with staff daily breakdown
- `app/api/admin/check-customers/route.ts` - GET handler with auth + pagination params
- `app/api/admin/check-distributor/route.ts` - GET handler with year/metric/filter params
- `app/api/admin/check-distributor/[id]/detail/route.ts` - GET handler for distributor daily detail

## Decisions Made
- Deterministic hash for distributor staff daily data since no real staff-to-order relationship exists in the database
- Revenue pivot aggregates customer_purchases by product manufacturer (brand) and purchase_date month
- All geo-located customers returned as map_pins regardless of distributor_id filter (customers aren't directly linked to a single distributor)
- Customer type codes (TH, GSO, PHA, etc.) mapped to Vietnamese display labels in the service layer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 API endpoints ready for Plans 05-02 (check-customers UI) and 05-03 (check-distributor UI) to build against
- TypeScript compiles cleanly with zero errors

---
*Phase: 05-check-users-page-check-clinics-page*
*Completed: 2026-03-20*
