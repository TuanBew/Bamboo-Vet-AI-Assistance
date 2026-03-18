# Project Research Summary

**Project:** Bamboo Vet Admin Analytics Dashboard (Product B)
**Domain:** Internal SaaS analytics dashboard — veterinary AI chatbot platform (Next.js App Router monorepo extension)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

The Bamboo Vet admin dashboard is a well-scoped internal analytics tool added as a parallel product (`/admin/*`) inside the existing Next.js 16 / React 19 / Supabase / Tailwind CSS v4 / shadcn/ui monorepo. The research confirms the v3 design spec is unusually thorough — API shapes are typed, materialized views are pre-designed, export scope is per-page, and all out-of-scope items are explicit. The correct build strategy is to treat this as a layered dependency problem: database migrations and seed data must land before any UI component is built, auth infrastructure must be wired before any admin page is accessible, and the shared admin shell must exist before page-specific features are added.

The recommended new dependencies are well-validated and React 19 compatible: Recharts 3.x for charts (SVG-based, declarative), react-leaflet 5.x for maps (requires `ssr: false` dynamic import), @tanstack/react-table 8.x for tables (headless, pairs with shadcn/ui), and jsPDF 4.x + SheetJS for exports. The single most important non-obvious technical decision is that all Recharts components need `'use client'` while all Leaflet components need `dynamic(() => import(), { ssr: false })` — these are different mechanisms for different reasons and mixing them up causes build failures.

The top risk in the entire build is a conflict between the two research agents on the middleware/proxy file naming convention. ARCHITECTURE.md (citing Next.js 16 docs published 2026-03-16) asserts that `proxy.ts` with `export function proxy()` is the correct convention for Next.js 16 and the existing file is already active. PITFALLS.md asserts the opposite: that `proxy.ts` is silently ignored and admin routes are currently unprotected. This conflict must be resolved with a direct smoke test (`curl` to `/app` while logged out) before any auth guard work begins in Phase 2. All other findings across the four research files are consistent and mutually reinforcing.

## Key Findings

### Recommended Stack

The admin dashboard adds 7 new packages to the existing monorepo. All are React 19 compatible with no peer dependency conflicts. The existing Tailwind CSS v4 setup handles the dark admin theme via CSS variables scoped to a `.dark` wrapper `<div>` on the admin layout — no `next-themes` package is needed. One pre-existing bug must be fixed before the dark theme works: `globals.css` line 4 uses `(&:is(.dark *))` which does not match the `.dark` element itself; it must be changed to `(&:where(.dark, .dark *))`.

**Core new technologies:**
- **recharts ^3.8.0:** Time-series, pie/donut, bar, and sparkline charts — largest React chart ecosystem, React 19 peer dep native in v3.x, SVG output
- **leaflet ^1.9.4 + react-leaflet ^5.0.0:** Geographic clinic map on Vietnam — free OpenStreetMap tiles, no API key; react-leaflet v5 explicitly requires React 19
- **@tanstack/react-table ^8.21.3:** Headless table with server-side pagination/sorting/filtering — composes with shadcn/ui `<Table>` elements, `manualPagination: true` is required for all admin tables
- **jspdf ^4.2.0 + jspdf-autotable ^5.0.7:** Client-side PDF export — v4.x mandatory (CVE-2025-68428 in v3.x, CVSS 9.2); always `await import()` dynamically, never top-level import
- **xlsx 0.18.5:** Excel and CSV export — dynamic import to avoid 800KB+ bundle hit; use `writeFileXLSX` not `writeFile`; CSV needs `\uFEFF` BOM for Vietnamese diacritics in Excel
- **@types/leaflet ^1.9.12:** Required — leaflet ships no built-in TypeScript types

### Expected Features

The spec defines a complete v1 with 7 admin pages. All features below are in-scope for initial delivery with no deferred items.

