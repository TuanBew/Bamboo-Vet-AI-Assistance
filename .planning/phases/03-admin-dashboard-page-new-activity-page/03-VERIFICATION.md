---
phase: 03-admin-dashboard-page-new-activity-page
verified: 2026-03-19T10:30:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/12
  gaps_closed:
    - "GET /api/admin/dashboard returns JSON with kpis, monthly_series, category_stats, top_users, clinic_map, top_clinics, daily_volume"
    - "GET /api/admin/new-activity returns JSON with 6 KPIs, daily_query_volume, daily_sessions, recent_sessions, top_questions, category_stats"
    - "monthly_series includes forecast points with is_forecast: true appended after real data"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load /admin/dashboard with seed data populated and verify KPI cards show non-zero values"
    expected: "All 5 KPI cards display numbers from mv_dashboard_kpis"
    why_human: "Cannot verify Supabase query results without running the app against the database"
  - test: "Load /admin/dashboard and verify category donut charts show non-empty slices"
    expected: "6 PieCharts in 'Chi so tap trung' section display named slices for drug_category, animal_type, and query_type"
    why_human: "Requires live browser session with seeded mv_category_stats data"
  - test: "Change month filter on /admin/dashboard and verify KPI cards do NOT change while charts update"
    expected: "KPI cards remain showing platform-wide totals; charts and table reflect the filtered month"
    why_human: "Requires interactive browser session to test filter state"
  - test: "Load /admin/new-activity and verify 6 KPI cards render with correct colored backgrounds"
    expected: "Blue, orange, cyan, pink, green, purple cards with non-zero values"
    why_human: "Visual and data verification requires a live browser session"
  - test: "Load /admin/new-activity and verify category donut charts show non-empty slices"
    expected: "3 PieCharts for animal_types, drug_groups, query_types display named slices"
    why_human: "Requires live browser session with seeded mv_category_stats data"
  - test: "Scroll to Leaflet map on /admin/dashboard and verify colored marker pins render"
    expected: "Vietnam map renders with colored pins (green >50, yellow 10-50, red 1-9, grey 0)"
    why_human: "Leaflet renders in browser only; cannot verify map rendering programmatically"
---

# Phase 03: Admin Dashboard + New Activity Page Verification Report

**Phase Goal:** Build the Admin Dashboard page and New Activity page with analytics, charts, KPIs, and data visualizations powered by materialized views.
**Verified:** 2026-03-19T10:30:00Z
**Status:** human_needed — all automated checks pass; awaiting live browser verification
**Re-verification:** Yes — after gap closure (Plan 04)

---

## Re-Verification Summary

| Gap (from initial verification) | Closed? | Evidence |
|----------------------------------|---------|---------|
| `dashboard.ts` queried `drug_group`, `query_count`, `user_id` from `mv_category_stats` | Yes | Commit `3ac7a0e3`: now selects `drug_category, animal_type, query_type, count` with `province`/`clinic_type` filters |
| `dashboard.ts` per-user category breakdown used `mv_category_stats` (no `user_id`) | Yes | Commit `3ac7a0e3`: breakdown now queries `query_events` directly with `.in('user_id', top20Ids)` |
| `new-activity.ts` queried `drug_group` from `mv_category_stats` | Yes | Commit `35dccf8f`: now selects `drug_category` and accesses `row.drug_category` |

