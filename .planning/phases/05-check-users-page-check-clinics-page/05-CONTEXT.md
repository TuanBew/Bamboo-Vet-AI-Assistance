# Phase 5: Check Users page + Check Clinics page - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Two data-explorer pages become fully operational:

- `/admin/check-users` — Full-width Leaflet map (pins color-coded by `clinic_type`) + paginated user DataTable (all five export formats) + monthly query pivot table (rows = users, columns = 2024-01 → 2026-03) + conversation history drawer ("Xem lịch sử")
- `/admin/check-clinics` — Color-coded monthly clinic pivot table (rows = clinics by facility_code, columns = Tháng 1–12) with multi-filter bar + clinic detail modal (daily breakdown grid for a selected clinic)

Three component stubs from earlier phases (`UserHistoryDrawer`, `ClinicDetailModal`, `ColorPivotTable`) are completed here. Two service files and two API routes are created new.

</domain>

<decisions>
## Implementation Decisions

### Check Users — Page Layout

Page sections in order (top to bottom):
1. **Filter bar** — Province | District | Clinic type | Search (above the map)
2. **Map section** — Inside a collapsible `SectionHeader` with title "Vị trí khách hàng tháng". ~350px fixed height. Uses existing `MapView` component.
3. **User DataTable section** — SectionHeader "Danh sách khách hàng". All five export buttons (Copy + Excel + CSV + PDF + Print) per spec. 10 rows default, paginated.
4. **Monthly pivot section** — SectionHeader "Doanh số theo tháng" (or similar). Non-paginated, vertically scrollable.

### Check Users — Conversation History Drawer

- **Drawer width:** 600px (`sm:max-w-[600px]`)
- **Layout:** Persistent split — conversation list always visible as left panel (~200px), messages panel on the right (~380px). Messages load lazily when a conversation is selected; right panel shows empty state ("Chọn cuộc trò chuyện") until selection.
- **Conversation list entry:** Title + date + message count. Example: `"Cuộc trò chuyện #A3F7" | "2025-03-15" | "8 tin nhắn"`
- **Message rendering:** Chat bubble style — user messages right-aligned with colored background, assistant messages left-aligned with grey/dark background. Read-only (no input field).
- **Two API calls:** `GET /api/admin/users/[userId]/conversations` on drawer open; `GET /api/admin/users/[userId]/conversations/[conversationId]/messages` on conversation select.

### Check Users — Monthly Pivot Table

- **All 80 rows shown at once**, no pagination. Vertically scrollable within the section.
- **All 27 month columns visible** (Jan 2024 → Mar 2026), horizontal scroll within the table. Column headers sticky.
- **Search bar** filters rows by user name in real-time (client-side filter on already-loaded data).
- **Excel export:** Always exports full dataset — all 80 rows × 27 months, regardless of search filter state.
- **Color thresholds** (same as check-clinics): `>50` → green | `10–50` → yellow | `1–9` → red | `0` → grey.

### Check Clinics — Color-Coded Pivot Table

Follows spec §7.7 exactly:
- **Filter bar:** Year | Metric (Truy vấn / Phiên) | Loại cơ sở | Tỉnh | Nhóm thuốc | Search
- **Pivot columns:** Miền | Vùng | Tỉnh | Mã (facility_code) | Tên | Tháng 1 – Tháng 12
- **Row identifier:** `facility_code` (UNIQUE per clinic; groups multiple staff)
- **Export:** Copy + Excel. Column Visibility toggle. 10 rows default, configurable.
- **Color thresholds:** `>50` → green | `10–50` → yellow | `1–9` → red | `0` → grey (client-side computation)

### Check Clinics — Detail Modal

- **Width:** `max-w-6xl` (1152px). Horizontal scroll inside for 31 day columns.
- **Background:** `bg-gray-900` (dark), white text.
- **Title:** `"Chi tiết theo nhân viên — [clinic_name] Tháng M Năm Y"`
- **Grid structure:** Rows = staff users at that facility. Columns = Mã NV | Tên NV | Ngày 1 – Ngày 31.
- **Cell layout — stacked:** Each day cell shows two values:
  - Top: `query_count` (larger text) — color-coded by threshold
  - Bottom: `"KH " + session_count` (smaller grey text)
  - Color threshold applies to **query_count** (`>50` green, `10–50` yellow, `1–9` red, `0` grey)
- **Trigger:** Clicking any clinic row in the pivot table opens this modal, fetching `GET /api/admin/check-clinics/[facilityCode]/detail?year=Y&month=M`

### Claude's Discretion
- Exact shade of teal for SectionHeader (use existing `SectionHeader` component)
- Empty state copy for the conversation messages panel before selection ("Chọn một cuộc trò chuyện để xem tin nhắn")
- Sticky column behavior for pivot table left columns (Miền, Vùng, Tỉnh, Mã, Tên)
- Loading skeleton style for map pins and conversation messages