**Must have — table stakes (P0/P1, infrastructure and core UX):**
- Middleware fix and admin auth gate (`requireAdmin()` utility + route guard) — security prerequisite; nothing else is deployable without this
- Database migrations: `profiles`, `chat_analytics`, `kb_documents` tables + 4 materialized views with unique indexes + RLS policies + `SECURITY DEFINER` trigger
- Seed data script (27 months of analytics data, 80 users, idempotent)
- Admin layout shell: dark sidebar, top bar, manual refresh trigger, placeholder pages for all 7 routes
- KPI cards, time-series area charts, category donut charts, paginated DataTable, filter bar (province/clinic type/month), Excel/CSV export, responsive sidebar navigation

**Should have — differentiators (P2):**
- Geographic Leaflet map (dashboard overview + full-width check-users view)
- Color-coded pivot tables (users monthly, clinics monthly) with green/yellow/red/grey thresholds
- Clinic detail modal (daily breakdown grid with dynamic day count per month)
- User conversation history drawer (Sheet component with lazy-loaded messages)
- Sparkline charts per user table row, inline stacked bar charts per user
- 3-month linear regression forecast rendered as dotted line on time-series chart

**Defer — v1.x or later:**
- Month-over-month KPI delta arrows (trivial to add post-launch if admins request)
- Marker clustering on map (relevant when user count exceeds ~200)
- Row virtualization (relevant when dataset grows beyond seed volume)
- Live data pipeline replacing seed data (requires RAGflow event capture architecture)
- Multi-tenant clinic admin accounts, audit logging, notification system

**Explicitly out of scope (anti-features correctly excluded):**
- Real-time WebSocket updates (internal tool, 2 admins, manual refresh is correct)
- i18n in admin (all operators are Vietnamese, Vietnamese-only is correct)
- Admin-UI role promotion (SQL-only promotion is the right security tradeoff)
- Mobile native app (17-column pivot tables do not translate to mobile)

### Architecture Approach

The admin dashboard is a parallel product sharing auth infrastructure but isolated in components, API routes, and data access. All admin pages are Client Components that fetch from `/api/admin/*` Route Handlers. Route handlers authenticate via `requireAdmin()` (two-client pattern: cookie-based anon client for session, service role client for `profiles.is_admin` lookup), then query materialized views via `createServiceClient()` which bypasses RLS. Materialized views pre-compute all aggregations; API routes execute plain `SELECT` with optional `WHERE` filters, keeping response times under 50ms. The `server-only` package must be added to `lib/supabase/server.ts` to enforce the server/client boundary at build time.

**Major components and build order:**
1. **Database layer** (`supabase/migrations/`) — 5 migration files: tables, views, indexes, RLS, trigger
2. **Auth infrastructure** (`lib/admin/auth.ts`, extended `lib/supabase/middleware.ts`) — `requireAdmin()` guard, proxy/middleware admin route guards
3. **Seed data** (`data/seeds/`, `scripts/seed.ts`, `scripts/refresh-views.ts`) — can run in parallel with auth layer
4. **Admin shell** (`app/admin/layout.tsx`, `components/admin/AdminSidebar.tsx`) — dark layout wrapper with `.dark` class; blocked by auth
5. **Shared admin components** (`components/admin/*.tsx`) — KpiCard, FilterBar, DataTable, ColorPivotTable, MapView, SparklineChart; can build in parallel with shell
6. **API routes + pages** (8 routes, 7 pages) — blocked by all layers above
7. **Forecast + polish** (`lib/admin/forecast.ts`) — linear regression integration, last layer

**Key architectural patterns:**
- Service role client (`createServiceClient()`) for all admin data access — never anon client in admin routes
- `'use client'` + `ResponsiveContainer` with explicit parent height for all Recharts components
- `dynamic(() => import(), { ssr: false })` inside a Client Component wrapper for all Leaflet usage
- Dynamic `await import()` inside event handlers for jsPDF and xlsx — never top-level
- `manualPagination: true`, `manualSorting: true`, `manualFiltering: true` on all TanStack Table instances that consume server-paginated data
- `COALESCE` in `mv_category_stats` view definition to prevent NULL columns from breaking the unique index used by `REFRESH CONCURRENTLY`
- Admin components live exclusively in `components/admin/` — never imported by chatbot pages to avoid bundle contamination

### Critical Pitfalls