No regressions found. All 9 previously-verified truths still pass.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All Phase 3 chart/map libraries importable without SSR errors | VERIFIED | package.json: recharts@3.8.0, react-leaflet@5.0.0, leaflet@1.9.4, @tanstack/react-table@8.21.3; MapView uses dynamic import with ssr:false |
| 2 | forecast.ts computes 3 forecast months from 6 months with is_forecast:true | VERIFIED | lib/admin/forecast.ts implements linear regression; 5 vitest tests written |
| 3 | GET /api/admin/dashboard returns correct JSON shape including daily_volume | VERIFIED | Route and service wired; category_stats now queries `drug_category` and `count` correctly; per-user breakdown from query_events |
| 4 | monthly_series includes forecast points with is_forecast:true | VERIFIED | dashboard.ts calls computeForecast on aggregated mv_monthly_queries data |
| 5 | KPIs are platform-wide totals from mv_dashboard_kpis (unfiltered) | VERIFIED | fetchKpis() queries mv_dashboard_kpis directly, no filter applied |
| 6 | daily_volume contains per-day query counts for selected month | VERIFIED | fetchDailyVolume() queries mv_daily_queries by year+month, aggregates by day |
| 7 | FilterBar renders real select inputs with immediate refetch | VERIFIED | FilterBar.tsx has real `<select>` elements; DashboardClient calls handleFilterChange |
| 8 | SparklineChart renders real Recharts LineChart with no axes | VERIFIED | SparklineChart.tsx imports LineChart from recharts; no axes, isAnimationActive=false |
| 9 | MapView renders real Leaflet MapContainer with colored DivIcon pins | VERIFIED | LeafletMapInner.tsx has MapContainer, DivIcon, color thresholds; dynamically imported with ssr:false |
| 10 | Dashboard page shows 4 collapsible sections | VERIFIED | DashboardClient.tsx has SectionHeader for Tong quan, Chi so tap trung, Nhan vien, Khach hang |
| 11 | GET /api/admin/new-activity returns 6 KPIs, daily_query_volume, daily_sessions, recent_sessions, top_questions, category_stats | VERIFIED | Route and service wired; category_stats queries `drug_category` and `count` correctly |
| 12 | /admin/new-activity renders 6 KPI cards, charts, table, donuts | VERIFIED | NewActivityClient.tsx has all 6 colored KPI cards, AreaChart, BarChart, sessions table, 3 donuts |

