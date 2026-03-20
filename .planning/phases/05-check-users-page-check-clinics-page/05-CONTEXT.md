# Phase 5: Check Customers page + Check Distributor page - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning (scope corrected from check-users/check-clinics to check-customers/check-distributor)

<domain>
## Phase Boundary

Two data-explorer pages become fully operational:

- `/admin/check-customers` — Full-width Leaflet map (pins per customer lat/lng) + paginated "Danh sách khách hàng" DataTable (all five export formats) + "Doanh số" brand × month pivot table + "Tình hình trưng bày" section. Data from `customers` and `customer_purchases` tables.
- `/admin/check-distributor` — Color-coded monthly distributor pivot table (rows = distributors/NPPs, columns = Tháng 1–12) with multi-filter bar + daily detail modal (dark-themed, staff rows × day columns). Data from `purchase_orders` and `suppliers` tables.

Three component stubs from earlier phases (`UserHistoryDrawer`, `ClinicDetailModal`, `ColorPivotTable`) are re-purposed/completed here. Two service files and API routes are created new.

**Scope correction:** Original Phase 5 context referenced check-users and check-clinics (chatbot analytics). User confirmed these are actually check-customers (business customers/stores) and check-distributor (NPP sales performance).

</domain>

<decisions>
## Implementation Decisions

### Check Customers — Page Layout

Page sections in order (top to bottom) — strictly match `samples/5_customer.jpg`:
1. **Filter bar** — NPP/Distributor selector | Search button (above the map)
2. **Map section** — `SectionHeader` with title "Vị trí khách hàng tháng". ~350px height. Uses `MapView` component. Each customer with lat/lng shows as a clickable pin. Popup: store name + store type.
3. **"Danh sách khách hàng" DataTable section** — `SectionHeader` "Danh sách khách hàng". Toolbar: Show N rows | Copy | Excel | CSV | PDF | Print | Search. All 5 export formats enabled.
   - Columns: Mã | Tên KH | Địa chỉ | Đường | Phường/Xã | Quận/Huyện | Tỉnh | Loại cửa hiệu | Ảnh cửa hiệu | Ngày tạo | Định vị | Check Location
   - "Check Location" column: link/button that pans/recenters the Leaflet map to that customer's pin
   - Pagination with page numbers (e.g. "Showing 1 to 10 of 455 entries" + page number buttons)
4. **"Doanh số" pivot section** — `SectionHeader` "Doanh số" with yellow/gold header color (match sample). Pivot table: rows = brands/products, columns = months (2024-01 → current). Cell value = purchase value for that brand that month. Toolbar: Show N rows | Copy | Excel | CSV | PDF | Print | Search. Pagination.
5. **"Tình hình trưng bày" section** — `SectionHeader` "Tình hình trưng bày" (green header, match sample). Table: Chương trình | Nhân viên | Thời gian | Ảnh đăng ký | Ảnh thực hiện. Empty state shown if no data.

### Check Customers — API Shape

`GET /api/admin/check-customers?distributor_id=&search=&page=&page_size=`

Response:
```typescript
{
  map_pins: Array<{
    customer_id: string;
    customer_name: string;
    customer_type: string;  // store type code e.g. BACH_HOA, NHA_THUOC, ME_BE
    latitude: number;
    longitude: number;
  }>;
  customers: {
    data: Array<{
      customer_id: string;
      customer_code: string;     // Mã KH
      customer_name: string;     // Tên KH
      address: string;           // Địa chỉ
      street: string;            // Đường
      ward: string;              // Phường/Xã
      district: string;          // Quận/Huyện
      province: string;          // Tỉnh
      customer_type: string;     // Loại cửa hiệu (display label)
      image_url: string | null;  // Ảnh cửa hiệu
      created_at: string;        // Ngày tạo
      is_geo_located: boolean;   // Định vị
      latitude: number | null;
      longitude: number | null;
    }>;
    total: number;
    page: number;
    page_size: number;
  };
  revenue_pivot: Array<{
    brand: string;                          // brand/product name (row)
    months: Record<string, number>;         // key: "2025-01" → value: purchase amount
  }>;
  display_programs: Array<{
    program_name: string;   // Chương trình
    staff_name: string;     // Nhân viên
    time_period: string;    // Thời gian
    registration_image_url: string | null;  // Ảnh đăng ký
    execution_image_url: string | null;     // Ảnh thực hiện
  }>;
}
```

### Check Distributor — Page Layout

