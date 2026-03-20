---
phase: 05-check-users-page-check-clinics-page
verified: 2026-03-20T15:30:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 9/13
  gaps_closed:
    - "GET /api/admin/check-users returns map_pins, paginated users, and monthly pivot (CHKU-01)"
    - "GET /api/admin/users/[userId]/conversations returns conversation list (CHKU-02)"
    - "GET /api/admin/users/[userId]/conversations/[conversationId]/messages returns message array (CHKU-03)"
    - "/admin/check-users renders Leaflet map with user_type color-coded pins (CHKU-04)"
    - "/admin/check-users renders paginated DataTable with 11 columns including all 5 exports and Xem lich su action (CHKU-05, CHKU-06)"
    - "/admin/check-users renders monthly pivot table (CHKU-07)"
    - "GET /api/admin/check-clinics returns paginated clinics list with monthly_data (CHKC-01)"
    - "GET /api/admin/check-clinics/[facilityCode]/detail returns staff day-by-day breakdown (CHKC-02)"
    - "/admin/check-clinics renders ColorPivotTable with Mien/Vung/Tinh/Ma/Ten columns and filter bar (CHKC-03)"
    - "Clicking clinic row opens dark Dialog with staff x day breakdown (CHKC-04)"
    - "PDF export button in ColorPivotTable produces a PDF file"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /admin/check-users and verify map renders with user pins"
    expected: "Leaflet map loads with color-coded pins (blue=nhan_vien, green=quan_ly, red=bac_si, orange=duoc_si); popup shows full_name + clinic_type"
    why_human: "Leaflet map rendering requires browser"
  - test: "Click Xem lich su on a user row in /admin/check-users"
    expected: "Sheet drawer opens from right; conversation list appears; clicking a conversation loads chat-style message thread with back arrow"
    why_human: "Sheet open behavior and conversation drill-down require browser interaction"
  - test: "Verify all 5 export buttons on the check-users DataTable work"
    expected: "Copy, Excel, CSV, PDF, Print all function; PDF downloads a file"
    why_human: "Export triggers (file downloads, print dialog) require browser"
  - test: "Navigate to /admin/check-clinics and verify filter bar + pivot table"
    expected: "Year/Metric/Clinic type/Province dropdowns present; ColorPivotTable shows Mien/Vung/Tinh/Ma/Ten sticky columns plus Thang 1-12; Column Visibility toggle works"
    why_human: "Visual rendering and filter interaction require browser"
  - test: "Click a clinic row in /admin/check-clinics"
    expected: "Dark Dialog opens (bg-gray-900) with Chi tiet theo nguoi dung header; staff rows visible with day columns showing stacked query_count + color-coded session count"
    why_human: "Modal open behavior and daily grid rendering require browser"
  - test: "Click the PDF button in the check-clinics ColorPivotTable"
    expected: "A PDF file named export.pdf downloads containing the table data in landscape A4 format"
    why_human: "jsPDF dynamic import and file download require browser"
  - test: "Verify check-users and check-clinics pages are navigable from the admin sidebar"
    expected: "AdminSidebar CHECKED section should contain links to both pages; currently only check-customers and check-distributor are listed"
    why_human: "Visual sidebar rendering requires browser; also potential gap — sidebar was NOT updated to include check-users/check-clinics links"
---

# Phase 5: Check Users + Check Clinics Page — Re-Verification Report

**Phase Goal:** Build Check Users and Check Clinics admin pages — the original chatbot analytics pages. Check Users shows user profiles, chatbot conversation history, geographic distribution, and monthly usage. Check Clinics shows clinic facility data with monthly query pivot table and daily staff breakdown.
**Verified:** 2026-03-20
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plans 05-04 and 05-05)

---

## Re-Verification Context

