# Roadmap: Bamboo Vet Admin Dashboard

## Overview

Product B adds an internal Vietnamese-only admin SaaS dashboard at `/admin/*` to the existing Bamboo Vet Next.js monorepo. The build proceeds in strict dependency order: the database schema and seed data must exist before any UI query can run, auth infrastructure must be verified and hardened before any admin page is accessible, the shared shell and component library must be in place before pages are built, and then the six admin pages are delivered in two batches — the high-traffic dashboard and activity pages first, then knowledge base and user analytics, then the complex data-explorer views, with a final security and polish pass to close the milestone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Database Migrations & Seed Data** - Create schema, materialized views, indexes, RLS, trigger, and idempotent seed scripts (completed 2026-03-29)
- [x] **Phase 2: Admin Shell & Role-Based Routing** - Wire middleware guard, auth utilities, dark layout shell, and all shared admin components (completed 2026-03-18)
- [x] **Phase 3: Admin Dashboard page + Nhap Hang page** - Build primary landing page with KPIs/charts/map and Nhap hang purchase order analytics page (completed 2026-03-19)
- [x] **Phase 4: Tồn Kho page + Khách Hàng page** - Build inventory stock analytics page and business customer analytics page (complete rebuild from prior wrong scope) (completed 2026-03-20)
- [ ] **Phase 5: Check Customers page + Check Distributor page** - Build data-explorer pages with Leaflet map, pivot tables, color-coded cells, and daily detail modal
- [ ] **Phase 6: Security & Polish** - Install dependencies, harden CSP, verify service role boundary, print CSS, and Vietnamese PDF strategy
- [ ] **Phase 7: Performance Optimization** - Fix middleware latency (getSession + JWT claim), add Suspense streaming to admin pages

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
**Plans:** 4/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Migration SQL files (6 migrations) + refresh-views.ts
- [x] 01-02-PLAN.md — Seed data markdown files (clinics, profiles, conversations, query_events, kb_documents)
- [x] 01-03-PLAN.md — Seed script (scripts/seed.ts) + manual verification
- [x] 01-04-PLAN.md — Comprehensive sales seed data (2024-2026) — 90 products, 450 customers, 73K snapshots, 2.2K purchases

### Phase 2: Admin Shell & Role-Based Routing
**Goal**: Every `/admin/*` route is protected — unauthenticated and non-admin users are redirected to `/login`; admins logging in via `/app` are automatically forwarded to `/admin/dashboard`; the dark sidebar shell renders on all admin pages; all seven shared admin components exist and render without errors.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07
**Success Criteria** (what must be TRUE):
  1. Navigating to `/admin/dashboard` while logged out redirects to `/login` (smoke-test resolves proxy.ts vs middleware.ts naming before any guard code is written).
  2. Logging in with a non-admin account and visiting `/admin/dashboard` redirects to `/login`; logging in as an admin and visiting `/app` redirects to `/admin/dashboard`.
  3. The `requireAdmin()` utility returns a 403 response when called from an API route by a non-admin — verified by calling `/api/admin/dashboard` as a non-admin.
  4. All seven admin pages render the dark sidebar (`#1a1f2e`), breadcrumb top bar, and "Lam moi du lieu" refresh button without hydration errors in the browser console.
  5. The `globals.css` dark mode selector fix (`(&:where(.dark, .dark *))`) is applied and Tailwind v4 dark theme utility classes render correctly inside the `.dark` wrapper div.
**Plans:** 5 plans

Plans:
- [ ] 02-01-PLAN.md — Dark mode CSS fix + proxy smoke test + middleware admin guards + requireAdmin() utility
- [ ] 02-02-PLAN.md — Admin layout shell (sidebar + top bar) + 7 page shells + settings page
- [ ] 02-03-PLAN.md — Shared admin component stubs (KpiCard, SectionHeader, DataTable, ColorPivotTable, FilterBar, MapView, SparklineChart, ClinicDetailModal, UserHistoryDrawer)
- [ ] 02-04-PLAN.md — Gap closure: update SHELL-02 requirement (desktop-only) + fix MapView.tsx dynamic import (ssr: false)

