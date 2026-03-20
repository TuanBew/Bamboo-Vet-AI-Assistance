# Phase 4: Tồn Kho + Khách Hàng - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning (complete rebuild — prior KB/Users implementation deleted)

<domain>
## Phase Boundary

Phase 4 is a **complete rebuild**. The prior implementation (AI knowledge base page + AI chatbot users page) was entirely wrong and must be deleted. The correct pages are:

- `/admin/ton-kho` — Product stock/inventory analytics showing stock levels of 62 veterinary medicine products from `samples/Danh_muc_san_pham_FULL.xlsx`.
- `/admin/khach-hang` — Business customer analytics showing stores, pharmacies, grocery shops, beauty shops that buy products from the distributor.

These pages adapt the IMEXCO | Analyst reference design (`samples/3_ton_kho.jpg` and `samples/4_khach_hang.jpg`) to the Bamboo Vet veterinary medicine distributor context.

</domain>

<decisions>
## Implementation Decisions

### Teardown — files to delete vs keep

**Delete entirely** (wrong domain, cannot salvage):
- `app/admin/knowledge-base/page.tsx` + `KnowledgeBaseClient.tsx`
- `app/admin/users/page.tsx` + `UsersClient.tsx`
- `app/api/admin/knowledge-base/route.ts`
- `app/api/admin/users/route.ts`
- `lib/admin/services/knowledge-base.ts`
- `lib/admin/services/users.ts`

**Keep untouched** (correctly implemented in prior run):
- `components/admin/DataTable.tsx` — Full @tanstack/react-table v8 with pagination, sorting, debounced search, Copy + Excel export via `exportConfig` prop. Do NOT rewrite.

**Overwrite in-place** (small update only):
- `components/admin/AdminSidebar.tsx` — Update two hrefs: `/admin/knowledge-base` → `/admin/ton-kho`, `/admin/users` → `/admin/khach-hang`. Update labels.

**Create new directories and files**:
- `app/admin/ton-kho/page.tsx` + `app/admin/ton-kho/TonKhoClient.tsx`
- `app/admin/khach-hang/page.tsx` + `app/admin/khach-hang/KhachHangClient.tsx`
- `app/api/admin/ton-kho/route.ts`
- `app/api/admin/khach-hang/route.ts`
- `lib/admin/services/ton-kho.ts`
- `lib/admin/services/khach-hang.ts`

### Export buttons

Client-side only using `xlsx` library (already installed). Both pages use `DataTable` with `exportConfig={{ copy: true, excel: true }}`. No backend export endpoints needed.

### Inventory snapshot behavior

**User picks a specific date.** The date picker in the filter bar is fully functional. The API queries `inventory_snapshots` for the latest snapshot on or before the selected date (per product). Default date = today.

Seed data: weekly snapshots for 13 weeks (~806 rows = 62 products × 13 weeks). Each row captures qty + unit_price per product per snapshot date.

### Database — new migration required

No `inventory_snapshots`, `customers`, or `customer_purchases` tables exist yet. A new migration `20260320_008_add_ton_kho_khach_hang_tables.sql` must be created before seeding.

The existing `products` table (from nhap-hang migration `20260319_007`) is **compatible** with the 62 products in `Danh_muc_san_pham_FULL.xlsx` — columns match: product_code, product_name, product_group, classification, packaging, manufacturer, unit_price. The 62 catalog products should be seeded into this same `products` table.

**New tables:**

