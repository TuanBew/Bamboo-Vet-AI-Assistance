---
phase: 05-check-users-page-check-clinics-page
verified: 2026-03-20T00:00:00Z
status: gaps_found
score: 9/13 must-haves verified
re_verification: false
gaps:
  - truth: "GET /api/admin/check-users returns map_pins, paginated users, and monthly pivot (CHKU-01)"
    status: failed
    reason: "No /api/admin/check-users route exists. Phase built check-customers instead. REQUIREMENTS.md CHKU-01 (chatbot user analytics) is unaddressed."
    artifacts:
      - path: "app/api/admin/check-users/route.ts"
        issue: "File does not exist"
      - path: "app/admin/check-users/page.tsx"
        issue: "Stub — renders 'Coming soon' placeholder only"
    missing:
      - "API route for check-users (map_pins + paginated users + monthly pivot)"
      - "Full /admin/check-users page implementation"

  - truth: "GET /api/admin/users/[userId]/conversations returns conversation list (CHKU-02)"
    status: failed
    reason: "No /api/admin/users/[userId]/conversations route exists."
    artifacts:
      - path: "app/api/admin/users/[userId]/conversations/route.ts"
        issue: "File does not exist"
    missing:
      - "Conversations API route using service role client"

  - truth: "GET /api/admin/users/[userId]/conversations/[conversationId]/messages returns message array (CHKU-03)"
    status: failed
    reason: "No messages route exists."
    artifacts:
      - path: "app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts"
        issue: "File does not exist"
    missing:
      - "Messages API route using service role client"

  - truth: "/admin/check-users renders Leaflet map with clinic_type color-coded pins (CHKU-04)"
    status: failed
    reason: "check-users page is a placeholder stub ('Coming soon')."
    artifacts:
      - path: "app/admin/check-users/page.tsx"
        issue: "Stub — 8 lines, no map, no data"
    missing:
      - "Full check-users client component with Leaflet map"

  - truth: "/admin/check-users renders paginated DataTable with 11 columns including all 5 exports and Xem lich su action (CHKU-05, CHKU-06)"
    status: failed
    reason: "check-users page is a stub; no DataTable, no UserHistoryDrawer wiring to conversations API."
    artifacts:
      - path: "app/admin/check-users/page.tsx"
        issue: "Stub only"
    missing:
      - "User DataTable with all 5 export formats"
      - "Xem lich su action wired to conversations API"
      - "Sheet drawer rendering messages in read-only chat view"

  - truth: "/admin/check-users renders monthly pivot table (CHKU-07)"
    status: failed
    reason: "check-users page is a stub."
    artifacts:
      - path: "app/admin/check-users/page.tsx"
        issue: "Stub only"
    missing:
      - "Monthly pivot table (user x month, query_count values)"

  - truth: "GET /api/admin/check-clinics returns paginated clinics list with monthly_data (CHKC-01)"
    status: failed
    reason: "No /api/admin/check-clinics route exists. Phase built check-distributor instead. REQUIREMENTS.md CHKC-01 is unaddressed."
    artifacts:
      - path: "app/api/admin/check-clinics/route.ts"
        issue: "File does not exist"
    missing:
      - "check-clinics API route returning facility_code, region, zone, province, clinic_name, monthly_data"

  - truth: "GET /api/admin/check-clinics/[facilityCode]/detail returns staff day-by-day breakdown (CHKC-02)"
    status: failed
    reason: "No /api/admin/check-clinics/[facilityCode]/detail route exists."
    artifacts:
      - path: "app/api/admin/check-clinics/[facilityCode]/detail/route.ts"
        issue: "File does not exist"
    missing:
      - "Clinic detail API route with daily query+session counts per staff"

  - truth: "/admin/check-clinics renders ColorPivotTable with Mien/Vung/Tinh/Ma/Ten columns and filter bar (CHKC-03)"
    status: failed
    reason: "check-clinics page is a stub. REQUIREMENTS.md marks this as Pending."
    artifacts:
      - path: "app/admin/check-clinics/page.tsx"
        issue: "Stub only ('Coming soon')"
    missing:
      - "Full check-clinics page with ColorPivotTable and filter bar"

  - truth: "Clicking clinic row opens dark Dialog with staff x day breakdown (CHKC-04)"
    status: failed
    reason: "check-clinics page is a stub. REQUIREMENTS.md marks this as Pending."
    artifacts:
      - path: "app/admin/check-clinics/page.tsx"
        issue: "Stub only"
    missing:
      - "Clinic detail Dialog component wired to detail API"

  - truth: "PDF export button in ColorPivotTable produces a PDF file"
    status: failed
    reason: "handlePdf in ColorPivotTable.tsx is a stub (console.log only, no jsPDF implementation)."
    artifacts:
      - path: "components/admin/ColorPivotTable.tsx"
        issue: "Line 191: handlePdf = () => console.log('PDF export placeholder') — no actual PDF generation"
    missing:
      - "jsPDF implementation for ColorPivotTable PDF export"

