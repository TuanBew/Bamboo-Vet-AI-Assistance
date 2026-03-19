---
phase: 03-admin-dashboard-page-new-activity-page
verified: 2026-03-19T16:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "app/admin/new-activity/ directory deleted — no more orphaned files importing the removed service"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load /admin/dashboard with seed data populated and verify KPI cards show non-zero values"
    expected: "All 5 KPI cards display numbers from mv_dashboard_kpis"
    why_human: "Cannot verify Supabase query results without running the app against the seeded database"
  - test: "Load /admin/dashboard and verify category donut charts show non-empty slices"
    expected: "6 PieCharts in Chi so tap trung section display named slices for drug_category, animal_type, and query_type"
    why_human: "Requires live browser session with seeded mv_category_stats data"
  - test: "Change month filter on /admin/dashboard and verify KPI cards do NOT change while charts update"
    expected: "KPI cards remain showing platform-wide totals; charts and table reflect the filtered month"
    why_human: "Requires interactive browser session to test filter state"
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

# Phase 03: Admin Dashboard + Nhap Hang Verification Report

**Phase Goal:** The primary analytics pages are fully functional — /admin/dashboard displays platform-wide KPIs, time-series charts with a 3-month forecast dotted line, category donut charts, a user table with sparklines, and a Leaflet clinic map; /admin/nhap-hang shows 6 KPI cards, purchase order charts, orders table with detail drawer, and supplier/product analytics.
**Verified:** 2026-03-19T16:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (orphaned new-activity directory deleted)

---

## Re-Verification Summary

