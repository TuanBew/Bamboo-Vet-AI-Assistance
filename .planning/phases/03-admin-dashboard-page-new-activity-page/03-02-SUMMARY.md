---
phase: 03-admin-dashboard-page-new-activity-page
plan: 02
subsystem: ui
tags: [recharts, leaflet, react-leaflet, dashboard, charts, donut, sparkline, map, ssr, filter]

# Dependency graph
requires:
  - phase: 03-admin-dashboard-page-new-activity-page
    plan: 01
    provides: getDashboardData service, computeForecast, recharts/leaflet npm packages, API route
  - phase: 02-admin-shell-role-based-routing
    provides: SectionHeader, KpiCard, FilterBar/SparklineChart/MapView stubs, admin layout
provides:
  - Real FilterBar with select inputs and URL sync
  - Real SparklineChart rendering Recharts LineChart (no axes/legend)
  - Real MapView with Leaflet MapContainer and colored DivIcon markers
  - DashboardClient with 4 collapsible sections (Tong quan, Chi so tap trung, Nhan vien, Khach hang)
  - DashboardSkeleton loading state
  - SSR page.tsx calling getDashboardData directly
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [ssr-data-passthrough, client-refetch-on-filter, forecast-bridge-point, dynamic-leaflet-import]

key-files:
  created:
    - components/admin/LeafletMapInner.tsx
    - app/admin/dashboard/DashboardClient.tsx
    - app/admin/dashboard/DashboardSkeleton.tsx
  modified:
    - components/admin/FilterBar.tsx
    - components/admin/SparklineChart.tsx
    - components/admin/MapView.tsx
    - app/admin/dashboard/page.tsx

key-decisions:
  - "LeafletMapInner in separate file for clean dynamic import with ssr:false"
  - "Filter changes use router.push for URL state + fetch for client-side refetch"
  - "Forecast bridge: last real data point also sets forecast value so dashed line connects visually"
  - "Donut PieCharts filter out zero-count entries to avoid empty slices"

patterns-established:
  - "Dynamic Leaflet pattern: separate inner component file + dynamic(() => import(), { ssr: false })"
  - "Dashboard filter pattern: URL searchParams as source of truth, client-side fetch on change"
  - "SSR data passthrough: Server Component calls service directly, passes initialData to client component"

requirements-completed: [DASH-03, DASH-04, DASH-05, DASH-06]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 03 Plan 02: Dashboard Page UI Summary

**Full dashboard page with 4 collapsible sections: yearly/forecast charts, daily volume with KPIs and donut PieCharts, top-20 user table with sparklines, and Leaflet clinic map with color-coded pins**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T05:07:06Z
- **Completed:** 2026-03-19T05:10:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Wired 3 component stubs (FilterBar, SparklineChart, MapView) to real implementations with Recharts and Leaflet
- Built DashboardClient with all 4 dashboard sections: Tong quan (grouped BarChart + forecast ComposedChart), Chi so tap trung (daily LineChart, 5 KPIs, 6 donut PieCharts, 4 summary tiles), Nhan vien (top-20 table with sparklines and inline stacked BarCharts), Khach hang (Leaflet map + top-10 horizontal BarChart)
- SSR page.tsx calls getDashboardData directly, passing data to client component
- Filter changes trigger URL update and client-side refetch via /api/admin/dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire FilterBar, SparklineChart, MapView** - `4af3dc0f` (feat)
2. **Task 2: Build DashboardClient, DashboardSkeleton, page.tsx** - `f69f6339` (feat)

## Files Created/Modified
- `components/admin/FilterBar.tsx` - Real select inputs for province, clinic type, year/month, search
- `components/admin/SparklineChart.tsx` - Recharts LineChart with no axes/legend for table sparklines
- `components/admin/MapView.tsx` - Dynamic import wrapper for Leaflet map
- `components/admin/LeafletMapInner.tsx` - Leaflet MapContainer with colored DivIcon markers and popups
- `app/admin/dashboard/DashboardClient.tsx` - Client component with 4 sections, all charts, filter-driven refetch
- `app/admin/dashboard/DashboardSkeleton.tsx` - Animated pulse loading skeleton
- `app/admin/dashboard/page.tsx` - Server Component with SSR data pass-through

## Decisions Made
- Created LeafletMapInner as separate file for clean dynamic import (avoids SSR issues with Leaflet window access)
- Forecast bridge point: last real data point also sets forecast value for visual continuity of dashed line
- Filter options (provinces, clinic types) derived from clinic_map data at render time
- Donut PieCharts filter out zero-count entries per RESEARCH.md Pitfall 4

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard page fully rendered with all 4 sections, charts, map, and filter-driven refetch
- Ready for Plan 03 (New Activity page) which shares FilterBar and other admin components
- All DASH-03 through DASH-06 requirements satisfied

---
*Phase: 03-admin-dashboard-page-new-activity-page*
*Completed: 2026-03-19*