human_verification:
  - test: "Navigate to /admin/check-customers and verify all 4 sections render"
    expected: "Map shows customer pins, DataTable shows 11+1 columns with all 5 export buttons, revenue pivot shows brand x month data, display programs section renders"
    why_human: "Visual layout, map rendering with Leaflet, and dynamic data require browser"
  - test: "Click Check Location button in customer DataTable"
    expected: "Leaflet map pans/zooms to the selected customer's coordinates"
    why_human: "Real-time map flyTo behavior requires browser interaction"
  - test: "Navigate to /admin/check-distributor and verify color-coded pivot table"
    expected: "Cells colored green (>=100M), yellow (10M-99M), red (1-9.9M), grey (0); Column Visibility toggle works; Truoc/Tiep theo pagination buttons visible"
    why_human: "Color-coding and interactive Column Visibility require browser"
  - test: "Click a distributor row in the pivot table"
    expected: "Dark modal opens showing staff rows x day columns with stacked revenue + KH count per cell"
    why_human: "Modal open behavior and daily data rendering require browser interaction"
  - test: "Verify AdminSidebar shows Check Khach hang and Check NPP nav links"
    expected: "CHECKED section has two links: Check Khach hang -> /admin/check-customers, Check NPP -> /admin/check-distributor"
    why_human: "Visual sidebar rendering requires browser"
---

# Phase 5: Check Users + Check Clinics Page — Verification Report

**Phase Goal:** Build the Check Customers and Check Distributor admin pages with interactive data exploration, maps, pivot tables, and modals.
**Verified:** 2026-03-20
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Critical Scope Finding

The phase directory is named `05-check-users-page-check-clinics-page` and REQUIREMENTS.md assigns requirement IDs **CHKU-01 through CHKU-07** (check-users/chatbot analytics) and **CHKC-01 through CHKC-04** (check-clinics/facility analytics) to Phase 5. However, the actual implementation builds **check-customers** (business store explorer) and **check-distributor** (NPP sales) — a fully different scope documented explicitly in 05-CONTEXT.md as a "scope correction."

The result is a **requirements mismatch**: REQUIREMENTS.md still tracks CHKU and CHKC requirement IDs as Phase 5 deliverables, but Phase 5 delivered entirely different features. CHKU-01 through CHKU-07 and CHKC-01 through CHKC-04 are all unaddressed by the actual implementation.

---

## Observable Truths — Plan 05-01 (Data Layer)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/admin/check-customers returns map_pins, paginated customers, revenue_pivot, display_programs | VERIFIED | `app/api/admin/check-customers/route.ts` calls `getCheckCustomersData` which returns all 4 arrays. All fields present in service types. |
| 2 | GET /api/admin/check-distributor returns paginated distributors with monthly_data and filter_options | VERIFIED | `app/api/admin/check-distributor/route.ts` calls `getCheckDistributorData` which builds monthly_data for months 1-12 per supplier. |
| 3 | GET /api/admin/check-distributor/[id]/detail returns staff daily breakdown | VERIFIED | `app/api/admin/check-distributor/[id]/detail/route.ts` calls `getDistributorDetail` which returns staff with daily_data (deterministic hash-based). |