Strictly match `samples/6_check_distributor.jpg`:
1. **Filter bar** — Year selector | Metric dropdown (Doanh số / Doanh số lẻ) | All Systemtype | All Shipfrom | All Category | All Brands dropdowns | Search button
2. **"Doanh số năm [year]" pivot table** — `SectionHeader` with teal header.
   - Toolbar: Show N rows | Copy | Excel | CSV | PDF | Print | Column Visibility | Search (Tìm kiếm)
   - Columns: Miền | Vùng | Tỉnh | Mã NPP | Tên NPP | Tháng 1 | Tháng 2 | ... | Tháng 12
   - Color thresholds (client-side on cell value):
     - High (≥ 100,000,000 VND) → `bg-green-500 text-white`
     - Medium (10,000,000–99,999,999 VND) → `bg-yellow-400 text-black`
     - Low (1–9,999,999 VND) → `bg-red-500 text-white`
     - Zero/empty → no color, grey text
   - Pagination: "Trước" / "Tiếp theo" buttons + page numbers
   - Clicking any row opens the daily detail modal

### Check Distributor — Daily Detail Modal

Strictly match `samples/6_check_distributor_2.jpg`:
- Dark background modal (`bg-gray-900`, `max-w-6xl`, white/light text)
- Title: `"Chi tiết theo nhân viên"` (modal heading)
- Subtitle: `"Dữ liệu [Distributor Name] Tháng [MM] Năm [YYYY]"`
- Table structure: Rows = staff (Mã NV | Tên NV), Columns = Ngày 1 | Ngày 2 | ... | Ngày 16 (scrollable to 31)
- Each day cell (two stacked values):
  - **Top row:** Revenue value (colored: green/yellow/red by same thresholds as main pivot)
  - **Bottom row:** `"KH N"` = customer count for that day (also color-coded)
  - Zero activity → `"0"` on top and `"KH 0"` on bottom, no background color
- Close button at bottom-right
- Triggered by clicking any row in main pivot table
- Calls `GET /api/admin/check-distributor/[id]/detail?month=M&year=Y`

### Check Distributor — API Shapes

`GET /api/admin/check-distributor?year=&metric=&system_type=&ship_from=&category=&brand=&search=&page=&page_size=`
```typescript
{
  distributors: {
    data: Array<{
      distributor_id: string;
      region: string;         // Miền
      zone: string;           // Vùng
      province: string;       // Tỉnh
      distributor_code: string;  // Mã NPP
      distributor_name: string;  // Tên NPP
      monthly_data: Record<string, number>;  // key: "1"–"12" → revenue or order count by metric
    }>;
    total: number;
    page: number;
    page_size: number;
  };
  filter_options: {
    system_types: string[];
    ship_froms: string[];
    categories: string[];
    brands: string[];
  };
}
```

`GET /api/admin/check-distributor/[id]/detail?month=&year=`
```typescript
{
  distributor_name: string;
  distributor_id: string;
  year: number;
  month: number;
  staff: Array<{
    staff_id: string;       // Mã NV
    staff_name: string;     // Tên NV
    daily_data: Array<{
      day: number;          // 1–31
      revenue: number;
      customer_count: number;  // KH N
    }>;
  }>;
}
```

### Claude's Discretion
- Exact color threshold values for green/yellow/red (use VND ranges: ≥100M green, 10M–99M yellow, 1–9.9M red, 0 grey)
- "Ảnh cửa hiệu" column renders as a small thumbnail (32×32px) or placeholder icon if null
- "Định vị" column: green "Đã định vị" badge or grey "Chưa định vị" based on is_geo_located
- Column Visibility toggle behavior on the distributor pivot (show/hide month columns)
- Sticky behavior for Miền/Vùng/Tỉnh/Mã NPP/Tên NPP columns in distributor pivot (horizontally sticky)

</decisions>

<specifics>
## Specific Ideas

