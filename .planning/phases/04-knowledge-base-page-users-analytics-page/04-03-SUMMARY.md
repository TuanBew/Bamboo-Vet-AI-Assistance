---
phase: 04-knowledge-base-page-users-analytics-page
plan: 03
subsystem: ui
tags: [recharts, supabase, analytics, charts, kpi, users]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data
    provides: profiles table and mv_monthly_queries materialized view
  - phase: 02-admin-shell-shared-components
    provides: KpiCard, SectionHeader, FilterBar shared components
  - phase: 03-admin-dashboard-page-new-activity-page
    provides: SSR + client refetch pattern, chart constants, API route pattern
provides:
  - getUsersData service function querying profiles + mv_monthly_queries
  - GET /api/admin/users API route with requireAdmin guard
  - /admin/users page with 3 charts, 2 facility breakdown sections, heavy users table
affects: [05-check-users-page, 06-pdf-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [users-analytics-service, colored-dot-badges, facility-breakdown-table]

key-files:
  created:
    - lib/admin/services/users.ts
    - app/api/admin/users/route.ts
    - app/admin/users/UsersClient.tsx
  modified:
    - app/admin/users/page.tsx

key-decisions:
  - "verified_email KPI uses auth.admin.listUsers with fallback to profile count if unavailable"
  - "heavy_users threshold >10 queries/month from mv_monthly_queries"
  - "Filter options extracted from unfiltered profiles for stable dropdown options"

patterns-established:
  - "Colored dot badge pattern: inline-block w-3 h-3 rounded-full with CLINIC_DOT_COLORS map"
  - "Facility breakdown table: Ma | Icon | Loai co so | So luong | % columns"

requirements-completed: [USERS-01, USERS-02, USERS-03, USERS-04, USERS-05]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 4 Plan 3: Users Analytics Page Summary

**Full /admin/users page with LineChart, BarChart, horizontal BarChart, 2 facility breakdown sections with dot badges, and collapsible heavy-users table**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T16:30:23Z
- **Completed:** 2026-03-19T16:34:28Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Users service function queries profiles + mv_monthly_queries for all analytics data
- API route protected with requireAdmin(), accepts year/month/province/clinic_type params
- Client component renders 3 charts (LineChart new users/month, BarChart by province, horizontal BarChart by district)
- Two facility breakdown sections with colored dot badges and KPI tiles
- Collapsible heavy-users section (defaultOpen=false) with >10 queries/month threshold
- FilterBar wired with immediate refetch on any filter change

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Users service function and API route** - `3db09508` (feat)
2. **Task 2: Create Users SSR page.tsx server component** - `6c98bb1a` (feat)
3. **Task 3: Create UsersClient.tsx with charts, KPIs, breakdown tables, heavy users** - `a3d4139b` (feat)

## Files Created/Modified
- `lib/admin/services/users.ts` - Service function with UsersFilters/UsersData types, getUsersData querying profiles + mv_monthly_queries
- `app/api/admin/users/route.ts` - GET handler with requireAdmin guard, year/month/province/clinic_type params
- `app/admin/users/page.tsx` - SSR server component replacing "Coming soon" stub
- `app/admin/users/UsersClient.tsx` - Client component with 3 charts, 2 breakdown sections, collapsible heavy users

## Decisions Made
- verified_email KPI uses auth.admin.listUsers() with try/catch fallback to profile count when unavailable (seed data may not have auth users)
- Filter options (provinces, clinic_types) extracted from ALL unfiltered profiles so dropdowns remain stable regardless of active filters
- heavy_users threshold is >10 queries/month aggregated from mv_monthly_queries for the selected year/month

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Users analytics page complete, all requirements fulfilled
- Phase 4 complete after KB plans (04-01, 04-02) are also done

---
*Phase: 04-knowledge-base-page-users-analytics-page*
*Completed: 2026-03-19*
