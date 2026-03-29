---
phase: 08-dashboard-sales-rebuild
plan: 03
subsystem: ui
tags: [recharts, typescript, dashboard, filter-bar, pie-chart, forecast, kpi]

requires:
  - phase: 08-dashboard-sales-rebuild
    provides: "getDashboardData service with DashboardFilters/DashboardData types and API route"
provides:
  - "DashboardClient with inline filter bar (5 selects + Search button)"
  - "Tong Quan section with yearly bar chart + monthly forecast composed chart"
  - "Chi So Tap Trung section with daily line chart, metrics progress box, 6 pie donuts, 4 KPI cards with YoY delta"
  - "Updated DashboardSkeleton matching 5-section layout"
  - "formatVND helper for Vietnamese number formatting"
affects: [08-dashboard-sales-rebuild]

tech-stack:
  added: []
  patterns: ["Inline filter bar with Search button (not onChange auto-refetch)", "MiniDonut reusable component for pie charts", "Bridge point pattern for forecast line continuity", "YoY delta badge on KPI cards"]

key-files:
  created: []
  modified:
    - app/admin/dashboard/page.tsx
    - app/admin/dashboard/DashboardLoader.tsx
    - app/admin/dashboard/DashboardSkeleton.tsx
    - app/admin/dashboard/DashboardClient.tsx

key-decisions:
  - "Filter bar uses inline selects with Search button trigger, not FilterBar component or onChange auto-refetch"
  - "Forecast chart shows both ban_hang and nhap_hang forecast lines with bridge point for continuity"

patterns-established:
  - "formatVND: Vietnamese number formatter (B/M/K suffixes) for chart axes and tooltips"
  - "MiniDonut: reusable pie chart component for dashboard donut grids"

requirements-completed: [DASH2-03, DASH2-05, DASH2-06]

duration: 2min
completed: 2026-03-29
---

# Phase 8 Plan 03: DashboardClient Rebuild (Filter Bar + Tong Quan + Chi So Tap Trung) Summary

**Complete DashboardClient rewrite with 5-dropdown filter bar, yearly/monthly forecast charts, daily line chart, metrics progress box, 6 pie donuts, and 4 KPI cards with YoY delta badges**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T12:09:54Z
- **Completed:** 2026-03-29T12:12:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DashboardClient completely rewritten from chatbot analytics to sales domain (276 lines, down from 636)
- Filter bar with 5 inline selects (NPP, month, nganh hang, thuong hieu, kenh) + Search button triggers router.push + fetch
- Tong Quan section: yearly grouped bar chart + monthly composed chart with forecast dotted lines for both ban/nhap
- Chi So Tap Trung: daily line chart, 5-metric progress box with bars, 6 pie donut charts (3 nhap + 3 ban), 4 KPI big numbers with YoY delta badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Update page.tsx + DashboardLoader + DashboardSkeleton** - `18cf1c84` (feat)
2. **Task 2: Rebuild DashboardClient** - `84d3b9a4` (feat)

## Files Created/Modified
- `app/admin/dashboard/page.tsx` - SSR page with 5 new searchParams, kenh defaults to 'le'
- `app/admin/dashboard/DashboardLoader.tsx` - Async loader passing DashboardFilters to getDashboardData
- `app/admin/dashboard/DashboardSkeleton.tsx` - Updated skeleton matching 5-section layout
- `app/admin/dashboard/DashboardClient.tsx` - Full rebuild: filter bar + Tong Quan + Chi So Tap Trung (plan 04 sections as placeholders)

## Decisions Made
- Filter bar uses inline `<select>` elements with Search button trigger (not FilterBar component or onChange auto-refetch) per spec
- Forecast chart shows both ban_hang and nhap_hang forecast lines with bridge point for dashed line continuity
- MiniDonut extracted as reusable internal component for the 6 pie chart grid

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DashboardClient has placeholder comments for Nhan Vien, Khach Hang, and Top 10 sections
- Plan 04 will add the remaining 3 sections consuming staff_list, customer_section, and top10 data
- All VI dictionary keys already available for plan 04 sections

## Self-Check: PASSED

All 4 files verified present. Both task commits (18cf1c84, 84d3b9a4) verified in git log.

---
*Phase: 08-dashboard-sales-rebuild*
*Completed: 2026-03-29*
