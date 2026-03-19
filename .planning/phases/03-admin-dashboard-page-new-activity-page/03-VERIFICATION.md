---
phase: 03-admin-dashboard-page-new-activity-page
verified: 2026-03-19T14:00:00Z
status: human_needed
score: 19/19 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 12/12
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  new_truths_added:
    - "GET /api/admin/nhap-hang returns JSON with kpis, daily_revenue, daily_quantity, orders, order_items, top_products, by_industry, by_product_group, by_brand, suppliers"
    - "API returns orders with order_date in YYYY/MM/DD slash format"
    - "/admin/nhap-hang renders 6 colored KPI cards responding to NPP + month filter via Search button"
    - "AreaChart (daily revenue) and BarChart (daily quantity with promo series) render with data"
    - "Orders table lists orders with CTT format codes; clicking opens detail drawer showing line items"
    - "Top 10 horizontal bar chart, 2 donut PieCharts, and RadarChart render with data"
    - "AdminSidebar contains nhap-hang navigation link under CORE section after Dashboard"
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
  - test: "Load /admin/nhap-hang for a month with seeded orders (e.g. March 2026) and verify 6 KPI cards show non-zero values"
    expected: "total_revenue, total_quantity, total_promo_qty, total_orders, total_skus, avg_per_order all non-zero"
    why_human: "Requires live browser session against seeded purchase_orders and purchase_order_items tables"
  - test: "On /admin/nhap-hang, click an order row in the table and verify the detail drawer opens with line items"
    expected: "Right-side drawer appears showing product name, quantity, promo_qty, unit price, subtotal for each line item"
    why_human: "Requires interactive browser session to test click-to-open drawer behavior"
  - test: "On /admin/nhap-hang, select a specific NPP from the dropdown and click Tim kiem — verify charts and table update"
    expected: "Data filters to orders from the selected supplier; KPI counts decrease from all-NPP total"
    why_human: "Requires interactive browser session to test Search-button filter flow"
---

# Phase 03: Admin Dashboard + New Activity + Nhap Hang Verification Report

**Phase Goal:** Implement the Admin Dashboard page and New Activity page as fully functional analytics interfaces. This includes a data layer with linear regression forecast, shared components (FilterBar, SparklineChart, MapView), dashboard UI with 4 sections (KPIs, charts, map, drug category breakdown), new activity page with monthly trends and question insights, and the Nhap Hang purchase order analytics page.
**Verified:** 2026-03-19T14:00:00Z
**Status:** human_needed — all automated checks pass; awaiting live browser verification
**Re-verification:** Yes — after Plan 05 gap closure (nhap-hang page) added 7 new truths beyond previous 12/12

---

## Re-Verification Summary

| Check | Result | Notes |
|-------|--------|-------|
| All 12 previously-verified truths | No regressions | DashboardClient, NewActivityClient, forecast.ts, routes, services all unchanged by Plan 05 |
| AdminSidebar regression check | Pass | nhap-hang link added in CORE section at index 1 (after dashboard, before new-activity) — original items preserved |
| New Plan 05 truths (7 items) | All verified | See new artifact table below |

