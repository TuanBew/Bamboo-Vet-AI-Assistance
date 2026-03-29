# Phase 8: Dashboard Sales Rebuild — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Completely rebuild `/admin/dashboard` to be a **sales/distribution management** dashboard matching the reference image (`samples/1_dashboard.jpg`). The current dashboard queries chatbot analytics tables (wrong domain) — this phase replaces it entirely with data from the sales tables (`purchase_orders`, `purchase_order_items`, `customer_purchases`, `products`, `customers`, `distributor_staff`, `suppliers`).

Also remove or repurpose wrong-domain pages:
- `check-users` (chatbot user analytics) → remove or redirect
- `check-clinics` (chatbot clinic analytics) → remove or redirect

Update PROJECT.md, REQUIREMENTS.md, and ROADMAP.md to reflect the correct domain: **sales & distribution management**, not chatbot analytics.

</domain>

<decisions>
## Implementation Decisions

### Domain Correction
- The admin SaaS is a **sales/distribution management system** for a Vietnamese veterinary product NPP (Nhà Phân Phối)
- ALL chatbot analytics metrics (total_queries, sessions, drug_groups, animal_types, clinics) must be **removed from the dashboard**
- Product B (admin) is NOT for chatbot analytics — it tracks nhập hàng, bán hàng, nhân viên, khách hàng in the sales context
- chatbot analytics (Product A) remains unchanged at `/`, `/app`, `/chat`

### Filter Bar (Top of Dashboard)
Match reference exactly:
- **NPP dropdown** — list from `suppliers.supplier_code + supplier_name` (10 NPPs); default = "Tất cả NPP"
- **Month picker** — calendar month selector (e.g., "Tháng Ba 2026"); default = current month
- **Ngành hàng dropdown** — from `products.product_group` distinct values; default = "Tất cả ngành hàng"
- **Thương hiệu dropdown** — from `products.manufacturer` distinct values; default = "Tất cả thương hiệu"
- **Kênh dropdown** — customer channel grouping; options: "Tất cả kênh" / "Kênh lẻ" (TH, GSO, PHA, SPS) / "Kênh sỉ" (WMO, PLT, BTS, OTHER); default = "Kênh lẻ"
- **Search button** — triggers refetch (same pattern as nhap-hang page)
- All filters are applied server-side when fetching data

### Section 1 — AI Phân Tích Panel
- **Omit entirely.** Do not implement the AI phân tích panel.

### Section 2 — Tổng Quan
Two charts side by side:
1. **"Nhập xuất theo năm"** — grouped bar chart
   - X-axis: years (2022–2026)
   - Two bars per year: Bán hàng (customer_purchases.total_value sum) + Nhập hàng (purchase_orders.total_amount sum)
   - 2022–2023 will show zero bars (seed data starts 2024) — this is acceptable
2. **"Nhập xuất theo tháng và Forecast"** — area/line composed chart
   - X-axis: months (Jan 2024 → current + 3 forecast months)
   - Two series: Bán hàng + Nhập hàng
   - Forecast months use dotted line (`strokeDasharray="4 4"`, `is_forecast: true`) — same linear regression as current `lib/admin/forecast.ts` but applied to sales data instead of query volume
   - Bridge point: last real data month also shown in forecast series for continuity

### Section 3 — Chỉ Số Tập Trung (Selected Month)
Header: "Chỉ số tập trung tháng MM-YYYY"

**Left column — Doanh số tháng chart:**
- Line chart: daily bán hàng (customer_purchases total_value by day for selected month)
- Two series: Bán hàng (solid) + Nhập hàng (dashed)

**Right column — Chỉ số đo lường metrics box:**
5 metrics with progress-bar style:
1. **Nhập hàng** — sum of purchase_orders.total_amount for selected NPP + month
2. **Bán hàng** — sum of customer_purchases.total_value for selected filters
3. **Khách hàng** — active_count / total_count (customers with purchases / all customers for NPP)
4. **SKU/Tổng SKU** — distinct products sold / total product catalog count
5. **Nhân viên** — distributor_staff count for selected NPP

**Pie charts row (6 charts, 3+3):**
- "Tỉ trọng nhập hàng tháng MM-YYYY": 3 donuts by Ngành hàng | Nhóm | Thương hiệu (from purchase_order_items → products)
- "Tỉ trọng bán hàng tháng MM-YYYY": 3 donuts by Ngành hàng | Nhóm | Thương hiệu (from customer_purchases → products)

