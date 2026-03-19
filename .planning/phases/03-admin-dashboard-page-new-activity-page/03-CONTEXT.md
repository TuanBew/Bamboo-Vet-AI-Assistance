# Phase 3: Admin Dashboard page + New Activity page + Nhập hàng page - Context

**Gathered:** 2026-03-19 (updated with nhap-hang refactor)
**Status:** Ready for planning (nhap-hang gap-closure plan needed)

<domain>
## Phase Boundary

Build three fully functional admin pages:
- `/admin/dashboard` — flagship analytics page with platform KPIs, time-series charts + forecast dotted line, category donut charts, a user table with sparklines and inline mini-BarCharts, and a Leaflet clinic map
- `/admin/new-activity` — monthly activity view with 6 KPI cards, daily volume charts, recent sessions table, top-10 questions bar chart, and 3 category donuts
- `/admin/nhap-hang` — **COMPLETE REBUILD** — veterinary medicine purchase order tracking page, based on `samples/2_nhap_hang.jpg`. Previously built incorrectly as a chatbot usage page. Must be torn down and rebuilt as a stock input analytics page.

The dashboard and new-activity pages are backed by Supabase materialized views. The nhap-hang page is backed by new DB tables: `suppliers`, `products`, `purchase_orders`, `purchase_order_items`.

Out of scope: KB page, Users page, Check-Users, Check-Clinics, export buttons (those are Phases 4–5). DataTable/ColorPivotTable/UserHistoryDrawer components remain as stubs.

</domain>

<decisions>
## Implementation Decisions

### Dashboard + New Activity (existing — carried forward)

#### Dependency Installation (Phase 3 first task)
- Install as the very first task of Phase 3:
  ```bash
  npm install recharts react-leaflet leaflet @types/leaflet @tanstack/react-table
  ```
- `xlsx`, `jspdf`, `jspdf-autotable`, `tsx` are NOT installed in Phase 3 — they're not needed until Phase 5–6

#### Data Fetching Architecture
- **Pattern:** Hybrid SSR + client refetch
  1. `page.tsx` is a Server Component — reads `searchParams`, calls API server-side with default/URL params, passes data as props to a Client Component
  2. A `DashboardClient.tsx` / `NewActivityClient.tsx` Client Component (`'use client'`) owns filter state + data, handles refetches via `fetch()` when filters change
  3. On first paint, real SSR data is visible — no skeleton flash on initial load
- **Loading state during refetch:** Full section skeleton (animated gray placeholders)
- **Same pattern for both pages and for nhap-hang**

#### Filter State & Behavior
- **Source of truth:** URL searchParams (`?province=HN&month=2026-03&clinic_type=phong_kham`)
- **Trigger:** Immediate refetch on each filter change (no submit button, no debounce)
- **KPI scope (dashboard only):** Platform-wide totals always unfiltered (from `mv_dashboard_kpis`)

#### Dashboard "Người dùng" Table
- Inline Recharts `<BarChart>` per row (drug group + query type breakdown, ~120px wide)
- Top 20 users, sorted descending by `total_queries` — no pagination

#### Leaflet Map Pin Colors
- `> 50` queries → green | `10–50` → yellow | `1–9` → red | `0` → grey
- Click pin → popup: clinic name + total query count

### Nhập hàng Page (NEW — complete rebuild)

#### Route & Navigation
- **Route:** Keep `/admin/nhap-hang` (Vietnamese, no rename)
- **Sidebar position:** Under CORE section, inserted after Dashboard (📦 Nhập hàng)

#### Reference Design
- **MUST read:** `samples/2_nhap_hang.jpg` before implementing any UI
- Page sections (top → bottom): Filter bar → 6 KPI cards → 2 charts (area + bar) → order table + top-10 products bar → 2 donut charts → 1 radar chart

#### Product Data Source
- **All 62 products** from `samples/Danh_muc_san_pham_FULL.xlsx` — agent must read this file
- XLSX columns to use: STT, Nhóm (4 groups), TÊN SP, Phân loại, Quy cách, Nhà sản xuất (short name)
- Pricing is NOT in the XLSX — generate by classification:
  - `TABS` (nutritional supplements): 150,000 – 500,000 VND
  - `Kháng sinh` (antibiotics): 200,000 – 800,000 VND
  - `Cầu trùng, ký sinh trùng` (antiparasitic): 150,000 – 600,000 VND
  - `SP Bổ trợ`, `Thuốc bổ`: 100,000 – 400,000 VND
  - `Hạ sốt - Giảm đau`: 100,000 – 350,000 VND
  - `Thuốc sát trùng`: 80,000 – 300,000 VND
  - `SP xử lý CTCN`, `SP rắc chuồng`: 80,000 – 250,000 VND