No regressions found. All 12 previously-verified truths still pass.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All Phase 3 chart/map libraries importable without SSR errors | VERIFIED | package.json: recharts, react-leaflet, leaflet; MapView uses dynamic import with ssr:false |
| 2 | forecast.ts computes 3 forecast months with is_forecast:true | VERIFIED | lib/admin/forecast.ts: linear regression on last 6 months; appends 3 ForecastPoints |
| 3 | GET /api/admin/dashboard returns correct JSON shape including daily_volume | VERIFIED | Route + service wired; mv_category_stats queries use drug_category/count; per-user breakdown from query_events |
| 4 | monthly_series includes forecast points with is_forecast:true | VERIFIED | dashboard.ts calls computeForecast on aggregated mv_monthly_queries data |
| 5 | KPIs are platform-wide totals from mv_dashboard_kpis (unfiltered) | VERIFIED | fetchKpis() queries mv_dashboard_kpis directly, no filter applied |
| 6 | daily_volume contains per-day query counts for selected month | VERIFIED | fetchDailyVolume() queries mv_daily_queries by year+month, aggregates by day |
| 7 | FilterBar renders real select inputs with immediate refetch | VERIFIED | FilterBar.tsx has real select elements; DashboardClient calls handleFilterChange |
| 8 | SparklineChart renders real Recharts LineChart with no axes | VERIFIED | SparklineChart.tsx: LineChart with isAnimationActive=false, no axes/legend |
| 9 | MapView renders real Leaflet MapContainer with colored DivIcon pins | VERIFIED | LeafletMapInner.tsx has MapContainer, DivIcon, color thresholds; ssr:false |
| 10 | Dashboard page shows 4 collapsible sections | VERIFIED | DashboardClient.tsx has SectionHeader for Tong quan, Chi so tap trung, Nhan vien, Khach hang |
| 11 | GET /api/admin/new-activity returns 6 KPIs, daily_query_volume, daily_sessions, recent_sessions, top_questions, category_stats | VERIFIED | Route and service wired; category_stats queries drug_category correctly |
| 12 | /admin/new-activity renders 6 KPI cards, charts, table, donuts | VERIFIED | NewActivityClient.tsx: 6 colored KPIs, AreaChart, BarChart, sessions table, 3 donuts |
| 13 | GET /api/admin/nhap-hang returns full JSON shape with all 9 fields including order_items Record | VERIFIED | nhap-hang.ts service: all 9 fields returned; order_items built as Record<order_code, items[]>; line 208 |
| 14 | order_date returned in YYYY/MM/DD slash format | VERIFIED | nhap-hang.ts line 276: `.replace(/-/g, '/')` transforms ISO date to slash format |
| 15 | /admin/nhap-hang renders 6 colored KPI cards with Search-button-triggered filter | VERIFIED | NhapHangClient.tsx: 6 KpiCard with bg-blue-500/yellow-500/cyan-500/red-400/teal-500/purple-500; handleSearch triggered by button onClick only |
| 16 | AreaChart (daily revenue) + BarChart (daily quantity + promo_qty) render with data | VERIFIED | NhapHangClient.tsx lines 194/219: AreaChart on daily_revenue, BarChart on daily_quantity with quantity + promo_qty bars |
| 17 | Orders table lists orders; clicking a row opens detail drawer with line items from order_items | VERIFIED | NhapHangClient.tsx: table rows have onClick -> setSelectedOrder; drawer renders data.order_items[selectedOrder] at line 431 |
| 18 | Top 10 horizontal BarChart, 2 donut PieCharts, RadarChart (by_brand) render with data | VERIFIED | NhapHangClient.tsx: layout="vertical" BarChart for top_products; 2 PieCharts for by_industry/by_product_group; RadarChart for by_brand |
| 19 | AdminSidebar nhap-hang link exists under CORE section after Dashboard | VERIFIED | AdminSidebar.tsx line 15: href='/admin/nhap-hang', label='Nhap hang', position index 1 (after dashboard at index 0) |