**KPI summary row (4 big numbers):**
1. TỔNG NHẬP HÀNG (VND, with YoY delta badge)
2. TỔNG BÁN HÀNG (VND, with YoY delta badge)
3. SL BÁN / KM — quantity sold / promo quantity (customer_purchases.qty sum / purchase_order_items.promo_qty sum)
4. TRUNG BÌNH / ĐƠN — avg sale value per transaction (total_value / transaction_count)

### Section 4 — Nhân Viên (Selected Month)
Header: "Nhân viên tháng MM-YYYY"

**Staff performance table:**
Columns: Tên nhân viên | Doanh số theo ngày (sparkline) | TOTAL (VND) | Đơn hàng | Trung bình | Khách hàng | Ngày >1tr
- Data source: `customer_purchases` joined via `staff_id` → `distributor_staff`
- ⚠️ **Data gap**: Requires Migration 011 to add `staff_id` (nullable FK) to `customer_purchases`
- Filtered by selected NPP (supplier_id match in distributor_staff)

**Two stacked horizontal bar charts below the table:**
1. "Tỉ trọng theo nhóm tháng MM-YYYY" — per staff, breakdown by product_group
2. "Tỉ trọng theo thương hiệu tháng MM-YYYY" — per staff, breakdown by manufacturer
- Each staff = one horizontal bar, stacked segments by category/brand

### Section 5 — Khách Hàng (Selected Month)
Header: "Khách hàng tháng MM-YYYY"

**Left panel — charts:**
1. Radar chart: "Doanh số theo loại cửa hiệu" — Bán hàng VND by customer_type (8 types as radar axes)
2. Pie/bar chart: "Số lượng theo loại cửa hiệu" — count of customers per customer_type

**Right panel — Geographic map:**
- Leaflet map with customer pins (customers.latitude, customers.longitude)
- Color-coded by customer_type (same pin color coding as check-customers page)
- Click popup shows customer_name + total purchases for the month

### Section 6 — Top 10 (Selected Month)
Header: "Top 10 tháng MM-YYYY"

**Two horizontal bar charts side by side:**
1. "Top 10 Khách hàng" — top customers by customer_purchases.total_value sum for the month
2. "Top 10 Sản phẩm" — top products by customer_purchases.total_value sum for the month

### Data Migration Required
**Migration 011** — Add `staff_id` to `customer_purchases`:
```sql
ALTER TABLE customer_purchases
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES distributor_staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cp_staff ON customer_purchases (staff_id);
```
Then update seed script to assign staff_id based on supplier relationship:
- Each customer is linked to an NPP (via `customers.supplier_id`)
- Each NPP has 3 staff in `distributor_staff`
- Assign customer_purchases to staff deterministically (rotating assignment per customer_id hash)

### Pages to Remove / Repurpose
- **`/admin/check-users`**: Chatbot user analytics page — REMOVE. Delete all files in `app/admin/check-users/`, `app/api/admin/check-users/`, `app/api/admin/users/`. Update AdminSidebar to remove the link.
- **`/admin/check-clinics`**: Chatbot clinic analytics page — REMOVE. Delete all files in `app/admin/check-clinics/`, `app/api/admin/check-clinics/`. Update AdminSidebar to remove the link.
- Future phases will add Check Route and Check Display pages (reference sidebar) as separate phases.

### Claude's Discretion
- Exact color palette for pie charts (reuse existing CHART_COLORS array)
- Sparkline implementation in staff table (SparklineChart component already exists)
- Radar chart axis label truncation for long customer_type names
- AI phân tích panel collapse animation
- Exact progress-bar visual in "Chỉ số đo lường" box

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Design
- `samples/1_dashboard.jpg` — Reference screenshot of the complete dashboard layout (all 6 sections visible)

### Existing Sales Service Patterns (to follow)
- `app/admin/nhap-hang/NhapHangClient.tsx` — Sales page client, data shape, filter patterns
- `lib/admin/services/nhap-hang.ts` — Service layer pattern for purchase_orders queries
- `app/admin/khach-hang/KhachHangClient.tsx` — Customer section with radar + map patterns