```sql
-- inventory_snapshots: weekly stock level per product per date
CREATE TABLE inventory_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  qty           integer NOT NULL DEFAULT 0,
  unit_price    numeric(12,0) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, snapshot_date)
);

-- customers: business customers (stores, pharmacies, etc.) that buy from the distributor
CREATE TABLE customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code  text NOT NULL UNIQUE,
  customer_name  text NOT NULL,
  customer_type  text NOT NULL, -- TH | GSO | PHA | SPS | BTS | OTHER | PLT | WMO
  province       text,
  district       text,
  is_active      boolean NOT NULL DEFAULT true,
  is_mapped      boolean NOT NULL DEFAULT false,  -- Đã phân tuyến
  is_geo_located boolean NOT NULL DEFAULT false,  -- Đã định vị
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- customer_purchases: purchase orders from customers
CREATE TABLE customer_purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  purchase_date date NOT NULL,
  qty           integer NOT NULL,
  unit_price    numeric(12,0) NOT NULL,
  total_value   numeric(15,0) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**Seed volumes:**
- 62 products from Danh_muc_san_pham_FULL.xlsx (verify existing or add)
- ~806 inventory_snapshots rows (62 × 13 weekly snapshots)
- ~200 customers: type distribution TH 28%, GSO 34%, PHA 14%, SPS 12%, BTS 9%, OTHER+PLT+WMO 3%
- ~500–800 customer_purchases rows spread across last 3 months

### Ton-kho page layout (strictly from samples/3_ton_kho.jpg)

**Filter bar:** NPP dropdown | Date picker (snapshot_date, default today) | Nhóm/Brand dropdown | Search

**3 KPI cards** (colored backgrounds):
1. Tổng giá trị tồn — SUM(qty × unit_price) — Blue
2. Tổng số lượng — SUM(qty) — Orange
3. Số SKU / Tổng SKU — count(qty>0)/total — Teal

**6 charts in 2 rows of 3 columns:**
- Row 1: "Giá trị tồn theo nhóm" (H-BarChart) | "Giá trị tồn theo thương hiệu" (H-BarChart) | "Giá trị tồn theo ngành hàng" (Donut PieChart)
- Row 2: "Số lượng tồn theo nhóm" (H-BarChart) | "Số lượng tồn theo thương hiệu" (H-BarChart) | "Số lượng tồn theo ngành hàng" (Donut PieChart)

**DataTable "Danh sách sản phẩm tồn kho":**
Columns: Mã sản phẩm | Tên sản phẩm | Số lượng | Tồn min | Ngày nhập mới nhất | Đơn giá | Thành tiền
Export: Copy + Excel. Search bar.

### Khach-hang page layout (strictly from samples/4_khach_hang.jpg)

**Filter bar:** NPP dropdown (top, always visible)

**3 chart panels:**
- "Số lượng khách hàng mới theo tháng" — LineChart (new customers per month)
- "Số lượng khách hàng theo tỉnh" — BarChart (customers by province)
- "Số lượng khách hàng theo huyện" — Horizontal BarChart (customers by district)

**"Tất cả khách hàng" section** (SectionHeader, open by default):
- 4 KPI tiles: Còn hoạt động | Đã phân tuyến % | Đã định vị % | Số loại cửa hiệu
- Breakdown table: Mã | Icon | Loại cửa hiệu | Số lượng | %
- Types: TH (Tạp hóa) | GSO (Bách hóa) | PHA (Nhà thuốc) | SPS (Mẹ & Bé) | BTS (Mỹ phẩm) | OTHER (Khác) | PLT (Phụ liệu tóc) | WMO (Chợ)

**Brand filter row** between sections ("Tất cả thương hiệu" search/filter button)

**"Khách hàng đang mua hàng" section** (SectionHeader, open by default):
- 4 KPI tiles: Total with orders | Đã phân tuyến % | Đã định vị % | Số loại cửa hiệu
- Breakdown table: Mã | Icon | Loại cửa hiệu | Số lượng | % theo Tổng KH | % theo KH còn hoạt động
- Note: "Total with orders" can exceed total active customers (one customer = multiple purchase events)

**"Số lượng cửa hiệu thực phẩm >300K" section** (SectionHeader, collapsed by default):
- Table of stores with total purchase value > 300,000 VND
- Graceful empty state if no qualifying customers

### Claude's Discretion
- Exact KPI card color shades (use nhap-hang color palette as reference)
- Icon badge implementation for customer types (colored dot or lucide-react icon)
- Chart colors (use CHART_COLORS constant from existing dashboard/nhap-hang pages)
- Empty state copy for low-data sections

</decisions>

<specifics>
## Specific Ideas

- Both implementing agents MUST read `samples/3_ton_kho.jpg` and `samples/4_khach_hang.jpg` before writing any UI code. The layout, chart arrangement, KPI placement, and section structure are strictly defined by these images.
- "Khách hàng đang mua hàng" KPI count (588 in reference) intentionally exceeds total active customers (455) — this reflects order occurrences, not unique customers. Seed data should reflect this pattern.
- The date picker for inventory snapshots defaults to today. When user changes date, the full page refetches with the new snapshot_date param.
- Customer type icon badges in the breakdown table: each type has a distinct colored icon/badge (matching reference image style).
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference images (MANDATORY — read before any UI implementation)
- `samples/3_ton_kho.jpg` — Ton-kho page visual reference: filter bar layout, KPI card placement, 2×3 chart grid, DataTable columns and export buttons
- `samples/4_khach_hang.jpg` — Khach-hang page visual reference: chart sections, KPI tile layout, breakdown table structure, section headers with collapse toggles

### Product catalog
- `samples/Danh_muc_san_pham_FULL.xlsx` — 62 veterinary medicine products. Columns: STT, Nhóm (product_group), TÊN SP (product_name), Phân loại (classification/brand), Dạng sản phẩm, Quy cách (packaging), Nhà sản xuất (manufacturer). 4 product groups, 10 brand classifications.

### Design specification
- `docs/2026-03-18-admin-dashboard-design.md` §7.4 — Ton-kho page full spec (API shape, filter bar, KPI cards, chart layout, DataTable columns)
- `docs/2026-03-18-admin-dashboard-design.md` §7.5 — Khach-hang page full spec (API shape, chart sections, KPI tiles, breakdown tables, section behavior)
- `docs/2026-03-18-admin-dashboard-design.md` §6 — Export toolbar spec (Copy + Excel for both pages)

### Existing reusable code
- `components/admin/DataTable.tsx` — KEEP, do not rewrite. Use `exportConfig={{ copy: true, excel: true }}`.
- `lib/admin/services/nhap-hang.ts` — Reference for service layer pattern (Supabase query style, filter handling, pagination)
- `app/admin/nhap-hang/NhapHangClient.tsx` — Reference for Recharts chart style, CHART_COLORS constant, filter bar wiring
- `supabase/migrations/20260319_007_add_purchase_tables.sql` — Existing `products` table schema (compatible with Excel catalog)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/admin/DataTable.tsx` — Do not rewrite. Accepts `columns`, `data`, `exportConfig`, `pagination`, `onSearch` props.
- `components/admin/KpiCard.tsx` — Colored KPI card with large number + label + optional icon. Use for both pages' KPI tiles.
- `components/admin/SectionHeader.tsx` — Teal collapsible section header with chevron toggle. Use for khach-hang's 3 collapsible sections.
- `components/admin/FilterBar.tsx` — Controlled filter row. Adapt for ton-kho (NPP + date + nhom) and khach-hang (NPP) filter bars.
- `lib/admin/auth.ts` — `requireAdmin()` for all API routes.

### Established Patterns
- Service layer: async function, Supabase query, returns typed object. See `lib/admin/services/nhap-hang.ts`.
- SSR page: `async function Page()` + `requireAdmin()` + passes data to `'use client'` Client component.
- API route: `GET` handler, `requireAdmin()`, parse params, call service, `NextResponse.json()`.
- Charts: `'use client'`, import Recharts, use `CHART_COLORS` constant for consistent palette across all admin pages.

### Integration Points
- `components/admin/AdminSidebar.tsx` — update href: `knowledge-base` → `ton-kho`, `users` → `khach-hang`
- New migration: `supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql`
- New seed section in `scripts/seed.ts` for inventory_snapshots + customers + customer_purchases

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-ton-kho-khach-hang*
*Context gathered: 2026-03-20*