**Score (Plan 01):** 3/3 truths verified

---

## Observable Truths — Plan 05-02 (Check Customers Page)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | Admin can see customer pins on Leaflet map with popups | VERIFIED | `CheckCustomersClient.tsx` maps `data.map_pins` to `MapPin[]` with color '#06b6d4', passes to `<MapView>` with `onMapReady` callback. `LeafletMapInner.tsx` renders `Marker` + `Popup` for each pin. |
| 5 | Admin can browse paginated customer table with 11 data columns + Check Location | VERIFIED | `customerColumns` array has 11 data columns (customer_code through is_geo_located) + `check_location` action column with flyTo on click. |
| 6 | Clicking Check Location pans the map | VERIFIED | `check_location` column button calls `mapHandleRef.current?.flyTo(row.latitude!, row.longitude!)`. `FlyToController` in `LeafletMapInner.tsx` exposes `map.flyTo` via `onMapReady` callback. |
| 7 | Admin can see brand x month revenue pivot table with all 5 exports | VERIFIED | Pivot section uses `<DataTable>` with `exportConfig: { copy:true, excel:true, csv:true, pdf:true, print:true }`. Revenue pivot built from `customer_purchases` + `products` with brand-month grouping. |
| 8 | Admin can see display programs section with 5 columns | VERIFIED | "Tinh hinh trung bay" `SectionHeader` with `DataTable` showing 5 columns (program_name, staff_name, time_period, registration_image_url, execution_image_url). |
| 9 | All 5 export buttons on customer DataTable | VERIFIED | `CheckCustomersClient.tsx` line 389-395: `exportConfig: { copy:true, excel:true, csv:true, pdf:true, print:true }`. |
| 10 | Sidebar shows Check Customers and Check NPP nav links | VERIFIED | `AdminSidebar.tsx` lines 23-24: `href: '/admin/check-customers', label: 'Check Khach hang'` and `href: '/admin/check-distributor', label: 'Check NPP'`. |

**Score (Plan 02):** 7/7 truths verified

---

## Observable Truths — Plan 05-03 (Check Distributor Page)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | Color-coded distributor monthly pivot table with all 12 month columns | VERIFIED | `CheckDistributorClient.tsx` passes `monthColumns = ['1'..'12']` to `<ColorPivotTable>`. `getColorClass()` in `ColorPivotTable.tsx` applies green/yellow/red/grey CSS. |
| 12 | Cells colored by VND thresholds (green>=100M, yellow 10M-99M, red 1-9.9M, grey 0) | VERIFIED | `COLOR_THRESHOLDS = { green: 100_000_000, yellow: 10_000_000, red: 1, grey: 0 }`. `getColorClass` returns `bg-green-500`, `bg-yellow-400`, `bg-red-500`, `text-gray-500`. |
| 13 | Admin can filter by year, metric, and search | VERIFIED | 6 `<select>` elements in `CheckDistributorClient` + Search button calling `handleSearch` which fetches `/api/admin/check-distributor?year=...`. |
| 14 | Clicking distributor row opens dark daily detail modal | VERIFIED | `onRowClick={handleRowClick}` fetches `/api/admin/check-distributor/${rowId}/detail`. `<DistributorDetailModal>` with `bg-gray-900`, `isOpen={selectedDistributor !== null}`. |
| 15 | Detail modal shows staff rows x day columns with stacked revenue + KH count | VERIFIED | `DistributorDetailModal.tsx`: iterates `dayColumns` (1..daysInMonth), renders `<div class="flex flex-col">` with revenue span + "KH {customerCount}" span per cell. |
| 16 | Column Visibility toggle shows/hides month columns | VERIFIED | `showColumnVisibility={true}` in `CheckDistributorClient`. `ColorPivotTable` has `colVisOpen` state + checkbox per column that updates `visibleColumns` Set. |
| 17 | Pagination with Truoc/Tiep theo buttons | VERIFIED | `ColorPivotTable.tsx` lines 422-452: "Truoc" and "Tiep theo" buttons with page number buttons between them. |