**Score:** 12/12 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/__tests__/forecast.test.ts` | Unit tests for computeForecast | VERIFIED | 5 tests, all correct imports, edge cases covered |
| `lib/admin/forecast.ts` | Linear regression forecast | VERIFIED | Exports computeForecast, MonthlyDataPoint, ForecastPoint; no 'use client' |
| `lib/admin/services/dashboard.ts` | Dashboard data service | VERIFIED | Exists and substantial; mv_category_stats queries now use correct columns (drug_category, count); per-user breakdown from query_events |
| `app/api/admin/dashboard/route.ts` | Dashboard API endpoint | VERIFIED | Thin GET handler with requireAdmin + getDashboardData delegation |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/admin/FilterBar.tsx` | Real filter bar with select inputs | VERIFIED | Real `<select>` elements, province/clinic_type/month/search, hint text present |
| `components/admin/SparklineChart.tsx` | Real Recharts sparkline | VERIFIED | LineChart with isAnimationActive=false, no axes/legend |
| `components/admin/MapView.tsx` | Real Leaflet map with dynamic import | VERIFIED | dynamic() with ssr:false; delegates to LeafletMapInner.tsx |
| `components/admin/LeafletMapInner.tsx` | Leaflet inner component | VERIFIED | MapContainer, DivIcon, color thresholds (#22c55e, #eab308, #ef4444) |
| `app/admin/dashboard/DashboardClient.tsx` | Client component with all 4 sections | VERIFIED | 'use client', all 4 sections, all chart types, fetch refetch, useSearchParams |
| `app/admin/dashboard/DashboardSkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks matching dashboard layout |
| `app/admin/dashboard/page.tsx` | Server Component with SSR | VERIFIED | getDashboardData called directly, no 'use client', Suspense wrapper |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/services/new-activity.ts` | New Activity service | VERIFIED | Column fix applied: selects `drug_category` and accesses `row.drug_category` |
| `app/api/admin/new-activity/route.ts` | New Activity API endpoint | VERIFIED | requireAdmin guard, year/month params, delegates to getNewActivityData |
| `app/admin/new-activity/NewActivityClient.tsx` | Client component with all sections | VERIFIED | 'use client', 6 colored KPIs, AreaChart, BarChart, sessions table, 3 donuts, refetch |
| `app/admin/new-activity/NewActivitySkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks for all sections |
| `app/admin/new-activity/page.tsx` | Server Component with SSR | VERIFIED | getNewActivityData called directly, no 'use client', Suspense wrapper |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/admin/dashboard/route.ts` | `lib/admin/services/dashboard.ts` | import getDashboardData | WIRED | Line 3: `import { getDashboardData }` |
| `lib/admin/services/dashboard.ts` | `lib/admin/forecast.ts` | import computeForecast | WIRED | Line 2: `import { computeForecast }` |
| `lib/admin/services/dashboard.ts` | `lib/supabase/server.ts` | import createServiceClient | WIRED | Line 1: `import { createServiceClient }` |
| `lib/admin/services/dashboard.ts` | `mv_category_stats` | `.select('drug_category, animal_type, query_type, count')` | WIRED | Line 211: correct column names post-fix |
| `lib/admin/services/dashboard.ts` | `query_events` | `.select('user_id, drug_category, query_type')` | WIRED | Line 376-378: per-user breakdown from query_events |
| `app/admin/dashboard/page.tsx` | `lib/admin/services/dashboard.ts` | direct import for SSR | WIRED | Line 2: `import { getDashboardData }` |
| `app/admin/dashboard/DashboardClient.tsx` | `/api/admin/dashboard` | fetch for client refetch | WIRED | Line 132: `fetch('/api/admin/dashboard?...')` |
| `app/admin/dashboard/DashboardClient.tsx` | `components/admin/MapView.tsx` | import MapView | WIRED | Line 27: `import { MapView }` |
| `app/admin/dashboard/DashboardClient.tsx` | `components/admin/SparklineChart.tsx` | import SparklineChart | WIRED | Line 26: `import { SparklineChart }` |
| `lib/admin/services/new-activity.ts` | `mv_category_stats` | `.select('drug_category, animal_type, query_type, count')` | WIRED | Line 279: correct column names post-fix |
| `app/admin/new-activity/page.tsx` | `lib/admin/services/new-activity.ts` | direct import for SSR | WIRED | Line 2: `import { getNewActivityData }` |
| `app/api/admin/new-activity/route.ts` | `lib/admin/services/new-activity.ts` | import getNewActivityData | WIRED | Line 3: `import { getNewActivityData }` |
| `app/admin/new-activity/NewActivityClient.tsx` | `/api/admin/new-activity` | fetch for client refetch | WIRED | Line 76: `fetch('/api/admin/new-activity?...')` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DASH-01 | Plan 01 + 04 | GET /api/admin/dashboard returns correct shape | SATISFIED | Route wired; category_stats queries fixed (drug_category, count); per-user breakdown from query_events |
| DASH-02 | Plan 01 | forecast.ts linear regression, 3 months, is_forecast flag | SATISFIED | forecast.ts verified correct; 5 passing vitest tests |
| DASH-03 | Plan 02 | "Tong quan" section: grouped BarChart + forecast ComposedChart | SATISFIED | DashboardClient.tsx has both charts; strokeDasharray="4 4" for forecast |
| DASH-04 | Plan 02 + 04 | "Chi so tap trung" section: daily LineChart, 5 KPIs, 6 donuts | SATISFIED | All present in DashboardClient.tsx; donut data now correctly sourced from drug_category |
| DASH-05 | Plan 02 + 04 | "Nguoi dung" section: top-20 table with sparklines, 2 BarCharts | SATISFIED | Table with SparklineChart per row; per-user drug_group_breakdown from query_events |
| DASH-06 | Plan 02 | "Phong kham" section: Leaflet map + top-10 horizontal BarChart | SATISFIED | MapView with colored pins + top_clinics BarChart |
| ACT-01 | Plan 03 + 04 | GET /api/admin/new-activity returns 6 KPIs + all fields | SATISFIED | Route wired; category_stats drug_category fixed |
| ACT-02 | Plan 03 | 6 KPI cards with distinct colored backgrounds | SATISFIED | bg-blue-600, bg-orange-500, bg-cyan-500, bg-pink-500, bg-emerald-500, bg-violet-500 |
| ACT-03 | Plan 03 | AreaChart (daily volume) + BarChart (sessions) side by side | SATISFIED | Two charts in grid grid-cols-2 |
| ACT-04 | Plan 03 | Recent sessions table with 5 columns | SATISFIED | Ma phien, Ngay, Nguoi dung, So truy van, Thoi gian (phut) |
| ACT-05 | Plan 03 | Top 10 questions horizontal BarChart | SATISFIED | layout="vertical" BarChart with question_prefix and count |
| ACT-06 | Plan 03 + 04 | 3 category donut PieCharts | SATISFIED | 3 PieCharts for animal_types, drug_groups, query_types; data now sourced from drug_category column |

**All 12 requirements satisfied.**

---

## Anti-Patterns Found

No blockers or warnings. The previously-identified column mismatch anti-patterns have been resolved:

| File | Previous Issue | Resolution |
|------|---------------|------------|
| `lib/admin/services/dashboard.ts` | Queried `drug_group`, `query_count`, `user_id` from `mv_category_stats` | Fixed in commit `3ac7a0e3`: now uses `drug_category`, `count`; no `user_id` on view |
| `lib/admin/services/new-activity.ts` | Queried `drug_group` from `mv_category_stats` | Fixed in commit `35dccf8f`: now uses `drug_category` |

---

## Human Verification Required

### 1. Dashboard KPI Cards Display

**Test:** Log in as admin, navigate to /admin/dashboard
**Expected:** 5 KPI cards show non-zero values (total_queries, total_sessions, total_users, total_documents, total_staff)
**Why human:** Cannot verify Supabase query results without running the app against the seeded database

### 2. Dashboard Category Donut Charts

**Test:** On /admin/dashboard, open the "Chi so tap trung" section
**Expected:** 6 PieCharts (drug_category x2, animal_type x2, query_type x2) each display named slices with non-zero counts
**Why human:** Requires live browser session with seeded mv_category_stats data

### 3. Filter Changes Preserve KPI Values

**Test:** On /admin/dashboard, change the province filter and observe KPI cards
**Expected:** KPI cards remain unchanged (platform-wide); charts and user table update to reflect filtered data
**Why human:** Requires interactive browser session to observe state changes

### 4. New Activity 6 Colored KPI Cards

**Test:** Navigate to /admin/new-activity
**Expected:** 6 KPI cards render with distinct backgrounds: blue, orange, cyan, pink, green, purple; all show non-zero values for a month with seeded data
**Why human:** Visual rendering and data population requires browser session

### 5. New Activity Category Donut Charts

**Test:** On /admin/new-activity, scroll to the donut chart section
**Expected:** 3 PieCharts (animal_types, drug_groups, query_types) display named slices
**Why human:** Requires live browser session with seeded mv_category_stats data

### 6. Leaflet Map Renders with Pins

**Test:** On /admin/dashboard, scroll to the "Khach hang" section
**Expected:** Vietnam map renders with colored marker pins (green >50 queries, yellow 10-50, red 1-9, grey 0)
**Why human:** Leaflet renders in browser only; cannot verify map rendering programmatically

---

## Gaps Summary

No gaps remain. All 3 gaps from the initial verification were closed by Plan 04 (commits `3ac7a0e3` and `35dccf8f`):

1. `dashboard.ts` now selects `drug_category, animal_type, query_type, count` from `mv_category_stats` (not `drug_group, query_count`) and filters by `province`/`clinic_type` directly on the view.
2. `dashboard.ts` per-user category breakdown now queries `query_events` with `.in('user_id', top20Ids)` — the table that actually has a `user_id` column.
3. `new-activity.ts` now selects `drug_category` and accesses `row.drug_category` (not `drug_group`).

The `drug_groups` / `drug_group_breakdown` field names in the API response objects are response-layer naming conventions, not database column references — they are correct and unchanged.

Remaining items are live-browser verification only: KPI card values, donut chart population, filter interactivity, and Leaflet map rendering.

---

_Verified: 2026-03-19T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