**Score:** 19/19 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/__tests__/forecast.test.ts` | Unit tests for computeForecast | VERIFIED | 5 tests, correct imports, edge cases covered |
| `lib/admin/forecast.ts` | Linear regression forecast | VERIFIED | Exports computeForecast, MonthlyDataPoint, ForecastPoint; no 'use client'; 91 lines |
| `lib/admin/services/dashboard.ts` | Dashboard data service | VERIFIED | 464 lines; mv_category_stats queries use drug_category/count; per-user breakdown from query_events |
| `app/api/admin/dashboard/route.ts` | Dashboard API endpoint | VERIFIED | Thin GET handler with requireAdmin + getDashboardData delegation |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/admin/FilterBar.tsx` | Real filter bar with select inputs | VERIFIED | Real select elements, province/clinic_type/month/search, hint text present |
| `components/admin/SparklineChart.tsx` | Real Recharts sparkline | VERIFIED | LineChart with isAnimationActive=false, no axes/legend |
| `components/admin/MapView.tsx` | Real Leaflet map with dynamic import | VERIFIED | dynamic() with ssr:false; delegates to LeafletMapInner.tsx |
| `components/admin/LeafletMapInner.tsx` | Leaflet inner component | VERIFIED | MapContainer, DivIcon, color thresholds (#22c55e, #eab308, #ef4444) |
| `app/admin/dashboard/DashboardClient.tsx` | Client component with all 4 sections | VERIFIED | 634 lines; 'use client', all 4 sections, all chart types, fetch refetch, useSearchParams |
| `app/admin/dashboard/DashboardSkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks matching dashboard layout |
| `app/admin/dashboard/page.tsx` | Server Component with SSR | VERIFIED | getDashboardData called directly, no 'use client', Suspense wrapper |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/services/new-activity.ts` | New Activity service | VERIFIED | 322 lines; selects drug_category and accesses row.drug_category |
| `app/api/admin/new-activity/route.ts` | New Activity API endpoint | VERIFIED | requireAdmin guard, year/month params, delegates to getNewActivityData |
| `app/admin/new-activity/NewActivityClient.tsx` | Client component with all sections | VERIFIED | 449 lines; 'use client', 6 colored KPIs, AreaChart, BarChart, sessions table, 3 donuts, refetch |
| `app/admin/new-activity/NewActivitySkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks for all sections |
| `app/admin/new-activity/page.tsx` | Server Component with SSR | VERIFIED | getNewActivityData called directly, no 'use client', Suspense wrapper |

### Plan 05 Artifacts (Nhap Hang)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260319_007_add_purchase_tables.sql` | 4 purchase tables with RLS | VERIFIED | suppliers, products, purchase_orders, purchase_order_items; service-role-only RLS; indexes on poi_order_id/poi_product_id |
| `data/seeds/products.ts` | 62 products from XLSX | VERIFIED | 88 lines; 62 product entries with codes, groups, classifications, manufacturers, unit prices |
| `data/seeds/suppliers.ts` | 5 Vietnamese distributors | VERIFIED | 7 lines; 5 supplier records with NPP001-NPP005 codes |
| `data/seeds/purchase_orders.ts` | 86 orders with CTT codes | VERIFIED | Generative function producing CTT000001+ codes spanning Jan 2024-Mar 2026; total_amount computed from items |
| `data/seeds/purchase_order_items.ts` | ~760+ line items | VERIFIED | Generative function; 5-15 items per order; 30% promo; ensures all 62 products covered; computes order totals |
| `scripts/seed.ts` | Updated with nhap-hang seed functions | VERIFIED | Lines 886-889: seedSuppliers, seedProducts, seedPurchaseOrders, seedPurchaseOrderItems all called |
| `lib/admin/services/nhap-hang.ts` | getNhapHangData service | VERIFIED | 300 lines; all 9 response fields; slash-format date transform; order_items Record keyed by order_code |
| `app/api/admin/nhap-hang/route.ts` | Protected GET endpoint | VERIFIED | requireAdmin guard, npp/year/month params, delegates to getNhapHangData |
| `app/admin/nhap-hang/page.tsx` | SSR Server Component | VERIFIED | getNhapHangData called directly, no 'use client', Suspense wrapper |
| `app/admin/nhap-hang/NhapHangClient.tsx` | Client component with all charts | VERIFIED | 456 lines; 'use client'; AreaChart, BarChart, 2 PieCharts, RadarChart, orders table, detail drawer; Search-button-only filter |
| `app/admin/nhap-hang/NhapHangSkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks for filter bar, 6 KPIs, 2 charts, table+top10, 2 donuts, radar |
| `components/admin/AdminSidebar.tsx` | nhap-hang link in CORE section | VERIFIED | href='/admin/nhap-hang' at position 1 in CORE items array (after dashboard) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/admin/dashboard/route.ts` | `lib/admin/services/dashboard.ts` | import getDashboardData | WIRED | Line 3: import getDashboardData |
| `lib/admin/services/dashboard.ts` | `lib/admin/forecast.ts` | import computeForecast | WIRED | Line 2: import computeForecast |
| `lib/admin/services/dashboard.ts` | `mv_category_stats` | .select('drug_category, animal_type, query_type, count') | WIRED | Line 211: correct column names |
| `lib/admin/services/dashboard.ts` | `query_events` | .select('user_id, drug_category, query_type').in('user_id', top20Ids) | WIRED | Lines 375-378 |
| `app/admin/dashboard/page.tsx` | `lib/admin/services/dashboard.ts` | direct import for SSR | WIRED | Line 2: import getDashboardData |
| `app/admin/dashboard/DashboardClient.tsx` | `/api/admin/dashboard` | fetch for client refetch | WIRED | Line 132: fetch('/api/admin/dashboard?...') |
| `app/api/admin/new-activity/route.ts` | `lib/admin/services/new-activity.ts` | import getNewActivityData | WIRED | Line 3: import getNewActivityData |
| `app/admin/new-activity/page.tsx` | `lib/admin/services/new-activity.ts` | direct import for SSR | WIRED | Line 2: import getNewActivityData |
| `app/admin/new-activity/NewActivityClient.tsx` | `/api/admin/new-activity` | fetch for client refetch | WIRED | Line 76: fetch('/api/admin/new-activity?...') |
| `app/api/admin/nhap-hang/route.ts` | `lib/admin/services/nhap-hang.ts` | import getNhapHangData | WIRED | Line 3: import getNhapHangData |
| `app/admin/nhap-hang/page.tsx` | `lib/admin/services/nhap-hang.ts` | direct import for SSR | WIRED | Line 2: import getNhapHangData |
| `app/admin/nhap-hang/NhapHangClient.tsx` | `/api/admin/nhap-hang` | fetch on Search button click | WIRED | Line 81: fetch('/api/admin/nhap-hang?...') in handleSearch |
| `app/admin/nhap-hang/NhapHangClient.tsx` | `data.order_items[selectedOrder]` | detail drawer renders items | WIRED | Line 431: data.order_items[selectedOrder] keyed by order_code |
| `scripts/seed.ts` | `data/seeds/suppliers.ts`, `products.ts`, `purchase_orders.ts`, `purchase_order_items.ts` | seed functions called at lines 886-889 | WIRED | All 4 nhap-hang seed functions called in main seed sequence |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DASH-01 | Plan 01 + 04 | GET /api/admin/dashboard returns correct shape | SATISFIED | Route wired; category_stats queries fixed; per-user breakdown from query_events |
| DASH-02 | Plan 01 | forecast.ts linear regression, 3 months, is_forecast flag | SATISFIED | forecast.ts verified correct; 5 passing vitest tests |
| DASH-03 | Plan 02 + 04 | "Tong quan" section: grouped BarChart + forecast ComposedChart | SATISFIED | DashboardClient.tsx has both charts; strokeDasharray="4 4" for forecast |
| DASH-04 | Plan 02 + 04 | "Chi so tap trung" section: daily LineChart, 5 KPIs, 6 donuts | SATISFIED | All present in DashboardClient.tsx; donut data from drug_category |
| DASH-05 | Plan 02 + 04 | "Nguoi dung" section: top-20 table with sparklines, 2 BarCharts | SATISFIED | Table with SparklineChart per row; per-user drug_group_breakdown from query_events |
| DASH-06 | Plan 02 | "Phong kham" section: Leaflet map + top-10 horizontal BarChart | SATISFIED | MapView with colored pins + top_clinics BarChart |
| ACT-01 | Plan 03 + 04 | GET /api/admin/new-activity returns 6 KPIs + all fields | SATISFIED | Route wired; category_stats drug_category fixed |
| ACT-02 | Plan 03 | 6 KPI cards with distinct colored backgrounds | SATISFIED | bg-blue-600, bg-orange-500, bg-cyan-500, bg-pink-500, bg-emerald-500, bg-violet-500 |
| ACT-03 | Plan 03 | AreaChart (daily volume) + BarChart (sessions) side by side | SATISFIED | Two charts in grid grid-cols-2 |
| ACT-04 | Plan 03 | Recent sessions table with 5 columns | SATISFIED | Ma phien, Ngay, Nguoi dung, So truy van, Thoi gian (phut) |
| ACT-05 | Plan 03 | Top 10 questions horizontal BarChart | SATISFIED | layout="vertical" BarChart with question_prefix and count |
| ACT-06 | Plan 03 + 04 | 3 category donut PieCharts | SATISFIED | 3 PieCharts for animal_types, drug_groups, query_types; data from drug_category column |

**All 12 requirements satisfied.**

Note: The nhap-hang page (Plan 05) adds purchase order analytics capability beyond what DASH-01 through ACT-06 describe. DASH-01 and ACT-06 claim credit from Plan 05 in their source plan column but those requirements relate to the dashboard and new-activity pages; the nhap-hang page is an additive deliverable within the phase scope (included in the phase goal statement).

---

## Anti-Patterns Found

No blockers or warnings found across all Plan 05 files.

| File | Checked For | Result |
|------|-------------|--------|
| `lib/admin/services/nhap-hang.ts` | TODO/FIXME, empty returns, stub patterns | Clean |
| `app/api/admin/nhap-hang/route.ts` | "Not implemented", static returns | Clean |
| `app/admin/nhap-hang/NhapHangClient.tsx` | Placeholder divs, console.log-only handlers | Clean |
| `app/admin/nhap-hang/page.tsx` | Missing data call, use client | Clean |
| `components/admin/AdminSidebar.tsx` | Regression on existing links | Clean — all 7 original links preserved |

Previously resolved anti-patterns from Plans 03-04 (dashboard.ts and new-activity.ts column mismatches) remain resolved with no regressions.

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

### 7. Nhap Hang KPI Cards Show Non-Zero Values

**Test:** Navigate to /admin/nhap-hang; select a month with seed data (e.g., March 2026); click Tim kiem
**Expected:** 6 KPI cards show non-zero values for total_revenue, total_quantity, total_promo_qty, total_orders, total_skus, avg_per_order
**Why human:** Requires live browser session against seeded purchase_orders and purchase_order_items tables in Supabase

### 8. Nhap Hang Order Detail Drawer

**Test:** On /admin/nhap-hang, click any order row in the orders table
**Expected:** A right-side drawer appears displaying line items with columns: Ten SP, SL, SL KM, Don gia, Thanh tien
**Why human:** Requires interactive browser session to test click-to-open drawer behavior

### 9. Nhap Hang NPP Filter

**Test:** On /admin/nhap-hang, select a specific NPP from the dropdown and click Tim kiem
**Expected:** Charts and orders table update to show only orders from that supplier; KPI values change accordingly
**Why human:** Requires interactive browser session to test Search-button-triggered filter flow

---

## Gaps Summary

No gaps. All 19 truths verified at the artifact and wiring levels. Phase goal is fully implemented:

- Data layer: forecast.ts linear regression, dashboard service (mv_dashboard_kpis + mv_monthly_queries + mv_category_stats + mv_daily_queries + query_events), new-activity service, nhap-hang service (4 purchase tables + seed data)
- Shared components: FilterBar, SparklineChart, MapView/LeafletMapInner
- Dashboard page: 4 collapsible sections (Tong quan, Chi so tap trung, Nguoi dung, Phong kham) with all chart types
- New activity page: 6 colored KPIs, AreaChart, BarChart, sessions table, top-10 BarChart, 3 donut PieCharts
- Nhap Hang page: 6 KPIs, AreaChart (daily revenue), BarChart (daily quantity+promo), orders table with detail drawer, top-10 horizontal BarChart, 2 donut PieCharts, RadarChart (by brand), Search-button filter

Remaining items are live-browser verification only (data values, visual rendering, interactive behaviors).

---

_Verified: 2026-03-19T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