**Score (Plan 03):** 7/7 truths verified (for the features actually built)

---

## Required Artifacts

### Plan 05-01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/20260320_009_add_check_customers_distributor_tables.sql` | VERIFIED | Contains all 4 DDL changes: ALTER customers (address/street/ward/image_url), ALTER suppliers (region/zone), CREATE display_programs, CREATE distributor_staff. IF NOT EXISTS guards present. |
| `lib/admin/services/check-customers.ts` | VERIFIED | Exports `getCheckCustomersData`, `CheckCustomersData`, `CheckCustomersFilters`. 183 lines — substantive. |
| `lib/admin/services/check-distributor.ts` | VERIFIED | Exports `getCheckDistributorData`, `getDistributorDetail`, `CheckDistributorData`, `DistributorDetailData`. 236 lines — substantive. |
| `app/api/admin/check-customers/route.ts` | VERIFIED | `export async function GET`, uses `requireAdmin()`, calls `getCheckCustomersData`. |
| `app/api/admin/check-distributor/route.ts` | VERIFIED | `export async function GET`, uses `requireAdmin()`, calls `getCheckDistributorData`. |
| `app/api/admin/check-distributor/[id]/detail/route.ts` | VERIFIED | `export async function GET`, uses `requireAdmin()`, calls `getDistributorDetail`. |
| `data/seeds/display-programs.ts` | VERIFIED | Exports `DISPLAY_PROGRAMS` with 5 rows. |
| `data/seeds/distributor-staff.ts` | VERIFIED | Exports `DISTRIBUTOR_STAFF` array. |
| `scripts/seed.ts` | VERIFIED | Contains `seedDisplayPrograms`, `seedDistributorStaff`, `updateSuppliersRegionZone`, `updateCustomersAddressFields` — all called in main seed function. |

### Plan 05-02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `app/admin/check-customers/page.tsx` | VERIFIED | Imports `getCheckCustomersData`, renders `<CheckCustomersClient>` in Suspense. |
| `app/admin/check-customers/CheckCustomersClient.tsx` | VERIFIED | 455 lines, 'use client', renders 4 SectionHeader sections, DataTable, MapView, flyTo wiring. |
| `components/admin/LeafletMapInner.tsx` | VERIFIED | Contains `MapHandle` type, `FlyToController` component using `useMap()`, `onMapReady` callback pattern for flyTo. |
| `components/admin/MapView.tsx` | VERIFIED | Re-exports `MapHandle`, `MapViewProps` includes `onMapReady` prop, dynamic import with ssr: false. |

### Plan 05-03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `app/admin/check-distributor/page.tsx` | VERIFIED | Imports `getCheckDistributorData`, renders `<CheckDistributorClient>` in Suspense. |
| `app/admin/check-distributor/CheckDistributorClient.tsx` | VERIFIED | 275 lines, 'use client', 6 select dropdowns, ColorPivotTable, DistributorDetailModal, handleRowClick fetches detail API. |
| `components/admin/DistributorDetailModal.tsx` | VERIFIED | `bg-gray-900`, "Chi tiet theo nhan vien" title, staff x day grid with stacked revenue + "KH {count}" cells. 199 lines — substantive. |
| `components/admin/ColorPivotTable.tsx` | PARTIAL | Fully implemented (457 lines) with VND thresholds, Column Visibility, Truoc/Tiep theo pagination, search. HOWEVER: `handlePdf` is a stub (line 191: `console.log('PDF export placeholder')`). |

---

## Key Links Verification

