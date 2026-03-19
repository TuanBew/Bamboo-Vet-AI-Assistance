---
phase: 03-admin-dashboard-page-new-activity-page
plan: 03
subsystem: ui, api
tags: [recharts, supabase, nextjs, ssr, analytics, piechart, areachart, barchart]

# Dependency graph
requires:
  - phase: 03-01
    provides: Shared admin components (KpiCard, SectionHeader, FilterBar), recharts dependency, service client pattern
provides:
  - New Activity API service (getNewActivityData) with 6 KPIs, daily volume, sessions, recent sessions, top questions, category stats
  - New Activity API route (/api/admin/new-activity) with admin auth guard
  - NewActivityClient with 6 colored KPI cards, charts, table, donuts
  - NewActivitySkeleton loading placeholder
  - SSR page.tsx for /admin/new-activity
affects: [04-knowledge-base-page, 05-check-clinics-page, 06-check-users-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [hybrid-ssr-client-refetch, month-filter-url-state, message-timestamp-duration-computation]

key-files:
  created:
    - lib/admin/services/new-activity.ts
    - app/api/admin/new-activity/route.ts
    - app/admin/new-activity/NewActivityClient.tsx
    - app/admin/new-activity/NewActivitySkeleton.tsx
  modified:
    - app/admin/new-activity/page.tsx

key-decisions:
  - "avg_session_duration_min computed in JS from message timestamps (not raw SQL) since Supabase JS client lacks raw SQL"
  - "top_questions grouping done in JS with 60-char prefix slice, acceptable for single-month data volume"
  - "recent_sessions duration uses Math.max(duration, 1) for minimum 1 minute on single-message conversations"

patterns-established:
  - "New Activity page follows same SSR+client hybrid pattern as Dashboard (page.tsx calls service, passes to client component)"
  - "Month-only filter (no province/clinic_type) on New Activity page per design spec"

requirements-completed: [ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 3 Plan 3: New Activity Page Summary

**Full /admin/new-activity vertical slice with 6 colored KPI cards, daily AreaChart + sessions BarChart, recent sessions table, top-10 questions horizontal BarChart, and 3 category donut PieCharts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T05:14:06Z
- **Completed:** 2026-03-19T05:18:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- New Activity API service querying conversations, messages, profiles, mv_daily_queries, mv_category_stats with all 6 KPIs including avg_session_duration_min
- Full client component with 6 distinctly colored KPI cards, 2 chart types side by side, sessions table, top questions horizontal bar, 3 donut pie charts
- SSR page with Suspense fallback and month-only filter with immediate refetch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create New Activity API service function and route handler** - `57db2f1c` (feat)
2. **Task 2: Build NewActivityClient, NewActivitySkeleton, and wire page.tsx** - `e2d0325d` (feat)

## Files Created/Modified
- `lib/admin/services/new-activity.ts` - Service function with 6 KPIs, daily volume, sessions, recent sessions, top questions, category stats
- `app/api/admin/new-activity/route.ts` - API route with admin auth guard, year/month params
- `app/admin/new-activity/NewActivityClient.tsx` - Client component with all charts, KPIs, table, donuts
- `app/admin/new-activity/NewActivitySkeleton.tsx` - Loading skeleton with animate-pulse placeholders
- `app/admin/new-activity/page.tsx` - Server Component with SSR data fetching and Suspense

## Decisions Made
- Computed avg_session_duration_min in JavaScript from message min/max timestamps rather than raw SQL, since Supabase JS client does not support raw SQL directly
- Top questions grouping done client-side in the service with 60-char prefix slicing, acceptable for single-month data volume
- Used Math.max(duration, 1) to ensure single-message conversations count as 1 minute minimum

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now complete with all 3 plans (shared components, dashboard page, new activity page)
- Ready for Phase 4 (Knowledge Base page) or Phase 5 (Check pages)

## Self-Check: PASSED

All 5 files verified present. Both task commits (57db2f1c, e2d0325d) verified in git log.

---
*Phase: 03-admin-dashboard-page-new-activity-page*
*Completed: 2026-03-19*