### Phase 3: Admin Dashboard page + Nhap Hang page
**Goal**: The primary analytics pages are fully functional — `/admin/dashboard` displays platform-wide KPIs, time-series charts with a 3-month forecast dotted line, category donut charts, a user table with sparklines, and a Leaflet clinic map; `/admin/nhap-hang` shows 6 KPI cards, purchase order charts, orders table with detail drawer, and supplier/product analytics.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. `/admin/dashboard` loads without SSR hydration errors; KPI cards show non-zero platform totals drawn from `mv_dashboard_kpis`; the grouped bar chart and area chart both render with visible data for 2024/2025/2026.
  2. The forecast dotted line appears on the area chart for the 3 months beyond the latest real data point (`is_forecast: true` months use `strokeDasharray="4 4"`); `lib/admin/forecast.ts` linear regression runs server-side.
  3. The Leaflet clinic map on `/admin/dashboard` renders with color-coded pins (no SSR crash, no missing marker icons); clicking a pin shows a popup with clinic name and query volume.
  4. `/admin/nhap-hang` renders 6 KPI cards, AreaChart (daily revenue), BarChart (daily quantity), orders table, top 10 products chart, donut charts, and RadarChart — all with visible data.
  5. Both pages pass `next build` with no TypeScript errors and no client-bundle exposure of the service role client.
**Plans:** 5/5 plans complete

Plans:
- [x] 03-01-PLAN.md — Install npm deps + forecast.ts linear regression + dashboard API service and route
- [x] 03-02-PLAN.md — Wire FilterBar/SparklineChart/MapView components + build Dashboard page client
- [x] 03-03-PLAN.md — New Activity API service/route + New Activity page client
- [ ] 03-04-PLAN.md — Gap closure: fix mv_category_stats column mismatches (drug_group->drug_category, query_count->count, user_id removal)
- [ ] 03-05-PLAN.md — Gap closure: complete rebuild of /admin/nhap-hang as purchase order analytics page (DB tables, seed data, API, page UI)

### Phase 4: Tồn Kho page + Khách Hàng page
**Goal**: `/admin/ton-kho` displays inventory stock analytics — 3 KPI cards, 6 charts in a 2×3 grid, and a paginated DataTable — all filtered by date-based inventory snapshots; `/admin/khach-hang` displays business customer analytics — 3 charts, two KPI+breakdown sections, and a collapsible high-value stores section. Phase also includes new DB migration + seed data and teardown of wrong KB/Users implementation.
**Depends on**: Phase 3
**Requirements**: TK-01, TK-02, TK-03, KH-01, KH-02, KH-03, KH-04, KH-05
**Success Criteria** (what must be TRUE):
  1. Migration `20260320_008` creates `inventory_snapshots`, `customers`, `customer_purchases` tables; seed script populates ~806 snapshot rows, ~200 customers, ~500–800 purchase rows; old KB/Users files are deleted; `AdminSidebar.tsx` links point to `/admin/ton-kho` and `/admin/khach-hang`.
  2. `/admin/ton-kho` renders 3 KPI cards (Tổng giá trị tồn, Tổng số lượng, Số SKU/Tổng SKU), 6 charts (4 horizontal BarCharts + 2 Donut PieCharts), and a DataTable with Copy + Excel export — all reflecting data for the selected snapshot date.
  3. `/admin/khach-hang` renders 3 chart panels (LineChart new customers per month, BarChart by province, horizontal BarChart by district) with non-zero data for the selected NPP filter.
  4. "Tất cả khách hàng" section shows 4 KPI tiles + breakdown table for all 8 customer types (TH/GSO/PHA/SPS/BTS/OTHER/PLT/WMO) with correct Số lượng and %.
  5. "Khách hàng đang mua hàng" section shows 4 KPI tiles + breakdown table with % theo Tổng KH + % theo KH còn hoạt động; "Số lượng cửa hiệu >300K" section is collapsible with graceful empty state.
**Plans:** 3/3 plans complete

