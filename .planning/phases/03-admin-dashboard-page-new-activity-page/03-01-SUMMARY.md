---
phase: 03-admin-dashboard-page-new-activity-page
plan: 01
subsystem: api
tags: [vitest, linear-regression, forecast, recharts, leaflet, tanstack-table, supabase, materialized-views]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data
    provides: materialized views (mv_dashboard_kpis, mv_monthly_queries, mv_daily_queries, mv_category_stats)
  - phase: 02-admin-shell-role-based-routing
    provides: requireAdmin auth guard, createServiceClient, admin layout
provides:
  - computeForecast linear regression utility with MonthlyDataPoint/ForecastPoint types
  - getDashboardData service function (shared by SSR page and API route)
  - GET /api/admin/dashboard endpoint with auth guard
  - Phase 3 npm dependencies (recharts, react-leaflet, leaflet, @tanstack/react-table)
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: [recharts@3.8.0, react-leaflet@5.0.0, leaflet@1.9.4, "@types/leaflet@1.9.21", "@tanstack/react-table@8.21.3", vitest@4.1.0]
  patterns: [service-function-pattern, tdd-red-green, linear-regression-forecast]

key-files:
  created:
    - lib/admin/forecast.ts
    - lib/admin/__tests__/forecast.test.ts
    - lib/admin/services/dashboard.ts
    - app/api/admin/dashboard/route.ts
    - vitest.config.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Service function pattern: getDashboardData is callable from both Server Components (SSR) and API route (client refetch), avoiding the Server Component -> own API fetch anti-pattern"
  - "Forecast uses last 6 data points for linear regression, produces 3 forecast months with is_forecast flag"
  - "KPIs always unfiltered from mv_dashboard_kpis; filters apply only to chart/table data"

patterns-established:
  - "Service function pattern: lib/admin/services/*.ts exports async functions that both page.tsx (SSR) and route.ts (client refetch) can call"
  - "TDD for utility functions: write tests first (RED), then implement (GREEN)"
  - "Numeric parsing: all Supabase bigint/numeric values parsed with Number() to avoid string types in charts"

requirements-completed: [DASH-01, DASH-02]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 03 Plan 01: Dashboard Data Layer Summary

**Linear regression forecast utility with TDD, dashboard API service querying 4 materialized views, and 5 Phase 3 npm dependencies installed**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T04:57:13Z
- **Completed:** 2026-03-19T05:03:44Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- TDD forecast utility: 5 vitest tests (RED) then implementation (GREEN) for computeForecast with linear regression
- Dashboard service function querying mv_dashboard_kpis, mv_monthly_queries, mv_daily_queries, mv_category_stats with province/clinic_type filtering
- GET /api/admin/dashboard route with requireAdmin guard returning full DashboardData shape including daily_volume
- Installed recharts, react-leaflet, leaflet, @types/leaflet, @tanstack/react-table

## Task Commits

Each task was committed atomically:

1. **Task 0: Create forecast unit tests (RED)** - `2c6e2bb8` (test)
2. **Task 1: Install Phase 3 npm dependencies** - `b2d06280` (chore)
3. **Task 2: Create forecast.ts (GREEN)** - `e5c969e2` (feat)
4. **Task 3: Dashboard API service + route** - `d8652bc7` (feat)

## Files Created/Modified
- `lib/admin/__tests__/forecast.test.ts` - 5 vitest unit tests for computeForecast
- `lib/admin/forecast.ts` - Linear regression forecast with MonthlyDataPoint/ForecastPoint types
- `lib/admin/services/dashboard.ts` - getDashboardData service querying 4 materialized views
- `app/api/admin/dashboard/route.ts` - Thin GET handler with requireAdmin + error handling
- `vitest.config.ts` - Vitest configuration with path alias support
- `package.json` - 5 new dependencies + vitest devDependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Service function pattern: getDashboardData callable from both SSR and API route, avoiding the Server Component self-fetch anti-pattern
- KPIs always platform-wide (unfiltered), chart/table data filtered by province/clinic_type via user ID pre-filtering
- Top users limited to 20, top clinics to 10 (leaderboard style, no pagination)
- Sparkline uses last 12 calendar months with 0-fill for missing months

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard API endpoint ready for Plan 02 (Dashboard page UI with SSR + client refetch)
- getDashboardData service function importable directly from Server Components
- computeForecast available for monthly_series with is_forecast flag for chart dashed-line rendering
- All chart/table/map libraries installed and ready for component development

## Self-Check: PASSED

All 5 created files verified on disk. All 4 task commits verified in git log.

---
*Phase: 03-admin-dashboard-page-new-activity-page*
*Completed: 2026-03-19*