</decisions>

<specifics>
## Specific Ideas

- Reference image `5_customer.jpg` shows the map section using the same teal `SectionHeader` pattern as all other admin sections — this confirms the collapsible section approach.
- Reference image `6_check_distributor_2.jpg` shows the modal cell layout as stacked numbers — top number large (colored), bottom label small ("KH X"). This directly maps to our query_count (top) + session_count (bottom) layout.
- The persistent split layout in the drawer (list always visible on left) avoids the need for a "back" button and lets users rapidly compare multiple conversations.
- Monthly pivot always exports all 80 rows × 27 months to give admins the full picture for offline analysis.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference images (MANDATORY — read before any UI implementation)
- `samples/5_customer.jpg` — Check Users visual reference: map section placement, teal SectionHeader, customer table export toolbar (Copy|Excel|CSV|PDF|Print), sales pivot layout below the table
- `samples/6_check_distributor.jpg` — Check Clinics pivot table visual reference: filter bar layout (Year + multiple dropdowns + search), color-coded cells, Column Visibility toggle, pagination style
- `samples/6_check_distributor_2.jpg` — Clinic detail modal visual reference: dark grid, stacked cell values (large number + small "KH X" below), staff rows × day columns structure

### Design specification
- `docs/2026-03-18-admin-dashboard-design.md` §7.6 — Check Users full spec (API shape for `/api/admin/check-users`, filter bar, map pins, DataTable columns, export buttons, monthly pivot, conversation drawer API endpoints)
- `docs/2026-03-18-admin-dashboard-design.md` §7.7 — Check Clinics full spec (API shape for `/api/admin/check-clinics` and detail endpoint, filter bar, pivot columns, color thresholds, clinic detail modal structure)
- `docs/2026-03-18-admin-dashboard-design.md` §6 — Export toolbar spec: Check Users uses all 5 formats (Copy + Excel + CSV + PDF + Print); monthly pivot uses Excel only; check-clinics uses Copy + Excel

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (stubs to complete)
- `components/admin/UserHistoryDrawer.tsx` — Stub. Complete with 600px width, persistent split layout (200px list panel + 380px messages panel), chat bubble rendering, two API calls on open and on select.
- `components/admin/ClinicDetailModal.tsx` — Stub. Complete with `max-w-6xl`, dark `bg-gray-900`, 31-day horizontal scroll, stacked query+session cells, color thresholds.
- `components/admin/ColorPivotTable.tsx` — Stub. Complete with all-rows display (no pagination), horizontal scroll, real-time search filter, Excel export of full dataset, color threshold cells.

### Reusable Assets (complete — use as-is)
- `components/admin/MapView.tsx` + `components/admin/LeafletMapInner.tsx` — Leaflet map wrapper with SSR-safe dynamic import. Use for the map section on check-users.
- `components/admin/DataTable.tsx` — Do NOT rewrite. Use `exportConfig={{ copy: true, excel: true, csv: true, pdf: true, print: true }}` for the user table.
- `components/admin/SectionHeader.tsx` — Teal collapsible section header. Use for map section, user table section, and monthly pivot section on check-users.
- `components/admin/FilterBar.tsx` — Use for both pages' filter bars.
- `components/admin/KpiCard.tsx` — Not needed on these two pages (no KPI cards in spec).
- `lib/admin/auth.ts` — `requireAdmin()` for all API routes.

### Established Patterns
- Service layer: async function, Supabase service client query, returns typed object. See `lib/admin/services/nhap-hang.ts`.
- SSR page: `async function Page()` → `requireAdmin()` → passes props to `'use client'` Client component.
- API route: `GET` handler → `requireAdmin()` → parse params → call service → `NextResponse.json()`.
- Client component: `'use client'`, `useState` for filters, `useCallback` for fetch, Recharts charts use `CHART_COLORS` constant.
- Reference: `app/admin/nhap-hang/NhapHangClient.tsx` for chart + table + filter wiring pattern.

### Integration Points
- `components/admin/AdminSidebar.tsx` — Hrefs `/admin/check-users` and `/admin/check-clinics` already set (from Phase 2 setup).
- New files to create: `lib/admin/services/check-users.ts`, `lib/admin/services/check-clinics.ts`, `app/api/admin/check-users/route.ts`, `app/api/admin/check-clinics/route.ts`, `app/api/admin/check-clinics/[facilityCode]/detail/route.ts`, `app/api/admin/users/[userId]/conversations/route.ts`, `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts`
- New page components: `app/admin/check-users/CheckUsersClient.tsx`, `app/admin/check-clinics/CheckClinicsClient.tsx`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-check-users-page-check-clinics-page*
*Context gathered: 2026-03-20*
