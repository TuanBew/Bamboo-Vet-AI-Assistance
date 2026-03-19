# Phase 4: Knowledge Base page + Users Analytics page - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build two read-only analytics pages:

1. **`/admin/knowledge-base`** — Document registry health dashboard. Shows 3 KPI cards, 6 charts across two sections (chunks + docs breakdown by drug group, category, type, and source), and a paginated searchable DataTable with Copy + Excel export.

2. **`/admin/users`** — User growth and facility analytics. Shows 3 charts (new users per month LineChart, by province BarChart, by district horizontal BarChart), two facility breakdown sections (all users + users with queries), each with 4 KPI tiles and a breakdown table, and a collapsible heavy-users section.

Both pages are data display only — no editing, no CRUD. Out of scope: Check-Users page, Check-Clinics page, conversation drawer, map, pivot tables (those are Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Data Fetching Architecture (carried from Phase 3)
- SSR `page.tsx` server component calls API with default params, passes data as props to a Client Component
- Client Component (`KnowledgeBaseClient.tsx`, `UsersClient.tsx`) owns filter state + data, handles refetches via `fetch()` when filters change
- Full section skeleton during refetch (animated gray placeholders)
- Filter state stored in URL searchParams

### Knowledge Base Page — Search Behavior
- **Debounced server refetch:** 300ms debounce after each keystroke → API call with `search` param
- **Page reset on search:** Any search change resets pagination to page 1 automatically
- **No top-level filter dropdowns:** Only a search bar above the DataTable (no doc_type or category dropdowns). The API supports these params but the KB page UI does not expose them.
- **Default page size:** 10 rows per page (consistent with Check-Users default in spec)

### Knowledge Base Page — DataTable
- **Default sort:** Relevance score descending (highest relevance first — surfaces KB health at a glance)
- **Column sort:** Client-side sort on the current loaded page via @tanstack/react-table (clicking headers sorts the 10 visible rows, no extra API calls)
- **Status filter:** All statuses visible (active + draft + archived). Status column makes state clear.
- **Export:** Copy + Excel only (per spec §6 export toolbar table)
- **Columns:** Mã | Tên tài liệu | Chunk count | Ngày tạo | Loại | Trạng thái | Relevance score

### Users Page — Filters
- **Filter bar:** Year + Month + Province + Clinic type selectors (using existing `FilterBar` component)
- **Trigger:** Immediate refetch on each filter change (no submit button) — same pattern as Dashboard
- **Filter scope:** All sections (charts, both KPI tile sections, heavy users table) respond to the active filter

### Users Page — Facility Type Icons
- **Icon style:** Colored dot badge per row (no emoji, no custom SVG)
- **Color mapping:** One distinct color per clinic_type:
  - `phong_kham` → teal/cyan dot
  - `nha_thuoc` → blue dot
  - `thu_y` → green dot
  - `my_pham` → pink dot
  - `khac` → gray dot
- **Appears in:** Both breakdown tables — "Tất cả khách hàng" and "Khách hàng đang truy vấn"
- **Column order (matches reference image):** Mã | Icon (dot) | Loại cơ sở | Số lượng | %

### Users Page — "Người dùng nhiều truy vấn" Section
- **Default state:** Collapsed (section header visible, content hidden by default)
- **Threshold:** >10 queries in the selected month (same month/year as the active filter)
- **Expand toggle:** SectionHeader component's collapse chevron

### Claude's Discretion
- Exact dot badge size and shade within each color family
- Recharts chart heights for KB and Users charts
- Exact skeleton placeholder shapes for each section
- Debounce implementation detail (useCallback + useEffect vs lodash.debounce)
- Column widths and truncation on the KB DataTable
- Users page chart grid layout (2+1 or 3-column for the three top charts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Page Specifications
- `docs/2026-03-18-admin-dashboard-design.md` §7.4 — Full `/admin/knowledge-base` page spec (KPI cards, chart sections, DataTable columns, export config)
- `docs/2026-03-18-admin-dashboard-design.md` §7.5 — Full `/admin/users` page spec (chart types, KPI tiles, facility breakdown, heavy users section)
- `docs/2026-03-18-admin-dashboard-design.md` §5 — API route shapes for `/api/admin/knowledge-base` and `/api/admin/users`
- `docs/2026-03-18-admin-dashboard-design.md` §6 — Export toolbar spec (Knowledge Base: Copy + Excel only)
- `docs/2026-03-18-admin-dashboard-design.md` §8 — Shared admin components registry

### Reference Design Images
- `samples/3_ton_kho.jpg` — Reference layout for Knowledge Base page (KPI cards at top, charts in grid, data table at bottom)
- `samples/4_khach_hang.jpg` — Reference layout for Users Analytics page (charts at top, facility breakdown sections with KPI tiles + tables)

### Prior Phase Context
- `.planning/phases/03-admin-dashboard-page-new-activity-page/03-CONTEXT.md` — Established data fetching pattern, filter behavior, shared component list

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/admin/KpiCard.tsx` — Colored card component (large number + label + optional icon). Use for both pages' KPI cards.
- `components/admin/SectionHeader.tsx` — Teal header with collapse toggle. Use for all collapsible sections including "Người dùng nhiều truy vấn".
- `components/admin/DataTable.tsx` — Generic @tanstack/react-table wrapper with configurable export toolbar. Pass `exportConfig={{ copy: true, excel: true }}` for KB page.
- `components/admin/FilterBar.tsx` — Controlled filter row. Wire to Users page for year/month/province/clinic_type selectors.
- `components/admin/SparklineChart.tsx` — Mini Recharts LineChart. Not needed for Phase 4 (no sparklines on KB or Users pages).

### Established Patterns
- **SSR + client refetch:** `page.tsx` (server) → `XxxClient.tsx` ('use client') pattern. Both Phase 4 pages follow this.
- **URL searchParams as filter state:** All filter values live in the URL, parsed in `page.tsx` and passed as initial props.
- **Recharts:** Already installed. Use `LineChart`, `BarChart`, `PieChart`, `ResponsiveContainer` from recharts.
- **@tanstack/react-table:** Already installed. DataTable component wraps it — use DataTable directly rather than building new table instances.

### Integration Points
- `app/admin/knowledge-base/` directory exists (empty). Add `page.tsx` and `KnowledgeBaseClient.tsx`.
- `app/admin/users/` directory exists (empty). Add `page.tsx` and `UsersClient.tsx`.
- New API routes needed: `app/api/admin/knowledge-base/route.ts` and `app/api/admin/users/route.ts`
- New services: `lib/admin/services/knowledge-base.ts` and `lib/admin/services/users.ts`
- Both pages hook into the existing admin layout (`app/admin/layout.tsx`) — no layout changes needed.

</code_context>

<specifics>
## Specific Ideas

- Reference `samples/3_ton_kho.jpg` for the Knowledge Base page: 3 KPI cards at top row, charts in a 2–3 column grid below, then a full-width data table at the bottom. This is the intended visual density.
- Reference `samples/4_khach_hang.jpg` for the Users page: top 2 charts side by side (LineChart + BarChart), wide horizontal BarChart below them, then the two KPI-tile + breakdown-table sections stacked vertically.
- Colored dot badges in the facility breakdown tables — simple `inline-block` rounded circle with Tailwind bg color, sized ~10-12px, placed in a dedicated narrow column.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-knowledge-base-page-users-analytics-page*
*Context gathered: 2026-03-19*