Plans:
- [ ] 04-01-PLAN.md — Migration + seed data (3 tables, ~1600 rows) + teardown old KB/Users files + sidebar update
- [ ] 04-02-PLAN.md — Ton Kho service/API route + page UI (KPIs, 2x3 chart grid, DataTable)
- [ ] 04-03-PLAN.md — Khach Hang service/API route + page UI (charts, 3 collapsible sections, breakdown tables)

### Phase 5: Check Customers page + Check Distributor page
**Goal**: The two data-explorer pages are fully operational — `/admin/check-customers` shows a full-width Leaflet map with customer pins, a paginated DataTable with all five export formats and Check Location flyTo, a brand x month revenue pivot table, and a display programs section; `/admin/check-distributor` shows a color-coded monthly distributor pivot table with multi-filter bar, Column Visibility toggle, and a dark-themed daily detail modal showing staff x day breakdown with stacked revenue and customer count cells. Additionally, `/admin/check-users` shows chatbot user analytics with Leaflet map, user DataTable, conversation history drawer, and monthly pivot; `/admin/check-clinics` shows facility analytics with clinic pivot table and daily staff detail modal.
**Depends on**: Phase 4
**Requirements**: CHKU-01, CHKU-02, CHKU-03, CHKU-04, CHKU-05, CHKU-06, CHKU-07, CHKC-01, CHKC-02, CHKC-03, CHKC-04
**Success Criteria** (what must be TRUE):
  1. `/admin/check-customers` renders a Leaflet map with customer pins; clicking a pin shows store name and type; clicking "Check Location" in the DataTable pans the map to that customer's coordinates.
  2. The customer DataTable offers all five export buttons (Copy, Excel, CSV, PDF, Print) and shows 11 columns including image thumbnail, geo-location badge, and Check Location action.
  3. The brand x month revenue pivot table shows manufacturer rows vs month columns with VND-formatted values, pagination, and all 5 export formats.
  4. The distributor pivot table on `/admin/check-distributor` shows color-coded cells (green >= 100M, yellow 10M-99M, red 1-9.9M, grey 0) with Column Visibility toggle and Truoc/Tiep theo pagination.
  5. Clicking a distributor row opens a dark Dialog modal (`bg-gray-900`) showing staff rows x days 1-31 columns, with stacked revenue + KH count per cell using the same color thresholds.
  6. `/admin/check-users` renders Leaflet map with user pins, DataTable with 11 columns + Xem lich su action, and monthly pivot table.
  7. `/admin/check-clinics` renders ColorPivotTable with Mien/Vung/Tinh/Ma/Ten + Thang 1-12 columns; clicking a row opens dark Dialog with staff x day grid.
**Plans:** 5 plans

Plans:
- [x] 05-01-PLAN.md — Database migration (display_programs + distributor_staff tables, ALTER customers/suppliers) + seed data + service layer + API routes
- [x] 05-02-PLAN.md — Check Customers page (SSR + client with map, DataTable, revenue pivot, display programs) + MapView flyTo enhancement + sidebar update
- [x] 05-03-PLAN.md — Check Distributor page (SSR + client with filter bar, ColorPivotTable full implementation, DistributorDetailModal)
- [ ] 05-04-PLAN.md — Gap closure: Check Users page (service layer + 3 API routes + SSR page + client with map, DataTable, UserHistoryDrawer, monthly pivot)
- [ ] 05-05-PLAN.md — Gap closure: Check Clinics page (service layer + 2 API routes + SSR page + client with ColorPivotTable, ClinicDetailModal) + ColorPivotTable PDF export fix