### Data Schema
- `supabase/migrations/20260319_007_add_purchase_tables.sql` — suppliers, products, purchase_orders, purchase_order_items
- `supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql` — inventory_snapshots, customers, customer_purchases
- `supabase/migrations/20260320_009_add_check_customers_distributor_tables.sql` — distributor_staff, display_programs

### Existing Components (reuse these)
- `components/admin/MapView.tsx` — Leaflet map with pins, reuse for customer section
- `components/admin/SparklineChart.tsx` — Mini sparkline for staff table
- `components/admin/KpiCard.tsx` — KPI cards for summary row
- `components/admin/FilterBar.tsx` — FilterBar component (extend with NPP + kênh dropdowns)
- `lib/admin/forecast.ts` — Linear regression forecast (reuse for nhập/bán hàng forecast)

### Files to Remove (check-users + check-clinics)
- `app/admin/check-users/` — entire directory, delete
- `app/admin/check-clinics/` — entire directory, delete
- `app/api/admin/check-users/` — entire directory, delete
- `app/api/admin/check-clinics/` — entire directory, delete
- `app/api/admin/users/` — entire directory, delete (user conversation history APIs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/admin/forecast.ts`: Linear regression already implemented — reuse with nhập/bán hàng monthly series instead of query volume
- `SparklineChart`: 12-month sparkline already used in dashboard staff section — reuse for daily sales per staff
- `MapView` + `LeafletMapInner`: Already works with pins array — reuse for customer geographic section
- `DashboardSkeleton`: Skeleton component already exists — just update sections count

### Established Patterns
- SSR + Suspense: `DashboardLoader` → `DashboardClient` pattern with `<Suspense fallback={<DashboardSkeleton />}>` — keep this pattern
- Filter changes: `router.push` for URL state + `fetch /api/admin/dashboard?...` for client refetch — keep
- Service layer: `getDashboardData(filters)` callable from both SSR and API route — keep pattern
- Dark theme: All colors use `gray-800/900` background, `gray-400` text, teal accents

### Integration Points
- `AdminSidebar.tsx`: Must remove Check Users + Check Clinics links; existing links for Check Customers + Check Distributor stay
- `FilterBar.tsx`: Add `npp` and `kenh` props alongside existing `province`/`clinic_type` (or replace them entirely for dashboard page)
- `app/api/admin/dashboard/route.ts`: Completely replace query logic — stop querying `mv_dashboard_kpis`, start querying purchase/sales tables
- Migration 011: New migration file needed for `staff_id` FK on `customer_purchases`

### Problematic Code to Delete
- `lib/admin/services/dashboard.ts`: Entire file — completely wrong domain queries (mv_dashboard_kpis, mv_monthly_queries, mv_category_stats, etc.)
- `app/admin/dashboard/DashboardClient.tsx`: Remove sections 2-4 (Chỉ số tập trung, Người dùng/chatbot, Phòng khám/clinics); keep section structure but replace ALL data types

</code_context>

<specifics>
## Specific Ideas

- Reference image shows "NPP Kiên Phúc" as the selected NPP — our seed data uses "Công ty TNHH Phân phối Thú y Miền Bắc" etc., which is fine
- The AI phân tích panel in the reference shows bullet-point comparisons with exact numbers and % — format: "So sánh doanh số năm 2025 (X VNĐ) và 2024 (Y VNĐ): Doanh số năm 2025 giảm/tăng Z% so với năm 2024."
- "Chỉ số đo lường" box has colored progress bars next to each KPI — green for good metrics
- Staff sparklines in the "Nhân viên" table show daily revenue (not query count)
- "Ngày >1tr" column = count of days in the month where that staff's sales exceeded 1,000,000 VND
- The stacked bar charts for staff use SAME staff colors throughout the chart (each staff = one color across both charts)

</specifics>

<deferred>
## Deferred Ideas

- **Check Route page** — New page showing sales staff geographic routes (not in current roadmap, reference sidebar shows it as "Check Route" in CHECKED section). Add to Phase 9.
- **Check Display page** — New page for "Tình hình trưng bày" (display program tracking, display_programs table exists). Add to Phase 9.
- **Real-time refresh** — WebSocket-based live data updates. v2 backlog.
- **Export to PDF/Excel** — Dashboard full-page export. Not in scope.

</deferred>

---

*Phase: 08-dashboard-sales-rebuild*
*Context gathered: 2026-03-29*