#### Suppliers (NPP)
- 5 Vietnamese veterinary medicine distributor names
- NPP001: "Công ty TNHH Phân phối Thú y Miền Bắc" (Hà Nội)
- NPP002: "Công ty CP Dược Thú y Trung Nam" (Đà Nẵng)
- NPP003: "Công ty TNHH Thương mại Thú y Phương Nam" (TP. Hồ Chí Minh)
- NPP004: "Công ty CP Phân phối Nông nghiệp Việt" (Hà Nội)
- NPP005: "Công ty TNHH Dược Thú y Đông Bắc" (Hải Phòng)
- NPP001 and NPP003 are most frequent (40% of orders each)

#### Purchase Order Seed Data Structure
- **Order code format:** CTT000001 sequential (matches reference image: CTT000061, CTT000070)
- **Volume:** 2–5 orders/month, growing from ~2 in early 2024 to 4–5 in 2026
- **Products per order:** 5–15 line items, rotating across all 62 products
- **Date range:** January 2024 – March 2026 (same as rest of seed data)
- **Total orders:** ~95 orders across 27 months
- **Promo quantity:** 30% of orders have promo_qty > 0 per line item (0–3 promo units)
- **SKU coverage:** All 62 products must appear at least once over 27 months

#### KPI Filter Scope (nhap-hang differs from dashboard)
- ALL 6 KPIs are filtered by NPP + month/year — no "always-unfiltered" baseline
- This is intentional: the page is about a specific supplier's orders in a specific month

#### Page Charts (from reference image)
- KPI cards: Blue | Yellow | Cyan | Pink | Teal | Purple (same order as reference)
- Left chart: `AreaChart` — daily revenue (Doanh số) by day
- Right chart: `BarChart` — daily quantity with 2 series (SL nhập + SL KM/promo)
- Orders table: simple (Mã đơn | Ngày nhập | Thành tiền) — no pagination, typically 2–5 rows
- Top 10 products: horizontal `BarChart` by total_revenue
- Ngành hàng donut: by `product_group` (4 groups)
- Nhóm sản phẩm donut: by `classification` (up to 9 categories)
- Thương hiệu radar: `<RadarChart>` by manufacturer — each spoke = 1 brand

### Claude's Discretion
- Exact Recharts color palette for chart series (teal/cyan theme to match admin shell)
- Recharts chart height per section
- Exact skeleton placeholder shapes
- `lib/admin/forecast.ts` linear regression implementation details
- `avg_session_duration_min` computation in new-activity API
- RadarChart color and fill opacity for brands section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full Design Spec
- `docs/2026-03-18-admin-dashboard-design.md` — Complete spec covering all 3 pages

### Dashboard Page
- `docs/2026-03-18-admin-dashboard-design.md` §5 — `GET /api/admin/dashboard` response shape, forecast computation, KPI filter scope
- `docs/2026-03-18-admin-dashboard-design.md` §7.2 — Dashboard page layout: 4 sections with exact chart types and columns

### New Activity Page
- `docs/2026-03-18-admin-dashboard-design.md` §5 — `GET /api/admin/new-activity` response shape (6 KPIs, daily series, recent_sessions, top_questions)
- `docs/2026-03-18-admin-dashboard-design.md` §7.3 — New Activity page layout: 6 KPI cards (colored backgrounds), charts, sessions table, top questions, 3 donut charts

### Nhập hàng Page (PRIMARY REFERENCE)
- `samples/2_nhap_hang.jpg` — **Visual reference image — MUST be read before implementing any UI**
- `samples/Danh_muc_san_pham_FULL.xlsx` — **Full product catalog — agent must read this file to generate all 62 product seed rows**
- `docs/2026-03-18-admin-dashboard-design.md` §3.1 — 4 new tables: `suppliers`, `products`, `purchase_orders`, `purchase_order_items`
- `docs/2026-03-18-admin-dashboard-design.md` §5 — `GET /api/admin/nhap-hang` response shape and filter behaviour
- `docs/2026-03-18-admin-dashboard-design.md` §7.3b — Full page layout spec including KPI card colors and all chart types
- `docs/2026-03-18-admin-dashboard-design.md` §9.2b — Nhập hàng seed data: suppliers, pricing rules, order volume, supplier distribution