### Phase 6: Security & Polish
**Goal**: All new npm packages are installed at correct versions (including jsPDF >=4.2.0 for CVE-2025-68428); the service role client is provably absent from the client bundle; CSP allows Leaflet tiles; print CSS hides the sidebar; Vietnamese diacritics in PDF export are handled with a documented and tested strategy; all Vietnamese UI strings are centralized in an i18n dictionary.
**Depends on**: Phase 5
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05, POL-06
**Success Criteria** (what must be TRUE):
  1. `package.json` lists `jspdf@^4.2.0` (not `^3.x`); `npm audit` reports no high/critical CVEs related to the admin dependencies; `recharts`, `react-leaflet`, `leaflet`, `@tanstack/react-table`, `xlsx`, and `tsx` are all present.
  2. Running `window.print()` from any admin data table page produces a printed view with only the table visible — the dark sidebar is hidden by `@media print` CSS rules.
  3. Running `next build` and inspecting the client bundle (via `ANALYZE=true` or build output) confirms `createServiceClient` and the Supabase service role key do not appear in any client chunk.
  4. The Content Security Policy in `next.config.js` includes `https://*.tile.openstreetmap.org` in `img-src` and `connect-src`; the Leaflet map loads tiles without CSP violations in the browser console.
  5. Exporting a PDF from the Check Users page produces a file where Vietnamese diacritics (e.g., "Nguyen Thi Hoa", "Ha Noi") are legible — either via embedded Unicode font or a documented fallback strategy with a known limitation noted in code comments.
  6. All hardcoded Vietnamese UI strings in admin components and pages are extracted into `lib/i18n/vietnamese.ts`; all shared components and page clients import from this centralized dictionary with correct diacritics.
**Plans:** 5/7 plans executed

Plans:
- [ ] 06-01-PLAN.md — Install tsx devDep + print CSS (globals.css + layout IDs) + CSP connect-src update
- [ ] 06-02-PLAN.md — Vietnamese font module (Roboto TTF base64) + DataTable/ColorPivotTable PDF handler fix
- [ ] 06-03-PLAN.md — i18n dictionary (lib/i18n/vietnamese.ts) + shared admin component refactor
- [ ] 06-04-PLAN.md — i18n refactor for all 8 page client components
- [ ] 06-05-PLAN.md — Seed data generators: profiles, conversations, messages, chat_analytics, query_events
- [ ] 06-06-PLAN.md — Seed data generators: customers, purchases, suppliers, products, orders + seed runner rewrite
- [ ] 06-07-PLAN.md — Build verification (POL-03 bundle security) + human checkpoint

### Phase 7: Performance Optimization
**Goal**: All pages load fast -- middleware makes zero network calls (getSession instead of getUser, JWT is_admin claim instead of DB query), and heavy SSR admin pages use Suspense streaming to render skeletons immediately while data loads in the background.
**Depends on**: Phase 6
**Requirements**: Performance requirements captured in CONTEXT.md (Fix 1-4)
**Success Criteria** (what must be TRUE):
  1. `lib/supabase/middleware.ts` uses `getSession()` (not `getUser()`) and reads `is_admin` from `session.user.app_metadata.is_admin` JWT claim -- zero network calls in middleware.
  2. Middleware does not import `createServiceClient` or query the `profiles` table -- all DB queries eliminated from middleware.
  3. `/app` (chatbot) routes only check session existence in middleware -- no is_admin check, no profile fetch.
  4. Admin pages (dashboard, nhap-hang, ton-kho, khach-hang) use Suspense streaming with async Loader components -- skeleton renders immediately, data streams in.
  5. SQL migration `20260329_010_custom_access_token_hook.sql` creates a Postgres function that injects `is_admin` into the JWT `app_metadata`, registered via Supabase Dashboard Authentication Hooks.
  6. `next build` passes with zero TypeScript errors.
**Plans:** 3 plans

Plans:
- [ ] 07-05-PLAN.md — Middleware rewrite (getSession + JWT claim) + SQL migration for custom_access_token_hook
- [ ] 07-06-PLAN.md — Suspense streaming for 4 admin pages (dashboard, nhap-hang, ton-kho, khach-hang)
- [ ] 07-07-PLAN.md — Build verification + human checkpoint (page load speed + auth)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Migrations & Seed Data | 1/3 | In Progress|  |
| 2. Admin Shell & Role-Based Routing | 4/4 | Complete   | 2026-03-18 |
| 3. Admin Dashboard + Nhap Hang     | 5/5 | Complete   | 2026-03-19 |
| 4. Tồn Kho + Khách Hàng | 3/3 | Complete   | 2026-03-20 |
| 5. Check Customers + Check Distributor | 3/5 | In Progress|  |
| 6. Security & Polish | 5/7 | In Progress|  |
| 7. Performance Optimization | 0/3 | Not Started |  |