- `samples/5_customer.jpg` shows the map at top with teal `SectionHeader` "Vị trí khách hàng tháng", then the customer table with gold/amber header "Doanh sách khách hàng", then gold "Doanh số" pivot, then green "Tình hình trưng bày" at bottom.
- The "Doanh số" pivot in `samples/5_customer.jpg` shows Brand rows (BEE, BELLA, BIS UP, DORCO, HANA, KAIA, LITTLE PRINCESS, LUXURY, MARIS, MERMAID) vs month columns — this is brand-level aggregation from customer_purchases.
- `samples/6_check_distributor.jpg` shows 13 distributor rows for "Miền Nam" — the data comes from supplier/purchase_order data.
- `samples/6_check_distributor_2.jpg` shows revenue values formatted (1,723,000 VND) and KH counts (KH 5, KH 4, KH 3) — both should format numbers with comma separators.
- The "Check Location" link in the customer table should call a ref callback on the Leaflet map to pan/fly to the customer's coordinates, not navigate away from the page.
- "Tình hình trưng bày" is likely seeded static data (no real display program tracking exists in the DB schema) — seed with a few realistic rows.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference images (MANDATORY — read before any UI implementation)
- `samples/5_customer.jpg` — Check Customers full page reference: NPP filter, map section, customer table with all 5 export buttons, brand×month pivot, display programs section
- `samples/6_check_distributor.jpg` — Check Distributor main page: multi-dropdown filter bar, color-coded distributor pivot table, toolbar with Column Visibility, pagination
- `samples/6_check_distributor_2.jpg` — Distributor daily detail modal: dark background, staff × day grid, stacked revenue + KH count per cell, Close button

### Design specification
- `docs/2026-03-18-admin-dashboard-design.md` §3.1 — Database tables: `customers`, `customer_purchases`, `purchase_orders`, `suppliers`, `products` schemas
- `docs/2026-03-18-admin-dashboard-design.md` §4.3 — `requireAdmin()` utility pattern
- `docs/2026-03-18-admin-dashboard-design.md` §6 — Export toolbar spec
- `docs/2026-03-18-admin-dashboard-design.md` §8 — Shared admin component inventory

### Established patterns
- `app/admin/nhap-hang/NhapHangClient.tsx` — chart + table + filter wiring pattern
- `lib/admin/services/nhap-hang.ts` — service layer pattern
- `app/api/admin/nhap-hang/route.ts` — API route pattern
- `components/admin/DataTable.tsx` — generic table with exportConfig prop
- `components/admin/MapView.tsx` + `components/admin/LeafletMapInner.tsx` — Leaflet wrapper (SSR-safe)
- `components/admin/SectionHeader.tsx` — collapsible section header

</canonical_refs>

<code_context>
## Existing Code Insights

### New Files to Create
- `lib/admin/services/check-customers.ts` — service for customer map pins + paginated table + revenue pivot + display programs
- `lib/admin/services/check-distributor.ts` — service for distributor monthly pivot + filter options + detail endpoint
- `app/api/admin/check-customers/route.ts` — GET handler with requireAdmin()
- `app/api/admin/check-distributor/route.ts` — GET handler with requireAdmin()
- `app/api/admin/check-distributor/[id]/detail/route.ts` — GET handler for daily staff detail
- `app/admin/check-customers/CheckCustomersClient.tsx` — 'use client' component
- `app/admin/check-distributor/CheckDistributorClient.tsx` — 'use client' component
- `components/admin/DistributorDetailModal.tsx` — dark modal for daily detail (new, based on ClinicDetailModal stub)

### Database Tables Available
- `customers` — business customers with lat/lng, customer_type, address fields
- `customer_purchases` — purchase records linking customers to products/brands
- `purchase_orders` — order headers with supplier_id and date
- `suppliers` — NPP/distributor rows (5 rows: NPP001–NPP005 with region/zone/province info)
- `products` — product catalog with manufacturer (brand) and product_group

### Seed Data Needed
- `display_programs` table OR seeded static data for "Tình hình trưng bày" section
- Distributor staff data (for the daily detail modal to show per-staff breakdown) — seed as mock NV rows attached to supplier

### Reusable Assets (use as-is)
- `components/admin/MapView.tsx` — Leaflet SSR-safe wrapper
- `components/admin/DataTable.tsx` — with exportConfig prop
- `components/admin/SectionHeader.tsx` — collapsible with collapse toggle
- `components/admin/FilterBar.tsx` — for filter rows
- `lib/admin/auth.ts` — requireAdmin()

### Sidebar Integration
- Update `components/admin/AdminSidebar.tsx` to add "Check Customers" and "Check Distributor" nav items under CHECKED section (replacing or adding to existing check-users/check-clinics links)

</code_context>

<deferred>
## Deferred Ideas

- Real-time display program tracking (actual photo uploads for "Tình hình trưng bày")
- Advanced filter combinations (Systemtype/Shipfrom/Category are filter placeholders — show all for now if no backing data)
- Staff management UI for distributor

</deferred>

---

*Phase: 05-check-users-page-check-clinics-page*
*Context updated: 2026-03-20 — scope corrected to check-customers + check-distributor*