### Plan 05-01 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `app/api/admin/check-customers/route.ts` | `lib/admin/services/check-customers.ts` | `import { getCheckCustomersData }` | WIRED |
| `app/api/admin/check-distributor/route.ts` | `lib/admin/services/check-distributor.ts` | `import { getCheckDistributorData }` | WIRED |

### Plan 05-02 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `app/admin/check-customers/page.tsx` | `lib/admin/services/check-customers.ts` | SSR import of `getCheckCustomersData` | WIRED |
| `app/admin/check-customers/CheckCustomersClient.tsx` | `components/admin/MapView.tsx` | `import { MapView }` + `onMapReady` callback | WIRED |
| `app/admin/check-customers/CheckCustomersClient.tsx` | `components/admin/DataTable.tsx` | `import { DataTable }` | WIRED |

### Plan 05-03 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `app/admin/check-distributor/page.tsx` | `lib/admin/services/check-distributor.ts` | SSR import of `getCheckDistributorData` | WIRED |
| `app/admin/check-distributor/CheckDistributorClient.tsx` | `components/admin/DistributorDetailModal.tsx` | `import { DistributorDetailModal }` rendered on row click | WIRED |
| `app/admin/check-distributor/CheckDistributorClient.tsx` | `/api/admin/check-distributor/[id]/detail` | `fetch('/api/admin/check-distributor/${rowId}/detail?month=...')` in `handleRowClick` | WIRED |

---

## Requirements Coverage

The plan frontmatter declares requirements: CHKU-01, CHKC-01, CHKC-02 (Plan 01); CHKU-02 through CHKU-07 (Plan 02); CHKC-01 through CHKC-04 (Plan 03).

These requirement IDs map to "check-users" (chatbot analytics) and "check-clinics" (facility analytics) in REQUIREMENTS.md. The actual implementation built "check-customers" and "check-distributor" — a confirmed scope change documented in 05-CONTEXT.md.

| Requirement ID | REQUIREMENTS.md Description | Implementation Status | Evidence |
|---------------|----------------------------|----------------------|---------|
| CHKU-01 | GET /api/admin/check-users returns map_pins + paginated users + monthly pivot (chatbot user analytics) | NOT SATISFIED | No /api/admin/check-users route. /admin/check-users is a stub ("Coming soon"). |
| CHKU-02 | GET /api/admin/users/[userId]/conversations | NOT SATISFIED | Route does not exist. |
| CHKU-03 | GET /api/admin/users/[userId]/conversations/[conversationId]/messages | NOT SATISFIED | Route does not exist. |
| CHKU-04 | /admin/check-users map with clinic_type color-coded pins | NOT SATISFIED | Page is "Coming soon" stub. |
| CHKU-05 | /admin/check-users DataTable with 11 columns + 5 exports | NOT SATISFIED | Page is "Coming soon" stub. |
| CHKU-06 | "Xem lich su" Sheet drawer for conversation history | NOT SATISFIED | Page is stub; UserHistoryDrawer.tsx exists but is not wired to any implemented page. |
| CHKU-07 | /admin/check-users monthly pivot table (user x month) | NOT SATISFIED | Page is "Coming soon" stub. |
| CHKC-01 | GET /api/admin/check-clinics returns paginated clinics with monthly_data | NOT SATISFIED | No route exists. |
| CHKC-02 | GET /api/admin/check-clinics/[facilityCode]/detail returns daily staff breakdown | NOT SATISFIED | No route exists. |
| CHKC-03 | /admin/check-clinics ColorPivotTable with filter bar | NOT SATISFIED | Page is "Coming soon" stub. REQUIREMENTS.md itself marks this Pending. |
| CHKC-04 | Clinic row click opens dark Dialog with staff x day breakdown | NOT SATISFIED | Page is stub. REQUIREMENTS.md itself marks this Pending. |

**Requirements satisfied: 0/11 (as tracked in REQUIREMENTS.md)**

