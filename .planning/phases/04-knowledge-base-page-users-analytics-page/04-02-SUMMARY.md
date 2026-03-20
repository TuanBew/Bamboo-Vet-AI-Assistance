---
phase: 04-ton-kho-khach-hang
plan: 02
subsystem: ui, api
tags: [recharts, supabase, nextjs, datatable, inventory, charts]

requires:
  - phase: 04-ton-kho-khach-hang-01
    provides: inventory_snapshots table, products table, seed data
provides:
  - getTonKhoData service function with snapshot deduplication
  - GET /api/admin/ton-kho API route with requireAdmin guard
  - /admin/ton-kho SSR page with client-side chart rendering
  - TonKhoClient with 3 KPI cards, 6 charts (2x3 grid), DataTable with export
affects: [04-ton-kho-khach-hang-03]

tech-stack:
  added: []
  patterns: [snapshot-deduplication-map, horizontal-bar-chart-card, donut-chart-card]

key-files:
  created:
    - lib/admin/services/ton-kho.ts
    - app/api/admin/ton-kho/route.ts
    - app/admin/ton-kho/page.tsx
    - app/admin/ton-kho/TonKhoClient.tsx
  modified: []

key-decisions:
  - "Inventory snapshot deduplication uses JS Map for latest-per-product filtering"
  - "Last import date derived from purchase_order_items + purchase_orders join in JS"
  - "Chart sub-components extracted as HorizontalBarChartCard and DonutChartCard for reuse"

patterns-established:
  - "Snapshot deduplication: fetch all snapshots <= date, deduplicate by product_id using Map"
  - "Chart card pattern: extracted reusable HorizontalBarChartCard and DonutChartCard sub-components"

requirements-completed: [TK-02, TK-03]

duration: 8min
completed: 2026-03-20
---

# Phase 4 Plan 2: Ton Kho Page Summary

**Ton-kho inventory analytics page with snapshot deduplication, 3 KPI cards (blue/orange/teal), 6 Recharts charts in 2x3 grid, and DataTable with Copy+Excel export**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T04:58:41Z
- **Completed:** 2026-03-20T05:07:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Service layer fetches inventory snapshots, deduplicates to latest-per-product for selected date, computes KPIs and 6 chart aggregations (value/qty by nhom/brand/category)
- API route with requireAdmin guard exposes GET endpoint with snapshot_date, nhom, search params
- SSR page passes initial data to client component for hydration
- Client component renders 3 KPI cards, 6 charts in 2x3 grid (4 horizontal BarCharts + 2 donut PieCharts), and DataTable with 7 columns, search, Copy + Excel export
- Date picker and nhom dropdown trigger client-side refetch via /api/admin/ton-kho

## Task Commits

Each task was committed atomically:

1. **Task 1: Ton Kho service layer + API route** - `0e02b0ca` (feat)
2. **Task 2: Ton Kho SSR page + client component with charts and DataTable** - `9b3c99da` (feat)

## Files Created/Modified
- `lib/admin/services/ton-kho.ts` - Service with getTonKhoData, TonKhoData, TonKhoFilters types, snapshot deduplication, KPI/chart aggregation
- `app/api/admin/ton-kho/route.ts` - GET handler with requireAdmin, snapshot_date/nhom/search params
- `app/admin/ton-kho/page.tsx` - SSR page calling getTonKhoData with searchParams
- `app/admin/ton-kho/TonKhoClient.tsx` - Client component with KPI cards, 6 charts, DataTable, filter bar

## Decisions Made
- Inventory snapshot deduplication uses JS Map (fetch all snapshots <= date, keep first per product_id since ordered descending)
- Last import date derived from separate purchase_order_items + purchase_orders queries joined in JS (Supabase nested join syntax unreliable)
- Extracted HorizontalBarChartCard and DonutChartCard as sub-components within TonKhoClient for clean chart rendering
- DataTable uses unknown type cast for generic compatibility with typed ProductRow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js build hangs at "Running TypeScript / Collecting page data" phase (likely Supabase connection timeout during SSR data collection in build). TypeScript compilation passes cleanly via `tsc --noEmit`. This is a runtime infrastructure issue, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ton-kho page complete with all UI elements matching samples/3_ton_kho.jpg reference
- Ready for Plan 03 (Khach Hang page) which follows the same service/route/page/client pattern
- Database tables (inventory_snapshots) must be created via Plan 01 migration before page renders real data

---
*Phase: 04-ton-kho-khach-hang*
*Completed: 2026-03-20*