Previous verification (status: gaps_found, score 9/13) found that the phase had implemented check-customers and check-distributor (correct deliverables for those plans) but left CHKU-01 through CHKU-07 and CHKC-01 through CHKC-04 unaddressed because check-users and check-clinics pages were stubs. Gap closure Plans 05-04 and 05-05 were created and executed. This re-verification confirms all 11 CHKU/CHKC requirements are now closed.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/admin/check-users returns map_pins, paginated users, and monthly pivot (CHKU-01) | VERIFIED | `app/api/admin/check-users/route.ts` calls `getCheckUsersData`. Service returns all 3 shapes. map_pins filtered from profiles where lat/lng not null. monthly_pivot from `mv_monthly_queries`. |
| 2 | GET /api/admin/users/[userId]/conversations returns conversation list using service role client (CHKU-02) | VERIFIED | `app/api/admin/users/[userId]/conversations/route.ts` uses `createServiceClient()`, queries `conversations` by user_id, returns id/title/created_at/message_count. |
| 3 | GET /api/admin/users/[userId]/conversations/[conversationId]/messages returns message array using service role client (CHKU-03) | VERIFIED | `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts` uses `createServiceClient()`, queries `messages` by conversation_id, returns id/role/content/created_at. |
| 4 | /admin/check-users renders Leaflet map with user_type color-coded pins (CHKU-04) | VERIFIED | `CheckUsersClient.tsx` maps `data.map_pins` with `USER_TYPE_COLORS[p.user_type]` color, passes to `<MapView>`. Popup: `${full_name} (${clinic_type})`. |
| 5 | /admin/check-users renders paginated DataTable with 11 data columns + Xem lich su + all 5 exports (CHKU-05, CHKU-06) | VERIFIED | `userColumns` has 11 data columns (user_code through is_geo_located) + view_history action column. `exportConfig: { copy:true, excel:true, csv:true, pdf:true, print:true }`. `handleViewHistory` fetches conversations and opens `<UserHistoryDrawer>`. |
| 6 | Clicking Xem lich su opens Sheet drawer listing conversations; selecting one loads messages in read-only chat view (CHKU-06) | VERIFIED | `UserHistoryDrawer.tsx` fully implemented: single-panel switching between conversation list (with message_count badge) and message thread (chat-style bubbles, back arrow). `handleSelectConversation` fetches messages from messages route. |
| 7 | /admin/check-users renders monthly pivot table (user x month, query_count values) (CHKU-07) | VERIFIED | `<ColorPivotTable>` receives `pivotRows` (user_id, full_name, months map) with dynamic `allMonths` columns derived from `data.monthly_pivot`. exportConfig excel+copy. |
| 8 | GET /api/admin/check-clinics returns paginated clinics list with facility_code, region, zone, province, clinic_name, monthly_data (CHKC-01) | VERIFIED | `app/api/admin/check-clinics/route.ts` calls `getCheckClinicsData`. Service aggregates mv_monthly_queries by clinic via profiles.clinic_id, derives region/zone from province, returns paginated result. |
| 9 | GET /api/admin/check-clinics/[facilityCode]/detail returns staff users with day-by-day query + session counts (CHKC-02) | VERIFIED | `app/api/admin/check-clinics/[facilityCode]/detail/route.ts` calls `getClinicDetail`. Service queries mv_daily_queries filtered by year/month/staffIds, builds daily_data arrays per staff user. |
| 10 | /admin/check-clinics renders ColorPivotTable with Mien/Vung/Tinh/Ma/Ten columns + Thang 1-12 + filter bar (CHKC-03) | VERIFIED | `CheckClinicsClient.tsx`: `DIM_COLUMN_LABELS` has 5 entries (region/zone/province/facility_code/clinic_name), `MONTH_COLUMNS = ['1'..'12']`, `columnHeaderPrefix="Thang "`. Filter bar has year/metric/clinic_type/province/search controls. |
| 11 | Clicking clinic row opens dark Dialog with staff x day grid (query_count + session_count per cell) (CHKC-04) | VERIFIED | `handleRowClick` fetches `/api/admin/check-clinics/${facilityCode}/detail`. `<ClinicDetailModal>` has `bg-gray-900`, "Chi tiet theo nguoi dung" title, staff rows x day columns with stacked color-coded query_count + "SS {session_count}" per cell. |

