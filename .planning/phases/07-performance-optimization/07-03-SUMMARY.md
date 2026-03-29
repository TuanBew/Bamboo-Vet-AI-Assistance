---
phase: 07-performance-optimization
plan: 03
subsystem: api
tags: [supabase, pagination, etag, cache-control, http-caching]

# Dependency graph
requires:
  - phase: 05
    provides: check-users and check-clinics service layers and API routes
provides:
  - Server-side LIMIT/OFFSET pagination for check-users
  - ETag + Cache-Control caching utility for admin API routes
  - Scoped queries for check-clinics (only fetch data for current page)
affects: [check-users, check-clinics, admin-api]

# Tech tracking
tech-stack:
  added: []
  patterns: [jsonWithCache utility for HTTP caching on admin GET endpoints, server-side .range() pagination with Supabase]

key-files:
  created:
    - lib/admin/cache-headers.ts
  modified:
    - lib/admin/services/check-users.ts
    - lib/admin/services/check-clinics.ts
    - app/api/admin/check-users/route.ts
    - app/api/admin/check-clinics/route.ts

key-decisions:
  - "ETag uses weak validator (W/) with MD5 hash of JSON body for fast comparison"
  - "Cache-Control uses private directive (admin-only data) with 1h max-age and 30min stale-while-revalidate"
  - "check-users map_pins query separated with server-side NOT NULL filter for lat/lng"
  - "check-clinics profiles and monthly data scoped to current page's clinic IDs only"

patterns-established:
  - "jsonWithCache(request, data, maxAge): shared caching wrapper for admin API GET responses"
  - "Server-side pagination via Supabase .range() with { count: 'exact' } for total"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 7 Plan 3: API Query Optimization Summary

**Server-side LIMIT/OFFSET pagination for check-users/check-clinics with ETag and Cache-Control HTTP caching headers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T03:09:15Z
- **Completed:** 2026-03-29T03:13:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Replaced fetch-all-then-filter-in-JS with Supabase server-side .range() pagination and .ilike()/.eq() filters for check-users
- Created shared jsonWithCache() utility with ETag generation and 304 Not Modified support
- Optimized check-clinics to scope profile and monthly data fetches to only the current page's clinic IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side pagination for check-users** - `f8ec0af6` (feat)
2. **Task 2: ETag and Cache-Control headers** - `544f0add` (feat)
3. **Task 3: Optimize check-clinics queries** - `a5b846b9` (feat)

## Files Created/Modified
- `lib/admin/cache-headers.ts` - Shared caching utility with ETag generation and Cache-Control headers
- `lib/admin/services/check-users.ts` - Server-side LIMIT/OFFSET pagination, scoped geo-profile query
- `lib/admin/services/check-clinics.ts` - Server-side pagination, scoped profile/monthly data fetches
- `app/api/admin/check-users/route.ts` - Uses jsonWithCache for cached responses
- `app/api/admin/check-clinics/route.ts` - Uses jsonWithCache for cached responses

## Decisions Made
- Used weak ETag (W/) with MD5 hash -- sufficient for JSON API responses where byte-exact matching is unnecessary
- Cache-Control set to `private, max-age=3600, stale-while-revalidate=1800` -- admin data is private, 1hr freshness acceptable since materialized views refresh infrequently
- check-users separates map_pins into its own query with server-side NOT NULL lat/lng filter rather than fetching all profiles
- check-clinics scopes dependent queries (profiles, mv_monthly_queries) to only the clinic IDs on the current page via .in() filter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All admin API routes now have caching headers available via jsonWithCache()
- Other GET endpoints (dashboard, nhap-hang, ton-kho, etc.) can adopt the same pattern

## Self-Check: PASSED

All 5 files verified present. All 3 task commits verified in git history.

---
*Phase: 07-performance-optimization*
*Completed: 2026-03-29*
