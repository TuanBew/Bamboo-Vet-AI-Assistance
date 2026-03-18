# Roadmap: Bamboo Vet Admin Dashboard

## Overview

Product B adds an internal Vietnamese-only admin SaaS dashboard at `/admin/*` to the existing Bamboo Vet Next.js monorepo. The build proceeds in strict dependency order: the database schema and seed data must exist before any UI query can run, auth infrastructure must be verified and hardened before any admin page is accessible, the shared shell and component library must be in place before pages are built, and then the six admin pages are delivered in two batches — the high-traffic dashboard and activity pages first, then knowledge base and user analytics, then the complex data-explorer views, with a final security and polish pass to close the milestone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Migrations & Seed Data** - Create schema, materialized views, indexes, RLS, trigger, and idempotent seed scripts
- [ ] **Phase 2: Admin Shell & Role-Based Routing** - Wire middleware guard, auth utilities, dark layout shell, and all shared admin components
- [ ] **Phase 3: Admin Dashboard page + New Activity page** - Build primary landing page with KPIs/charts/map and the New Activity analytics view
- [ ] **Phase 4: Knowledge Base page + Users Analytics page** - Deliver KB document registry page and the users analytics page
- [ ] **Phase 5: Check Users page + Check Clinics page** - Build the complex data-explorer pages with pivot tables, maps, conversation drawer, and clinic modal
- [ ] **Phase 6: Security & Polish** - Install dependencies, harden CSP, verify service role boundary, print CSS, and Vietnamese PDF strategy

## Phase Details

### Phase 1: Database Migrations & Seed Data
**Goal**: The Postgres schema is fully deployed and populated — every table, materialized view, unique index, RLS policy, and SECURITY DEFINER trigger exists; running the seed script once fills the database with realistic 27-month analytics data; running refresh-views.ts succeeds without errors for all four views.
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, DB-10, DB-11, DB-12
**Success Criteria** (what must be TRUE):
  1. A new user signing up via Supabase Auth automatically gets a row in `profiles` with `is_admin = false` — verified by inserting a test user and querying `profiles`.
  2. Running `scripts/refresh-views.ts` completes without error and all four materialized views (`mv_monthly_queries`, `mv_daily_queries`, `mv_category_stats`, `mv_dashboard_kpis`) contain rows.
  3. `mv_monthly_queries`, `mv_daily_queries`, and `mv_category_stats` each have a `UNIQUE INDEX` and support `REFRESH CONCURRENTLY`; `mv_dashboard_kpis` refreshes with plain `REFRESH` and contains exactly one row.
  4. Querying `profiles` returns 82 rows (80 non-admin + 2 admin); `conversations` has ~4,000 rows; `messages` has ~20,000 rows; `kb_documents` has 120 rows.
  5. Running the seed script a second time (idempotency check) produces no duplicate rows and no errors.
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Migration SQL files (6 migrations) + refresh-views.ts
- [ ] 01-02-PLAN.md — Seed data markdown files (clinics, profiles, conversations, query_events, kb_documents)
- [ ] 01-03-PLAN.md — Seed script (scripts/seed.ts) + manual verification

### Phase 2: Admin Shell & Role-Based Routing
**Goal**: Every `/admin/*` route is protected — unauthenticated and non-admin users are redirected to `/login`; admins logging in via `/app` are automatically forwarded to `/admin/dashboard`; the dark sidebar shell renders on all admin pages; all seven shared admin components exist and render without errors.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07
**Success Criteria** (what must be TRUE):
  1. Navigating to `/admin/dashboard` while logged out redirects to `/login` (smoke-test resolves proxy.ts vs middleware.ts naming before any guard code is written).
  2. Logging in with a non-admin account and visiting `/admin/dashboard` redirects to `/login`; logging in as an admin and visiting `/app` redirects to `/admin/dashboard`.
  3. The `requireAdmin()` utility returns a 403 response when called from an API route by a non-admin — verified by calling `/api/admin/dashboard` as a non-admin.
  4. All seven admin pages render the dark sidebar (`#1a1f2e`), breadcrumb top bar, and "Làm mới dữ liệu" refresh button without hydration errors in the browser console.
  5. The `globals.css` dark mode selector fix (`(&:where(.dark, .dark *))`) is applied and Tailwind v4 dark theme utility classes render correctly inside the `.dark` wrapper div.
**Plans**: TBD

### Phase 3: Admin Dashboard page + New Activity page
**Goal**: The two primary analytics pages are fully functional — `/admin/dashboard` displays platform-wide KPIs, time-series charts with a 3-month forecast dotted line, category donut charts, a user table with sparklines, and a Leaflet clinic map; `/admin/new-activity` shows 6 KPI cards, daily volume charts, recent sessions table, top popular questions, and category donuts.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06
**Success Criteria** (what must be TRUE):
  1. `/admin/dashboard` loads without SSR hydration errors; KPI cards show non-zero platform totals drawn from `mv_dashboard_kpis`; the grouped bar chart and area chart both render with visible data for 2024/2025/2026.
  2. The forecast dotted line appears on the area chart for the 3 months beyond the latest real data point (`is_forecast: true` months use `strokeDasharray="4 4"`); `lib/admin/forecast.ts` linear regression runs server-side.
  3. The Leaflet clinic map on `/admin/dashboard` renders with color-coded pins (no SSR crash, no missing marker icons); clicking a pin shows a popup with clinic name and query volume.
  4. `/admin/new-activity` renders 6 colored KPI cards, the daily AreaChart and sessions BarChart, the recent sessions table, the top-10 questions horizontal bar chart, and 3 category donut PieCharts — all with visible data.
  5. Both pages pass `next build` with no TypeScript errors and no client-bundle exposure of the service role client.