| Check | Result | Notes |
|-------|--------|-------|
| DASH-01 through DASH-06 (dashboard) | No regressions | All artifacts, services, and API routes intact |
| Nhap-hang (nhap-hang page) | No regressions | Service, API, page, client, seeds all intact |
| AdminSidebar new-activity link | Correctly absent | No /admin/new-activity link in sidebar |
| app/api/admin/new-activity/ | Correctly deleted | Route directory removed |
| lib/admin/services/new-activity.ts | Correctly deleted | Service module removed |
| app/admin/new-activity/ | CLOSED | Directory deleted — no orphaned files remain |
| Codebase-wide new-activity references | Zero | grep on app/, lib/, components/ returns no matches |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | forecast.ts computes 3 forecast months with is_forecast:true | VERIFIED | lib/admin/forecast.ts: 91 lines; linear regression on last 6 months; appends 3 ForecastPoints with is_forecast:true |
| 2 | GET /api/admin/dashboard returns correct JSON shape including daily_volume | VERIFIED | app/api/admin/dashboard/route.ts: requireAdmin guard, delegates to getDashboardData; service imports computeForecast |
| 3 | monthly_series includes forecast points with is_forecast:true | VERIFIED | dashboard.ts calls computeForecast on aggregated mv_monthly_queries data |
| 4 | KPIs are platform-wide totals from mv_dashboard_kpis (unfiltered) | VERIFIED | fetchKpis() queries mv_dashboard_kpis directly at line 135, no filter applied |
| 5 | daily_volume contains per-day query counts for selected month | VERIFIED | fetchDailyVolume() queries mv_daily_queries by year+month at line 258 |
| 6 | FilterBar renders real select inputs; DashboardClient refetches on change | VERIFIED | FilterBar.tsx has real select elements; DashboardClient imports FilterBar and calls handleFilterChange |
| 7 | SparklineChart renders real Recharts LineChart with no axes | VERIFIED | SparklineChart.tsx: LineChart with isAnimationActive=false, no axes/legend |
| 8 | MapView renders real Leaflet MapContainer with colored DivIcon pins | VERIFIED | LeafletMapInner.tsx: MapContainer, DivIcon, color thresholds (#22c55e, #eab308, #ef4444); MapView uses dynamic ssr:false |
| 9 | Dashboard page shows 4 collapsible sections | VERIFIED | DashboardClient.tsx (634 lines): SectionHeader for Tong quan, Chi so tap trung, Nhan vien, Khach hang; ComposedChart with strokeDasharray="4 4" for forecast |
| 10 | GET /api/admin/nhap-hang returns full JSON with all fields including order_items Record | VERIFIED | nhap-hang.ts service: 300 lines; all 9 response fields; order_items built as Record<order_code, items[]>; order_date slash transform at line 276 |
| 11 | /admin/nhap-hang renders 6 KPI cards, charts, orders table, detail drawer, and Search-button filter | VERIFIED | NhapHangClient.tsx (456 lines): 6 KpiCards, AreaChart, BarChart, 2 PieCharts, RadarChart; handleSearch() triggers on button onClick only at line 135 |
| 12 | AdminSidebar contains nhap-hang navigation link under CORE section after Dashboard | VERIFIED | AdminSidebar.tsx: href='/admin/nhap-hang' at index 1 in CORE items (after dashboard at index 0); no new-activity link |
| 13 | No orphaned new-activity files remain that would cause build errors | VERIFIED | app/admin/new-activity/ directory deleted; zero new-activity references across app/, lib/, components/ |

**Score:** 13/13 truths verified

---

## Required Artifacts

### Dashboard + Data Layer

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/forecast.ts` | Linear regression forecast | VERIFIED | 91 lines; exports computeForecast, MonthlyDataPoint, ForecastPoint; no 'use client' |
| `lib/admin/services/dashboard.ts` | Dashboard data service | VERIFIED | 463 lines; mv_dashboard_kpis, mv_monthly_queries, mv_category_stats, mv_daily_queries, query_events; computeForecast wired |
| `app/api/admin/dashboard/route.ts` | Dashboard API endpoint | VERIFIED | requireAdmin guard, delegates to getDashboardData |
| `app/admin/dashboard/DashboardClient.tsx` | Client with 4 sections | VERIFIED | 634 lines; 'use client'; Tong quan (BarChart + ComposedChart/forecast), Chi so tap trung (LineChart + 6 PieCharts), Nhan vien (SparklineChart + BarChart), Khach hang (MapView + BarChart) |
| `app/admin/dashboard/DashboardSkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks present |
| `app/admin/dashboard/page.tsx` | Server Component SSR | VERIFIED | no 'use client'; getDashboardData called directly; Suspense wrapper |

### Shared Components

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/admin/FilterBar.tsx` | Real filter bar | VERIFIED | Real select elements, province/clinic_type/month/search |
| `components/admin/SparklineChart.tsx` | Real Recharts sparkline | VERIFIED | LineChart with isAnimationActive=false, no axes/legend |
| `components/admin/MapView.tsx` | Leaflet map with dynamic import | VERIFIED | dynamic() with ssr:false; delegates to LeafletMapInner.tsx |
| `components/admin/LeafletMapInner.tsx` | Leaflet inner component | VERIFIED | MapContainer, DivIcon, color thresholds |
| `components/admin/AdminSidebar.tsx` | Sidebar without new-activity link | VERIFIED | nhap-hang at CORE index 1; no new-activity entry |

### Nhap Hang

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/admin/services/nhap-hang.ts` | getNhapHangData service | VERIFIED | 300 lines; all 9 response fields; slash-format date transform at line 276 |
| `app/api/admin/nhap-hang/route.ts` | Protected GET endpoint | VERIFIED | requireAdmin guard; npp/year/month params; delegates to getNhapHangData |
| `app/admin/nhap-hang/page.tsx` | SSR Server Component | VERIFIED | no 'use client'; getNhapHangData called directly; Suspense wrapper |
| `app/admin/nhap-hang/NhapHangClient.tsx` | Client with charts + drawer | VERIFIED | 456 lines; 'use client'; AreaChart, BarChart, 2 PieCharts, RadarChart; handleSearch on button click; drawer on row click |
| `app/admin/nhap-hang/NhapHangSkeleton.tsx` | Loading skeleton | VERIFIED | animate-pulse blocks for all sections |
| `data/seeds/suppliers.ts` | 5 Vietnamese distributors | VERIFIED | 5 supplier records NPP001-NPP005 |
| `data/seeds/products.ts` | 62 products | VERIFIED | 88 lines; 62 product entries |
| `data/seeds/purchase_orders.ts` | Orders with CTT codes | VERIFIED | Generative CTT000001+ spanning Jan 2024-Mar 2026 |
| `data/seeds/purchase_order_items.ts` | Line items for all orders | VERIFIED | 5-15 items per order; 30% promo; all 62 products covered |
| `scripts/seed.ts` | Nhap-hang seed functions called | VERIFIED | Lines 886-889: all 4 nhap-hang seed functions in main sequence |
| `supabase/migrations/20260319_007_add_purchase_tables.sql` | 4 purchase tables with RLS | VERIFIED | File present |

### Correctly Absent (New-Activity)

| Artifact | Expected | Status |
|----------|----------|--------|
| `app/admin/new-activity/` | Must NOT exist | CONFIRMED ABSENT |
| `app/api/admin/new-activity/` | Must NOT exist | CONFIRMED ABSENT |
| `lib/admin/services/new-activity.ts` | Must NOT exist | CONFIRMED ABSENT |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/admin/dashboard/route.ts` | `lib/admin/services/dashboard.ts` | import getDashboardData | WIRED | Line 3: import getDashboardData |
| `lib/admin/services/dashboard.ts` | `lib/admin/forecast.ts` | import computeForecast | WIRED | Line 2: import computeForecast |
| `lib/admin/services/dashboard.ts` | `mv_category_stats` | .select('drug_category, animal_type, query_type, count') | WIRED | Line 211: correct column names |
| `lib/admin/services/dashboard.ts` | `query_events` | .select('user_id, drug_category, query_type') | WIRED | Lines 376-377 |
| `app/admin/dashboard/page.tsx` | `lib/admin/services/dashboard.ts` | direct import SSR | WIRED | Line 2: import getDashboardData |
| `app/admin/dashboard/DashboardClient.tsx` | `/api/admin/dashboard` | fetch for client refetch | WIRED | fetch('/api/admin/dashboard?...') present |
| `app/api/admin/nhap-hang/route.ts` | `lib/admin/services/nhap-hang.ts` | import getNhapHangData | WIRED | Line 3: import getNhapHangData |
| `app/admin/nhap-hang/page.tsx` | `lib/admin/services/nhap-hang.ts` | direct import SSR | WIRED | Line 2: import getNhapHangData |
| `app/admin/nhap-hang/NhapHangClient.tsx` | `/api/admin/nhap-hang` | fetch on Search button click | WIRED | Line 81: fetch('/api/admin/nhap-hang?...') in handleSearch |
| `app/admin/nhap-hang/NhapHangClient.tsx` | `data.order_items[selectedOrder]` | detail drawer renders items | WIRED | Line 431: data.order_items[selectedOrder] keyed by order_code |
| `scripts/seed.ts` | nhap-hang seed functions | all 4 called in sequence | WIRED | Lines 886-889 |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| DASH-01 | GET /api/admin/dashboard returns KPIs, monthly_series (with forecast), category_stats, top_users with sparklines, clinic_map pins, top_clinics | SATISFIED | Route wired; service queries mv_dashboard_kpis, mv_monthly_queries, mv_category_stats, mv_daily_queries, query_events; computeForecast appends is_forecast points |
| DASH-02 | lib/admin/forecast.ts linear regression, 3 months, is_forecast flag | SATISFIED | 91 lines; computeForecast uses last 6 months; 3 forecast points with is_forecast:true |
| DASH-03 | "Tong quan" section: grouped BarChart + forecast ComposedChart with strokeDasharray="4 4" | SATISFIED | DashboardClient.tsx: BarChart for yearly data; ComposedChart with strokeDasharray="4 4" for forecast at line 338 |
| DASH-04 | "Chi so tap trung" section: daily LineChart, 5 KPI cards, 6 donut PieCharts | SATISFIED | DashboardClient.tsx: LineChart on daily_volume; 5 KPI cards; 6 PieCharts for drug_groups/animal_types/query_types (queries + sessions) |
| DASH-05 | "Nguoi dung" section: top-20 table with SparklineChart per row, 2 inline BarCharts | SATISFIED | DashboardClient.tsx: SparklineChart in table rows; 2 BarCharts for province and clinic_type breakdowns |
| DASH-06 | "Phong kham" section: Leaflet map with color-coded pins + top 10 horizontal BarChart | SATISFIED | MapView with DivIcon color thresholds; top_clinics BarChart with layout="vertical" |

Note: ACT-01 through ACT-06 were removed from scope along with the new-activity feature. Only DASH-01 through DASH-06 apply for Phase 3.

**All 6 DASH requirements satisfied.**

---

## Anti-Patterns Found

None. Previously-identified blockers (orphaned new-activity files importing deleted module) have been resolved by deleting `app/admin/new-activity/`.

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

### 4. Leaflet Map Renders with Pins

**Test:** On /admin/dashboard, scroll to the "Khach hang" section
**Expected:** Vietnam map renders with colored marker pins (green >50 queries, yellow 10-50, red 1-9, grey 0)
**Why human:** Leaflet renders in browser only; cannot verify map rendering programmatically

### 5. Nhap Hang KPI Cards Show Non-Zero Values

**Test:** Navigate to /admin/nhap-hang; select a month with seed data (e.g., March 2026); click Tim kiem
**Expected:** 6 KPI cards show non-zero values for total_revenue, total_quantity, total_promo_qty, total_orders, total_skus, avg_per_order
**Why human:** Requires live browser session against seeded purchase_orders and purchase_order_items tables in Supabase

### 6. Nhap Hang Order Detail Drawer

**Test:** On /admin/nhap-hang, click any order row in the orders table
**Expected:** A right-side drawer appears displaying line items with columns: Ten SP, SL, SL KM, Don gia, Thanh tien
**Why human:** Requires interactive browser session to test click-to-open drawer behavior

### 7. Nhap Hang NPP Filter

**Test:** On /admin/nhap-hang, select a specific NPP from the dropdown and click Tim kiem
**Expected:** Charts and orders table update to show only orders from that supplier; KPI values change accordingly
**Why human:** Requires interactive browser session to test Search-button-triggered filter flow

---

## Gaps Summary

No gaps remain. The single blocker from the previous verification — orphaned `app/admin/new-activity/` files importing the deleted service module — has been resolved. The directory was deleted and zero new-activity references remain anywhere in the codebase.

All DASH-01 through DASH-06 requirements are fully satisfied. The nhap-hang page is fully implemented and wired. AdminSidebar correctly contains no new-activity link. The TypeScript module-not-found blocker is closed.

---

_Verified: 2026-03-19T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
