# Phase 3: Admin Dashboard page + New Activity page - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build two fully functional analytics pages:
- `/admin/dashboard` — flagship page with platform KPIs, time-series charts + forecast dotted line, category donut charts, a user table with sparklines and inline mini-BarCharts, and a Leaflet clinic map
- `/admin/new-activity` — monthly activity view with 6 KPI cards, daily volume charts, recent sessions table, top-10 questions bar chart, and 3 category donuts

Both pages are backed by new API routes (`/api/admin/dashboard`, `/api/admin/new-activity`) querying Supabase materialized views. `lib/admin/forecast.ts` (linear regression) is created in this phase.

Out of scope: KB page, Users page, Check-Users, Check-Clinics, export buttons (those are Phases 4–5). DataTable/ColorPivotTable/UserHistoryDrawer components remain as stubs.

</domain>

<decisions>
## Implementation Decisions

### Dependency Installation (Phase 3 first task)
- Install as the very first task of Phase 3:
  ```bash
  npm install recharts react-leaflet leaflet @types/leaflet @tanstack/react-table
  ```
- Phase 6 (POL-01) still validates all deps present + correct versions (jspdf CVE check, etc.)
- `xlsx`, `jspdf`, `jspdf-autotable`, `tsx` are NOT installed in Phase 3 — they're not needed until Phase 5–6

### Data Fetching Architecture
- **Pattern:** Hybrid SSR + client refetch
  1. `page.tsx` is a Server Component — it reads `searchParams` (Next.js passes automatically), calls the API route server-side with default/URL params, and passes data as props to a Client Component
  2. A `DashboardClient.tsx` / `NewActivityClient.tsx` Client Component (`'use client'`) owns filter state + data, handles refetches via `fetch()` when filters change
  3. On first paint, real SSR data is visible — no skeleton flash on initial load
- **Loading state during refetch:** Full section skeleton (animated gray placeholders replacing charts/tables area while data loads)
- **Same pattern for both pages** — Dashboard and New Activity use identical SSR+client architecture

### Filter State & Behavior
- **Source of truth:** URL searchParams (`?province=HN&month=2026-03&clinic_type=phong_kham`)
- **Trigger:** Immediate refetch on each filter change (no submit button, no debounce)
- **Default values (SSR initial load):**
  - `month` = current month (`2026-03`)
  - `province` = null (all provinces)
  - `clinic_type` = null (all types)
- **KPI scope:** Platform-wide totals are always unfiltered (from `mv_dashboard_kpis`). Filter bar label notes: "Bộ lọc áp dụng cho biểu đồ" (filter applies to charts only)
- **New Activity page:** Month/year picker only (no province/clinic_type filter)

### Dashboard "Người dùng" Table
- **Inline charts:** Real Recharts `<BarChart>` components inside each table row:
  - Drug group breakdown: horizontal stacked bar, ~120px wide, no axes/legend
  - Query type breakdown: horizontal stacked bar, ~120px wide, no axes/legend
  - 12-month sparkline: existing `SparklineChart` component (wire it in Phase 3)
- **Row count:** Top 20 users, sorted descending by `total_queries`
- **No pagination** — leaderboard-style view, not exhaustive list

### Leaflet Map Pin Colors (Dashboard "Phòng khám" section)
- Use same thresholds as `ColorPivotTable` for visual consistency:
  - `> 50` queries → green
  - `10–50` queries → yellow
  - `1–9` queries → red
  - `0` queries → grey
- Click pin → popup shows clinic name + total query count
- Map center: Vietnam (~16°N, 106°E), zoom 6

### Claude's Discretion
- Exact Recharts color palette for chart series (teal/cyan theme to match admin shell)
- Recharts chart height per section
- Exact skeleton placeholder shapes (bar-shaped divs or shadcn Skeleton component)
- `lib/admin/forecast.ts` linear regression implementation details
- `avg_session_duration_min` computation: use raw SQL in API route, minimum 1 min for single-message conversations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full Design Spec
- `docs/2026-03-18-admin-dashboard-design.md` — Complete spec covering both pages

### Dashboard Page
- `docs/2026-03-18-admin-dashboard-design.md` §5 — `GET /api/admin/dashboard` response shape, forecast computation, KPI filter scope
- `docs/2026-03-18-admin-dashboard-design.md` §7.2 — Dashboard page layout: 4 sections (Tổng quan, Chỉ số tập trung, Người dùng, Phòng khám) with exact chart types and columns