### Shared Components (already built as stubs — wire in Phase 3)
- `docs/2026-03-18-admin-dashboard-design.md` §8 — Component interfaces: KpiCard, SectionHeader, FilterBar, MapView, SparklineChart

### Database / Views
- `docs/2026-03-18-admin-dashboard-design.md` §3.2 — All 4 materialized views (for dashboard + new-activity)

### Auth Pattern (for API routes)
- `docs/2026-03-18-admin-dashboard-design.md` §4.3 — `requireAdmin()` usage pattern
- `lib/admin/auth.ts` — Existing `requireAdmin()` utility

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already built in Phase 2)
- `components/admin/KpiCard.tsx` — Accepts `value`, `label`, `icon`, `bgColor`, `textColor`. Wire directly for all KPI cards across all 3 pages.
- `components/admin/SectionHeader.tsx` — Collapsible teal header. Wrap each page section.
- `components/admin/FilterBar.tsx` — Controlled filter row stub. For nhap-hang: wire with NPP dropdown + month picker.
- `components/admin/MapView.tsx` — Already has `next/dynamic({ssr:false})` wrapper. Dashboard only.
- `components/admin/SparklineChart.tsx` — Stub accepts `data: number[]`. Dashboard user table only.
- `lib/admin/auth.ts::requireAdmin()` — Use in all new API routes.
- `lib/supabase/server.ts::createServiceClient()` — Use for all DB queries.

### Established Patterns
- Admin layout wraps all content in `.dark` class div with `bg-gray-900` — chart backgrounds should use `bg-gray-800` or transparent
- API route guard pattern: `const auth = await requireAdmin(); if (auth instanceof NextResponse) return auth`
- No LanguageProvider in admin — Vietnamese strings are hardcoded
- Component stubs use `'use client'` — maintain this for chart components (Recharts requires it)
- SSR + client refetch pattern established in dashboard and new-activity — replicate for nhap-hang

### Integration Points
- `app/admin/dashboard/page.tsx` — Replace stub with real SSR page component + Client wrapper (done in plans 01–02)
- `app/admin/new-activity/page.tsx` — Replace stub with real SSR page component + Client wrapper (done in plan 03)
- `app/admin/nhap-hang/page.tsx` — **REBUILD from scratch** — tear down chatbot usage content, rebuild as purchase order analytics
- New API routes to create: `app/api/admin/nhap-hang/route.ts`, `lib/admin/services/nhap-hang.ts`
- New seed data files: `data/seeds/suppliers.ts`, `data/seeds/products.ts`, `data/seeds/purchase_orders.ts`, `data/seeds/purchase_order_items.ts`
- `scripts/seed.ts` — Must be updated to include nhap-hang tables in the seeding run

</code_context>

<specifics>
## Specific Ideas

- The reference image `samples/2_nhap_hang.jpg` shows exact KPI card colors — blue, yellow/gold, cyan, pink/red, teal, purple — in that exact order. Replicate these colors, not the teal/cyan-only palette from the dashboard.
- The orders table in the reference shows only 2 rows for March 2026 — this validates the 2–5 orders/month volume decision.
- The radar chart ("Thương hiệu") uses Recharts `<RadarChart>` with `<PolarGrid>`, `<PolarAngleAxis dataKey="brand">`, `<Radar dataKey="revenue" fill="..." fillOpacity={0.6}>`. Each spoke = 1 manufacturer. Bamboo Vet has 4–6 distinct manufacturers from the XLSX (Megavet, TOPCIN, Sakan, VILSAN, Gold Coin, SUPER'S DIANA).
- Order code format CTT000001 is sequential across all time — NOT reset per year. Orders in 2024 start at CTT000001, those in 2026 are in the CTT000080+ range.
- The `subtotal` column in `purchase_order_items` is a PostgreSQL generated column — no need to compute it in application code.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 03-admin-dashboard-page-new-activity-page*
*Context gathered: 2026-03-19 (nhap-hang refactor added)*