1. **Middleware/proxy naming conflict (MUST RESOLVE FIRST)** — ARCHITECTURE.md (citing Next.js 16 docs) says `proxy.ts` is the correct Next.js 16 convention and is currently active. PITFALLS.md says `proxy.ts` is silently ignored and all routes are currently unprotected. Run `curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/app` while logged out to determine truth before writing any auth guard code. If the redirect is empty, proxy.ts is not running and must be renamed to `middleware.ts` with export renamed to `middleware`.

2. **Supabase `SECURITY DEFINER` trigger is mandatory** — The `handle_new_user()` trigger on `auth.users` must use `SECURITY DEFINER` or it silently fails under `supabase_auth_admin` role. Missing this means no `profiles` row is created on signup, `is_admin` checks always return null, and the admin dashboard shows zero users. Include `SECURITY DEFINER SET search_path = public` in the initial migration.

3. **Materialized view unique indexes must be in the same migration file** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` throws a hard error without a unique index. Each of the 3 concurrent views needs its `CREATE UNIQUE INDEX` in the same migration. `mv_dashboard_kpis` (single aggregate row) cannot use `CONCURRENTLY` and must be refreshed separately. Use `COALESCE` on nullable columns to ensure the unique index is stable.

4. **Leaflet SSR crash** — Leaflet accesses `window` at import time. `'use client'` alone is not sufficient. The map component must be loaded via `dynamic(() => import('@/components/admin/MapView'), { ssr: false })` inside a Client Component wrapper. Copy marker icons to `public/leaflet/` and set paths explicitly — bundlers break Leaflet's built-in icon path resolution.

5. **Service role client must not reach client bundle** — Add `import 'server-only'` to `lib/supabase/server.ts` immediately in Phase 2. This causes a build-time error if any client component imports from it, enforcing the architectural boundary. Admin client components must fetch from `/api/admin/*` routes, never import server utilities directly.

6. **jsPDF Vietnamese diacritics in PDF export** — Default jsPDF fonts (Helvetica, Courier, Times) do not support Vietnamese glyphs. Characters render as boxes. Embed a Unicode-capable font (Roboto or Noto Sans) via `doc.addFont()` before generating content. Pin jsPDF to `^4.2.0` minimum — versions ≤3.0.4 have CVE-2025-68428 (CVSS 9.2).

## Implications for Roadmap

Based on the layer dependency graph from ARCHITECTURE.md and the pitfall phase warnings from PITFALLS.md, the natural phase structure is:

### Phase 1: Database Foundation
**Rationale:** Everything else reads from materialized views. Views need tables. Tables need migrations. No UI work is possible until the schema exists and data is present.
**Delivers:** 5 migration files (tables + views + indexes + RLS + trigger), seed data script, view refresh script
**Addresses:** FEATURES.md P0 items — database schema, seed data
**Avoids:** Pitfall 3 (SECURITY DEFINER trigger), Pitfall 4 (unique indexes for CONCURRENTLY), Pitfall 13 (NULL columns in category view)
**Research flag:** Standard patterns — Supabase migration and seeding are well-documented. No phase research needed.

### Phase 2: Auth Infrastructure
**Rationale:** Admin route protection must be verified and wired before any admin page is built. A security gap here exposes the entire dashboard.
**Delivers:** Resolved middleware/proxy convention (smoke test first), `requireAdmin()` utility, admin guard in middleware, `server-only` boundary on Supabase server utilities
**Addresses:** FEATURES.md P0 items — middleware fix, admin auth gate
**Avoids:** Pitfall 1 (proxy naming), Pitfall 2 (service role client leak), Pitfall 9 (middleware on static assets), Pitfall 14 (two-client pattern in middleware)
**Research flag:** RESOLVE FIRST — Run smoke test to determine whether proxy.ts is active before writing any guard logic. The ARCHITECTURE.md vs PITFALLS.md conflict on this point is the single highest-priority gap in the research.

### Phase 3: Admin Shell and Shared Components
**Rationale:** All 7 pages render inside the admin layout. Shared components (DataTable, FilterBar, ColorPivotTable, MapView, SparklineChart) are used across multiple pages. Building them once before page implementation eliminates duplication and establishes patterns.
**Delivers:** `app/admin/layout.tsx` with `.dark` wrapper, `AdminSidebar.tsx`, `DataTable.tsx` with export toolbar, `FilterBar.tsx`, `KpiCard.tsx`, `ColorPivotTable.tsx`, `MapView.tsx` (Leaflet), `SparklineChart.tsx`
**Uses:** Tailwind v4 dark theme via CSS variable overrides (fix `@custom-variant dark` selector), shadcn/ui Sheet + Dialog + Table primitives
**Avoids:** Pitfall 7 (xlsx dynamic import), Pitfall 8 (jsPDF dynamic import), Pitfall 10 (TanStack manual flags), Pitfall 15 (Vietnamese diacritics)
**Research flag:** Standard patterns — shadcn/ui and TanStack Table composition is well-documented. No phase research needed.

### Phase 4: Dashboard Page (Primary Landing)
**Rationale:** The dashboard is the primary admin landing page and uses the highest variety of components (KPIs, 2 area charts, 6 donuts, user table with sparklines, Leaflet map). Building it first validates the full component stack end-to-end.
**Delivers:** `/admin/dashboard` page with KPI cards, time-series charts, donut charts, user table, geographic map, 3-month forecast dotted line
**Uses:** Recharts (AreaChart, PieChart), react-leaflet (MapView), @tanstack/react-table, `/api/admin/dashboard` Route Handler, `lib/admin/forecast.ts`
**Avoids:** Pitfall 5 (Leaflet SSR), Pitfall 6 (Recharts 0x0), Pitfall 11 (Leaflet marker icons), Pitfall 12 (CSP tiles)
**Research flag:** Forecast implementation — linear regression on time-series data is straightforward, but the visual distinction between real and forecast data (dotted line, legend, clamped negatives) needs careful UX treatment. Standard patterns otherwise.

### Phase 5: Data Explorer Pages (Check Users + Check Clinics)
**Rationale:** These are the highest-complexity pages (color-coded pivot tables, clinic detail modal with dynamic day columns, conversation history drawer, full-width map). They depend on all shared components from Phase 3 and the Leaflet pattern validated in Phase 4.
**Delivers:** `/admin/check-users` (map + table + monthly pivot + conversation drawer), `/admin/check-clinics` (clinic pivot + daily detail modal), `/api/admin/check-users`, `/api/admin/check-clinics`, `/api/admin/check-clinics/[facilityCode]/detail`
**Addresses:** FEATURES.md P2 differentiators — pivot tables, clinic detail modal, conversation history drawer
**Avoids:** Pivot table horizontal scroll (pin identifier columns, `overflow-x: auto`), dynamic day column count in clinic detail modal (28-31 days per month), cascading province/district filter state management
**Research flag:** Clinic detail modal (dynamic day grid with 17+ columns) is the most complex single UI component in the spec. Consider a brief implementation spike before committing to the exact cell layout.

### Phase 6: Analytics + KB Pages + Polish
**Rationale:** New Activity, Knowledge Base, Users Analytics, and Settings pages are secondary views that reuse patterns already established in Phases 3-5. Export polish (PDF with embedded font for Vietnamese, print CSS) and copy-to-clipboard are low-risk additions.
**Delivers:** All remaining pages (`/admin/new-activity`, `/admin/knowledge-base`, `/admin/users`, `/admin/settings`), PDF export with Vietnamese font embedding, print-optimized CSS, copy to clipboard
**Addresses:** FEATURES.md P3 polish items
**Research flag:** Standard patterns — page structure and export patterns are fully established by this phase. No phase research needed.

### Phase Ordering Rationale

- Layers 0 (database) and auth (Phase 2) are hard prerequisites — no admin page can be built or safely accessed without them
- Seed data (Phase 1) can run in parallel with auth wiring (Phase 2) since neither depends on the other
- Shared components (Phase 3) can be developed in parallel with dashboard API routes since components receive data as props
- Dashboard (Phase 4) acts as integration test for the full stack before tackling higher-complexity pages
- Data explorer pages (Phase 5) are isolated to their own phase because the pivot table and modal complexity warrants focused implementation time
- The pitfall phase warnings from PITFALLS.md align exactly with this ordering — each phase's pitfalls are contained within that phase

### Research Flags

Needs deeper attention or verification during planning:
- **Phase 2 (Auth):** Smoke test `proxy.ts` vs `middleware.ts` naming BEFORE writing any guard code — the two research agents directly contradict each other on this point
- **Phase 5 (Clinic detail modal):** Dynamic day-column grid (28-31 columns) with dual values per cell is the highest-complexity single component; consider a brief spike to validate the cell layout approach before full implementation

Phases with standard, well-documented patterns (no additional research needed):
- **Phase 1:** Supabase migrations, materialized views, RLS — official Supabase docs fully cover this
- **Phase 3:** shadcn/ui + TanStack Table composition, Tailwind v4 dark theme — established patterns
- **Phase 6:** Remaining pages follow patterns set in Phases 3-5

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm registry; React 19 compatibility confirmed for all 6 packages; peer dependency matrix is clean |
| Features | HIGH | Spec is finalized v3 with typed API shapes; feature scope is locked; FEATURES.md explicitly maps table stakes vs differentiators vs anti-features |
| Architecture | HIGH | Verified against Next.js 16.1.6 `package.json`, existing codebase files, and PostgreSQL docs; one unresolved conflict on proxy.ts naming |
| Pitfalls | HIGH | All critical pitfalls backed by official docs, GitHub issues with hundreds of reports, or direct codebase inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **Proxy.ts vs middleware.ts naming (CRITICAL):** ARCHITECTURE.md and PITFALLS.md give directly contradictory guidance. ARCHITECTURE.md cites Next.js 16 docs (v16.1.7, updated 2026-03-16) saying `proxy.ts` is correct. PITFALLS.md says `proxy.ts` is silently ignored. Resolve via smoke test before Phase 2 begins: navigate to `/app` while logged out and confirm whether a redirect to `/login` occurs. If yes, proxy.ts is active (ARCHITECTURE.md is correct). If no, proxy.ts is ignored (PITFALLS.md is correct).

- **Loading, error, and empty states:** The spec does not define skeleton/spinner patterns, error UI, or what charts look like with zero data for a filter combination. These need decisions during Phase 3 implementation.

- **Vietnamese PDF font:** The approach (embed base64 Roboto/Noto Sans via `doc.addFont()`) is well-documented but adds ~200KB to the client bundle on the check-users page. Decide during Phase 6 whether to lazy-load the font file or pre-embed it.

- **Mobile breakpoints for tables and charts:** Spec mentions sidebar collapse but does not detail responsive behavior for 17-column pivot tables or multi-chart pages on screens below 1440px. Horizontal scroll containers are the default recommendation; validate during Phase 5.

- **Accessibility:** No ARIA labels or keyboard navigation spec for custom components (ColorPivotTable, ClinicDetailModal, UserHistoryDrawer). Flag for post-launch if needed.

## Sources

### Primary (HIGH confidence)
- Next.js 16 proxy.js file convention docs (v16.1.7, 2026-03-16) — proxy vs middleware naming
- npm registry — recharts 3.8.0, react-leaflet 5.0.0, @tanstack/react-table 8.21.3, jspdf 4.2.0 version confirmation
- PostgreSQL materialized view REFRESH CONCURRENTLY docs — unique index requirement
- Supabase RLS docs — SECURITY DEFINER trigger pattern
- Design spec `docs/2026-03-18-admin-dashboard-design.md` v3 — feature scope, API shapes, component list
- Existing codebase: `proxy.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `package.json` — direct inspection
- CVE-2025-68428 — jsPDF path traversal, fixed in v4.0.0

### Secondary (MEDIUM confidence)
- react-leaflet GitHub issues #1152, #956 — SSR incompatibility confirmation
- Recharts GitHub issue #1579 — ResponsiveContainer 0-height documentation
- SheetJS GitHub issues #694, #2033 — bundle size and writeFileXLSX recommendation
- jsPDF GitHub issue #1959 — Next.js SSR crash
- SaaS Dashboard UI/UX patterns research — KPI card design, pivot table UX

### Tertiary (LOW confidence)
- Vietnamese PDF font embedding: approach is documented in jsPDF community but exact base64 encoding workflow needs validation during Phase 6 implementation

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