### New Activity Page
- `docs/2026-03-18-admin-dashboard-design.md` §5 — `GET /api/admin/new-activity` response shape (6 KPIs, daily series, recent_sessions, top_questions derivation)
- `docs/2026-03-18-admin-dashboard-design.md` §7.3 — New Activity page layout: 6 KPI cards (colored backgrounds), charts, sessions table, top questions, 3 donut charts

### Shared Components (already built as stubs — wire in Phase 3)
- `docs/2026-03-18-admin-dashboard-design.md` §8 — Component interfaces: KpiCard, SectionHeader, FilterBar, MapView, SparklineChart

### Database / Views
- `docs/2026-03-18-admin-dashboard-design.md` §3.2 — All 4 materialized views: `mv_dashboard_kpis`, `mv_monthly_queries`, `mv_daily_queries`, `mv_category_stats`
- `docs/2026-03-18-admin-dashboard-design.md` §3.1 — `profiles`, `chat_analytics`, `kb_documents` table schemas (for join queries in API routes)

### Auth Pattern (for API routes)
- `docs/2026-03-18-admin-dashboard-design.md` §4.3 — `requireAdmin()` usage pattern (early return on 403)
- `lib/admin/auth.ts` — Existing `requireAdmin()` utility

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already built in Phase 2)
- `components/admin/KpiCard.tsx` — Accepts `value`, `label`, `icon`, `bgColor`, `textColor`. Wire directly for KPI cards on both pages.
- `components/admin/SectionHeader.tsx` — Collapsible teal header, accepts `title` + `children`. Wrap each dashboard section.
- `components/admin/FilterBar.tsx` — Controlled filter row stub. Wire with real province/clinic_type options from API data.
- `components/admin/MapView.tsx` — Already has `next/dynamic({ssr:false})` wrapper. Swap `MapViewPlaceholder` for real react-leaflet component.
- `components/admin/SparklineChart.tsx` — Stub accepts `data: number[]`. Wire with real Recharts `<LineChart>`.
- `lib/admin/auth.ts::requireAdmin()` — Use in both new API routes.
- `lib/supabase/server.ts::createServiceClient()` — Use for all DB queries in API routes.

### Established Patterns
- Admin layout wraps all content in `.dark` class div with `bg-gray-900` — chart backgrounds should use `bg-gray-800` or transparent
- API route guard pattern: `const auth = await requireAdmin(); if (auth instanceof NextResponse) return auth`
- No LanguageProvider in admin — Vietnamese strings are hardcoded
- Component stubs use `'use client'` — maintain this for chart components (Recharts requires it)

### Integration Points
- `app/admin/dashboard/page.tsx` — Replace stub with real SSR page component + Client wrapper
- `app/admin/new-activity/page.tsx` — Replace stub with real SSR page component + Client wrapper
- New API routes: `app/api/admin/dashboard/route.ts`, `app/api/admin/new-activity/route.ts` (create new files)
- `lib/admin/forecast.ts` — New file for linear regression helper

</code_context>

<specifics>
## Specific Ideas

- The spec explicitly notes: KPI cards always show **platform-wide totals** — unfiltered even when province/clinic_type filter is active. The API returns `kpis` from `mv_dashboard_kpis` (no filter dimensions) and filter-aware chart data separately in the same response.
- Forecast: `lib/admin/forecast.ts` does `y = a + b*x` linear regression on last 6 months' `query_count`. Append 3 forecast months with `is_forecast: true`. Client renders forecast portion with `strokeDasharray="4 4"` — this likely means a separate Recharts `<Line>` series or a custom dot that skips the solid segment.
- `mv_dashboard_kpis.refreshed_at` is used in the Settings page (already wired). Dashboard page should NOT call a separate refresh — it just reads the existing timestamp if needed.
- For the map, the `MapView` component already has the interface: `pins: MapPin[]` where each pin has `latitude`, `longitude`, `label`, `popupContent`, `color`. The API route's `clinic_map` array maps directly to this shape.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 03-admin-dashboard-page-new-activity-page*
*Context gathered: 2026-03-19*