**Score: 11/11 truths verified**

---

## Required Artifacts

### Plan 05-04 Artifacts (Gap Closure — CHKU)

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `lib/admin/services/check-users.ts` | — | 190 lines | VERIFIED | Exports `getCheckUsersData`, `CheckUsersData`, `USER_TYPE_COLORS`. Queries profiles + clinics in JS join. mv_monthly_queries for pivot. |
| `app/api/admin/check-users/route.ts` | — | 24 lines | VERIFIED | `export async function GET`, `requireAdmin`, calls `getCheckUsersData`. |
| `app/api/admin/users/[userId]/conversations/route.ts` | — | 53 lines | VERIFIED | `export async function GET`, `createServiceClient`, queries conversations by user_id with message counts. |
| `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts` | — | 37 lines | VERIFIED | `export async function GET`, `createServiceClient`, queries messages by conversation_id. |
| `app/admin/check-users/CheckUsersClient.tsx` | 250 | 405 lines | VERIFIED | 'use client', MapView, DataTable (11 cols + action), ColorPivotTable (pivot), UserHistoryDrawer wired. |
| `components/admin/UserHistoryDrawer.tsx` | 80 | 157 lines | VERIFIED | Full implementation: conversation list view + message thread view with back navigation. No stub text. |

### Plan 05-05 Artifacts (Gap Closure — CHKC)

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `lib/admin/services/check-clinics.ts` | — | 292 lines | VERIFIED | Exports `getCheckClinicsData`, `getClinicDetail`, `CheckClinicsData`, `ClinicDetailData`. mv_monthly_queries + mv_daily_queries queries. |
| `app/api/admin/check-clinics/route.ts` | — | 26 lines | VERIFIED | `export async function GET`, `requireAdmin`, calls `getCheckClinicsData`. |
| `app/api/admin/check-clinics/[facilityCode]/detail/route.ts` | — | 25 lines | VERIFIED | `export async function GET`, `requireAdmin`, calls `getClinicDetail`. |
| `app/admin/check-clinics/CheckClinicsClient.tsx` | 150 | 269 lines | VERIFIED | 'use client', ColorPivotTable with 5 dimColumnLabels + Thang 1-12 columns, ClinicDetailModal wired via handleRowClick. |
| `components/admin/ClinicDetailModal.tsx` | 80 | 187 lines | VERIFIED | `bg-gray-900`, "Chi tiet theo nguoi dung" title, staff x day grid with color-coded query_count + session_count stacks. Loading spinner. |
| `components/admin/ColorPivotTable.tsx` (PDF fix) | — | line 190-228 | VERIFIED | `handlePdf` dynamically imports jspdf + jspdf-autotable, builds headers/body from current page rows, calls `doc.autoTable()`, `doc.save('export.pdf')`. No console.log stub. |

---

## Key Link Verification

### Plan 05-04 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `app/api/admin/check-users/route.ts` | `lib/admin/services/check-users.ts` | `import { getCheckUsersData } from '@/lib/admin/services/check-users'` | WIRED |
| `app/admin/check-users/CheckUsersClient.tsx` | `/api/admin/users/[userId]/conversations` | `fetch('/api/admin/users/${userId}/conversations')` in `handleViewHistory` | WIRED |
| `app/admin/check-users/CheckUsersClient.tsx` | `/api/admin/users/${selectedUserId}/conversations/${conv.id}/messages` | `fetch(...)` in `handleSelectConversation` | WIRED |
| `app/admin/check-users/CheckUsersClient.tsx` | `components/admin/UserHistoryDrawer.tsx` | `import { UserHistoryDrawer }` + `<UserHistoryDrawer>` rendered with all props | WIRED |
| `app/admin/check-users/page.tsx` | `lib/admin/services/check-users.ts` | SSR `import { getCheckUsersData }`, called directly in page function | WIRED |