**Note on actual deliverables:** Phase 05 successfully built check-customers and check-distributor pages with the full feature set described in the plans. If REQUIREMENTS.md were updated to reflect the scope correction (replacing CHKU/CHKC with new IDs for check-customers/check-distributor), all check-customers and check-distributor must-haves would be SATISFIED.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/admin/ColorPivotTable.tsx` | 191 | `handlePdf = () => console.log('PDF export placeholder')` | Warning — PDF button visible to users but non-functional | Clicking PDF in ColorPivotTable (used on check-distributor) does nothing |
| `app/admin/check-users/page.tsx` | 4-5 | "Coming soon" stub | Blocker | CHKU-04 through CHKU-07 undeliverable |
| `app/admin/check-clinics/page.tsx` | 4-5 | "Coming soon" stub | Blocker | CHKC-03, CHKC-04 undeliverable |

---

## Human Verification Required

### 1. Check Customers Map + flyTo

**Test:** Navigate to `/admin/check-customers`. Verify map section renders with customer pins. Click "Da dinh vi" button in the Check Location column for a customer that has coordinates.
**Expected:** Leaflet map smoothly pans and zooms to the selected customer's location.
**Why human:** Leaflet rendering, map tile loading, and `map.flyTo()` animation cannot be verified programmatically.

### 2. Check Customers — All 5 Export Buttons on DataTable

**Test:** Open `/admin/check-customers`, scroll to "Danh sach khach hang" section. Click each of Copy, Excel, CSV, PDF, Print.
**Expected:** Each button performs its export. PDF and Print should produce output (DataTable PDF uses jsPDF via DataTable component).
**Why human:** Export behavior (file download triggers, print dialog) requires browser execution.

### 3. Check Distributor — Color Coding Accuracy

**Test:** Navigate to `/admin/check-distributor`. Observe the monthly pivot table cells.
**Expected:** Cells with value >= 100M VND appear green, 10M-99M appear yellow, 1-9.9M appear red, 0 appears unstyled grey. Values are formatted with Vietnamese comma separators.
**Why human:** Color rendering and visual formatting require browser.

### 4. Check Distributor — Row Click Opens Modal

**Test:** Click any row in the distributor pivot table. Verify modal opens.
**Expected:** Dark modal (`bg-gray-900`) opens showing "Chi tiet theo nhan vien" header, staff rows, and day columns 1-31 with stacked revenue + KH count in each cell.
**Why human:** Modal interaction and rendering require browser.

### 5. Column Visibility Toggle

**Test:** In the distributor pivot table, click "Column Visibility" button.
**Expected:** Dropdown opens with checkboxes for Thang 1 through Thang 12. Unchecking a month hides that column from the table.
**Why human:** Dropdown state and conditional column rendering require browser.

---

## Gaps Summary

Phase 05 has a fundamental **scope drift** between what REQUIREMENTS.md specifies and what was implemented. The REQUIREMENTS.md still assigns CHKU-01 through CHKU-07 and CHKC-01 through CHKC-04 to Phase 5 — these describe chatbot user analytics and clinic analytics respectively. Phase 05 instead built business customer and distributor sales pages (check-customers, check-distributor), which was an explicit scope decision documented in 05-CONTEXT.md.

**Two resolution paths exist:**

1. **Update REQUIREMENTS.md** to replace CHKU/CHKC requirement IDs with new IDs covering check-customers and check-distributor (marking them as satisfied), and move or defer the original chatbot analytics requirements to a later phase.

2. **Implement the original CHKU/CHKC requirements** in addition to the check-customers/check-distributor work already done — effectively treating Phase 05 as still open.

**Within the delivered scope (check-customers and check-distributor), one blocker remains:**

- **ColorPivotTable PDF export** is a stub (`console.log` only). The PDF button is visible and clickable but does nothing. This affects the check-distributor pivot table. All other exports (Copy, Excel, CSV, Print) are implemented.

**check-users and check-clinics pages** remain "Coming soon" stubs from earlier phases and are not navigable from the updated AdminSidebar (sidebar now points to /admin/check-customers and /admin/check-distributor).

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