**Plans**: TBD

### Phase 4: Knowledge Base page + Users Analytics page
**Goal**: `/admin/knowledge-base` displays document registry KPIs, 6 charts across two sections, and a paginated searchable DataTable with Excel export; `/admin/users` displays user growth charts, facility breakdown sections with KPI tiles, and a collapsible heavy-users table.
**Depends on**: Phase 3
**Requirements**: KB-01, KB-02, KB-03, USERS-01, USERS-02, USERS-03, USERS-04, USERS-05
**Success Criteria** (what must be TRUE):
  1. `/admin/knowledge-base` renders 3 KPI cards (total documents, total chunks, unique ratio) with correct values drawn from `kb_documents`; all 6 charts (2 horizontal bar charts + 2 pie charts + 2 bar charts) render with data.
  2. The knowledge base DataTable paginates correctly, the search bar filters rows in real time, and clicking "Excel export" downloads a valid `.xlsx` file containing all document rows.
  3. `/admin/users` renders the 3 charts (new users per month LineChart, users by province BarChart, users by district horizontal BarChart) with non-zero data.
  4. The "Tất cả khách hàng" and "Khách hàng đang truy vấn" sections each show 4 KPI tiles and a facility-type breakdown table with correct counts and percentages.
  5. The "Người dùng nhiều truy vấn" section is collapsible and lists users exceeding the 10-queries/month threshold.
**Plans**: TBD

### Phase 5: Check Users page + Check Clinics page
**Goal**: The two data-explorer pages are fully operational — `/admin/check-users` shows a full-width Leaflet map, a paginated user table with all five export formats, a monthly pivot table, and a conversation history drawer; `/admin/check-clinics` shows a color-coded monthly clinic pivot table with a multi-filter bar and a clinic detail modal with daily breakdown grid.
**Depends on**: Phase 4
**Requirements**: CHKU-01, CHKU-02, CHKU-03, CHKU-04, CHKU-05, CHKU-06, CHKU-07, CHKC-01, CHKC-02, CHKC-03, CHKC-04
**Success Criteria** (what must be TRUE):
  1. The full-width Leaflet map on `/admin/check-users` renders with pins color-coded by `clinic_type`; clicking a pin shows a popup with full name and clinic type; no SSR crash occurs.
  2. The user DataTable offers all five export buttons (Copy, Excel, CSV, PDF, Print); each produces a valid artifact; PDF contains readable text (diacritics handled with documented strategy).
  3. "Xem lịch sử" on a user row opens the shadcn Sheet drawer, lists that user's conversations, and selecting a conversation loads messages in a read-only chat-style view using the service role client.
  4. The monthly pivot table (rows = users, columns = 2024-01 through 2026-03) renders with color-coded cells (green/yellow/red/grey thresholds) and the Excel export button downloads the full pivot.
  5. Clicking a clinic row in `/admin/check-clinics` opens a dark Dialog modal (`bg-gray-900`) showing staff users as rows and days 1–31 as columns, with query and session counts in each cell using the same color thresholds.
**Plans**: TBD

### Phase 6: Security & Polish
**Goal**: All new npm packages are installed at correct versions (including jsPDF >=4.2.0 for CVE-2025-68428); the service role client is provably absent from the client bundle; CSP allows Leaflet tiles; print CSS hides the sidebar; Vietnamese diacritics in PDF export are handled with a documented and tested strategy.
**Depends on**: Phase 5
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05
**Success Criteria** (what must be TRUE):
  1. `package.json` lists `jspdf@^4.2.0` (not `^3.x`); `npm audit` reports no high/critical CVEs related to the admin dependencies; `recharts`, `react-leaflet`, `leaflet`, `@tanstack/react-table`, `xlsx`, and `tsx` are all present.
  2. Running `window.print()` from any admin data table page produces a printed view with only the table visible — the dark sidebar is hidden by `@media print` CSS rules.
  3. Running `next build` and inspecting the client bundle (via `ANALYZE=true` or build output) confirms `createServiceClient` and the Supabase service role key do not appear in any client chunk.
  4. The Content Security Policy in `next.config.js` includes `https://*.tile.openstreetmap.org` in `img-src` and `connect-src`; the Leaflet map loads tiles without CSP violations in the browser console.
  5. Exporting a PDF from the Check Users page produces a file where Vietnamese diacritics (e.g., "Nguyen Thi Hoa", "Ha Noi") are legible — either via embedded Unicode font or a documented fallback strategy with a known limitation noted in code comments.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Migrations & Seed Data | 0/3 | Planning complete | - |
| 2. Admin Shell & Role-Based Routing | 0/TBD | Not started | - |
| 3. Admin Dashboard + New Activity | 0/TBD | Not started | - |
| 4. Knowledge Base + Users Analytics | 0/TBD | Not started | - |
| 5. Check Users + Check Clinics | 0/TBD | Not started | - |
| 6. Security & Polish | 0/TBD | Not started | - |