### Plan 05-05 Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| `app/api/admin/check-clinics/route.ts` | `lib/admin/services/check-clinics.ts` | `import { getCheckClinicsData } from '@/lib/admin/services/check-clinics'` | WIRED |
| `app/api/admin/check-clinics/[facilityCode]/detail/route.ts` | `lib/admin/services/check-clinics.ts` | `import { getClinicDetail } from '@/lib/admin/services/check-clinics'` | WIRED |
| `app/admin/check-clinics/CheckClinicsClient.tsx` | `/api/admin/check-clinics/${facilityCode}/detail` | `fetch('/api/admin/check-clinics/${facilityCode}/detail?year=...&month=...')` in `handleRowClick` | WIRED |
| `app/admin/check-clinics/CheckClinicsClient.tsx` | `components/admin/ClinicDetailModal.tsx` | `import { ClinicDetailModal }` + `<ClinicDetailModal>` with `detailData.users` | WIRED |
| `app/admin/check-clinics/page.tsx` | `lib/admin/services/check-clinics.ts` | SSR `import { getCheckClinicsData }`, called in page function | WIRED |

---

## Requirements Coverage

| Requirement | REQUIREMENTS.md Description | Implementation Status | Evidence |
|-------------|-----------------------------|-----------------------|---------|
| CHKU-01 | GET /api/admin/check-users returns map_pins + paginated users + monthly pivot | SATISFIED | `app/api/admin/check-users/route.ts` + `lib/admin/services/check-users.ts`. REQUIREMENTS.md marked Complete. |
| CHKU-02 | GET /api/admin/users/[userId]/conversations | SATISFIED | Route exists, uses service role client, returns id/title/created_at/message_count. REQUIREMENTS.md marked Complete. |
| CHKU-03 | GET /api/admin/users/[userId]/conversations/[conversationId]/messages | SATISFIED | Route exists, uses service role client, queries messages by conversation_id. REQUIREMENTS.md marked Complete. |
| CHKU-04 | /admin/check-users map with user_type color-coded pins | SATISFIED | MapView with USER_TYPE_COLORS lookup, popup with clinic_type. REQUIREMENTS.md marked Complete. |
| CHKU-05 | /admin/check-users DataTable with 11 columns + 5 exports | SATISFIED | 11 data columns + view_history action, exportConfig all 5 formats. REQUIREMENTS.md marked Complete. |
| CHKU-06 | Xem lich su Sheet drawer for conversation history | SATISFIED | UserHistoryDrawer fully implemented: conversation list + message thread with back navigation. REQUIREMENTS.md marked Complete. |
| CHKU-07 | /admin/check-users monthly pivot table (user x month) | SATISFIED | ColorPivotTable with monthly_pivot data from mv_monthly_queries. REQUIREMENTS.md marked Complete. |
| CHKC-01 | GET /api/admin/check-clinics returns paginated clinics with monthly_data | SATISFIED | Route + service aggregate clinic queries from mv_monthly_queries via profiles.clinic_id. REQUIREMENTS.md marked Complete. |
| CHKC-02 | GET /api/admin/check-clinics/[facilityCode]/detail returns daily staff breakdown | SATISFIED | Route + service query mv_daily_queries, return staff with daily_data per day. REQUIREMENTS.md marked Complete. |
| CHKC-03 | /admin/check-clinics ColorPivotTable with filter bar | SATISFIED | CheckClinicsClient with 5 DIM_COLUMN_LABELS, MONTH_COLUMNS, filter bar, Column Visibility. REQUIREMENTS.md marked Complete. |
| CHKC-04 | Clinic row click opens dark Dialog with staff x day breakdown | SATISFIED | ClinicDetailModal with bg-gray-900, color-coded query_count + session_count cells. REQUIREMENTS.md marked Complete. |

