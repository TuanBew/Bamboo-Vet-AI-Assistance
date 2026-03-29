---
phase: 08-dashboard-sales-rebuild
plan: 02
subsystem: api
tags: [supabase, typescript, sales-dashboard, forecast, aggregation]

requires:
  - phase: 08-dashboard-sales-rebuild
    provides: "Migration 011 staff_id/supplier_id FKs, sidebar cleanup, VI keys"
provides:
  - "getDashboardData service returning complete sales dashboard data shape"
  - "DashboardFilters type with npp, month, nganhHang, thuongHieu, kenh"
  - "DashboardData type with 12 data sections for dashboard UI"
  - "Dashboard API route with 5 new filter params"
affects: [08-dashboard-sales-rebuild]

tech-stack:
  added: []
  patterns: ["JS-side aggregation with Maps for all dashboard metrics", "Independent forecast computation for ban_hang and nhap_hang", "Central getFilteredCustomerIds for kenh/npp filtering"]

key-files:
  created: []
  modified:
    - lib/admin/services/dashboard.ts
    - app/api/admin/dashboard/route.ts
    - app/admin/dashboard/DashboardLoader.tsx
    - app/admin/dashboard/page.tsx

key-decisions:
  - "Used classification column (not industry) for nganh_hang filter since that matches actual DB schema"
  - "DashboardClient.tsx type errors accepted as known -- will be rewritten in Plan 03+"

patterns-established:
  - "Dashboard filter pattern: central getFilteredCustomerIds returns both IDs and customer objects for reuse"
  - "Forecast merge pattern: run computeForecast independently for ban/nhap, merge by year-month key"

requirements-completed: [DASH2-02, DASH2-03, DASH2-05, DASH2-06, DASH2-07]

duration: 6min
completed: 2026-03-29
---

# Phase 8 Plan 02: Service Layer + API Route Rewrite Summary

**Complete dashboard service rewrite querying purchase_orders/customer_purchases/distributor_staff with 5 sales filters, forecast, pie charts, KPIs, staff performance, and top-10 rankings**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T12:01:05Z
- **Completed:** 2026-03-29T12:07:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Dashboard service completely rewritten from chatbot analytics to sales/distribution domain (845 lines)
- All data sourced from purchase_orders, customer_purchases, customers, products, suppliers, distributor_staff (zero materialized view queries)
- Returns 12 data sections: npp_list, filter_options, yearly_series, monthly_series (with forecast), daily_series, metrics_box, pie_nhap, pie_ban, kpi_row, staff_list, customer_section, top10
- API route accepts npp, month, nganhHang, thuongHieu, kenh params with kenh defaulting to 'le'

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite dashboard service layer** - `750e691d` (feat)
2. **Task 2: Rewrite dashboard API route** - `ab38d297` (feat)

## Files Created/Modified
- `lib/admin/services/dashboard.ts` - Complete rewrite: DashboardFilters, DashboardData types, getDashboardData with JS-side aggregation
- `app/api/admin/dashboard/route.ts` - New filter params (npp, month, nganhHang, thuongHieu, kenh), default kenh='le'
- `app/admin/dashboard/DashboardLoader.tsx` - Updated to use new DashboardFilters type
- `app/admin/dashboard/page.tsx` - Updated searchParams to new filter names

## Decisions Made
- Used `classification` column for nganh_hang (industry) filter rather than plan's `industry` column name, since actual DB schema has `classification` on the products table
- Accepted DashboardClient.tsx type errors as known pre-existing issue -- the old client still references chatbot types (kpis, clinic_map, etc.) which will be rewritten in Plan 03+

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated DashboardLoader.tsx and page.tsx for new filter types**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** DashboardLoader.tsx and page.tsx passed old `{ month, province, clinic_type }` to getDashboardData which now expects DashboardFilters
- **Fix:** Updated both files to use new DashboardFilters type with npp, month, nganhHang, thuongHieu, kenh params
- **Files modified:** app/admin/dashboard/DashboardLoader.tsx, app/admin/dashboard/page.tsx
- **Verification:** npx tsc --noEmit shows no errors in these files
- **Committed in:** 750e691d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for type correctness in the SSR loader chain. No scope creep.

## Issues Encountered
- DashboardClient.tsx has ~30 type errors referencing old chatbot data shape (clinic_map, kpis, category_stats, etc.). These are expected and will be resolved when DashboardClient.tsx is rewritten in a subsequent plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service layer and API route ready for new dashboard UI
- DashboardClient.tsx rewrite is the next step to consume the new DashboardData shape
- All 12 data sections available for the 5 dashboard panels

---
*Phase: 08-dashboard-sales-rebuild*
*Completed: 2026-03-29*