**Requirements satisfied: 11/11**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/admin/AdminSidebar.tsx` | 23-24 | CHECKED section only lists check-customers and check-distributor; check-users and check-clinics are not linked | Warning | /admin/check-users and /admin/check-clinics are functional but not reachable via sidebar navigation — admin users cannot discover them without knowing the direct URLs |

---

## Human Verification Required

### 1. Check Users — Map Rendering and Color-Coded Pins

**Test:** Navigate to `/admin/check-users`. Verify the map section renders with user pins.
**Expected:** Leaflet map loads showing pins colored by user_type: blue (nhan_vien), green (quan_ly), red (bac_si), orange (duoc_si). Clicking a pin shows popup with full_name + clinic_type.
**Why human:** Leaflet SSR-disabled dynamic import, map tile loading, and pin color rendering require browser.

### 2. Check Users — Conversation History Drawer

**Test:** Click "Xem lich su" on any user row.
**Expected:** Sheet drawer opens from the right. Left panel shows conversation list with title, date, and message count badge. Clicking a conversation navigates to message thread view with chat bubbles (user messages right/teal, assistant messages left/gray) and a back arrow to return to list.
**Why human:** Sheet open behavior, conversation list rendering, and chat bubble layout require browser interaction.

### 3. Check Users — All 5 Export Formats

**Test:** In the "Danh sach nguoi dung" DataTable, click each of Copy, Excel, CSV, PDF, Print.
**Expected:** Each button triggers its export. Copy copies to clipboard, Excel downloads .xlsx, CSV downloads .csv, PDF downloads a PDF, Print opens print dialog.
**Why human:** Export triggers and file download behavior require browser.

### 4. Check Clinics — Pivot Table with Dim Columns and Filter

**Test:** Navigate to `/admin/check-clinics`. Verify all UI elements render.
**Expected:** Filter bar shows Year/Metric/Clinic type/Province dropdowns and search input. ColorPivotTable displays sticky Mien/Vung/Tinh/Ma/Ten columns followed by Thang 1 through Thang 12. Column Visibility toggle button is present and hides/shows month columns when used.
**Why human:** Filter state interaction and conditional column rendering require browser.

### 5. Check Clinics — Clinic Detail Modal

**Test:** Click any row in the clinic pivot table.
**Expected:** Dark modal opens (`bg-gray-900`) with "Chi tiet theo nguoi dung" header and subtitle showing clinic name, facility code, month, and year. Table shows staff rows (Ma NV / Ten NV sticky columns) with day columns (Ngay 1–Ngay 31). Each cell shows stacked: query count (color-coded by threshold) above "SS N" session count. Empty state text shows if no staff.
**Why human:** Modal open behavior, data fetching, and color-coded grid rendering require browser.

### 6. Check Clinics — PDF Export

**Test:** Click the PDF button on the check-clinics ColorPivotTable.
**Expected:** A file named `export.pdf` downloads. Opening it shows the clinic data in landscape A4 format with the same columns visible in the table.
**Why human:** Dynamic jsPDF import and file download require browser execution.

### 7. Sidebar Navigation for Check Users and Check Clinics

**Test:** Open the admin sidebar and look at the CHECKED section.
**Expected:** Ideally the sidebar should include links to both `/admin/check-users` and `/admin/check-clinics` so admins can navigate to them. Currently the sidebar only shows Check Khach hang (`/admin/check-customers`) and Check NPP (`/admin/check-distributor`).
**Why human:** This is also a potential actionable gap — the sidebar may need two more entries added to expose the check-users and check-clinics pages.

---

## Gaps Summary

All 11 previously-identified gaps (CHKU-01 through CHKU-07 and CHKC-01 through CHKC-04) have been closed by Plans 05-04 and 05-05. The PDF export stub in ColorPivotTable has also been replaced with a real jsPDF + autoTable implementation. REQUIREMENTS.md has been updated to mark all 11 requirements as Complete.

**One warning-level concern remains:** The AdminSidebar does not include navigation links to `/admin/check-users` or `/admin/check-clinics`. Both pages are fully functional but can only be reached by typing the URL directly. Whether this warrants a fix or a new sidebar plan depends on whether these pages are intended to be visible in the navigation.

**All automated checks pass.** Human verification is required for visual rendering, interaction behaviors, export functionality, and PDF generation.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
_Re-verification after Plans 05-04 (check-users) and 05-05 (check-clinics) gap closure_
