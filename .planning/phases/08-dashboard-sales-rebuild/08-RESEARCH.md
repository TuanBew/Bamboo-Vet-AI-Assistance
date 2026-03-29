# Phase 8: Dashboard Sales Rebuild — Research

**Researched:** 2026-03-29
**Domain:** Next.js admin dashboard — sales/distribution management (Recharts, Supabase JS, React-Leaflet)
**Confidence:** HIGH — all findings verified against existing codebase and established project patterns

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Domain Correction**
- The admin SaaS is a **sales/distribution management system** for a Vietnamese veterinary product NPP (Nhà Phân Phối)
- ALL chatbot analytics metrics (total_queries, sessions, drug_groups, animal_types, clinics) must be **removed from the dashboard**
- Product B (admin) is NOT for chatbot analytics — it tracks nhập hàng, bán hàng, nhân viên, khách hàng in the sales context
- chatbot analytics (Product A) remains unchanged at `/`, `/app`, `/chat`

**Filter Bar** — Match reference exactly:
- NPP dropdown from `suppliers.supplier_code + supplier_name`; default = "Tất cả NPP"
- Month picker (calendar month selector); default = current month
- Ngành hàng dropdown from `products.product_group` distinct values; default = "Tất cả ngành hàng"
- Thương hiệu dropdown from `products.manufacturer` distinct values; default = "Tất cả thương hiệu"
- Kênh dropdown: "Tất cả kênh" / "Kênh lẻ" (TH, GSO, PHA, SPS) / "Kênh sỉ" (WMO, PLT, BTS, OTHER); default = "Kênh lẻ"
- Search button triggers refetch (same pattern as nhap-hang page)
- All filters applied server-side

**Section 1 — AI Phân Tích Panel**: Omit entirely.

**Section 2 — Tổng Quan**: Two charts side by side — "Nhập xuất theo năm" (grouped bar, years 2022–2026, Bán hàng + Nhập hàng) + "Nhập xuất theo tháng và Forecast" (area/line composed chart, Jan 2024 → current + 3 forecast months, dotted forecast with bridge point).

**Section 3 — Chỉ Số Tập Trung**: Daily doanh số line chart (Bán + Nhập two series) + 5-metric progress box + 6 donut pie charts (3 nhập + 3 bán: ngành/nhóm/thương hiệu) + 4 KPI big numbers (Tổng nhập, Tổng bán, SL/KM, TB/đơn).

**Section 4 — Nhân Viên**: Staff performance table (name, sparkline, TOTAL, orders, avg, customers, ngày>1tr) via staff_id FK + two stacked horizontal bar charts (tỉ trọng by nhóm + by thương hiệu per staff). Requires Migration 011.

**Section 5 — Khách Hàng**: Radar chart (by customer_type) + count chart + Leaflet map with customer pins (color by customer_type, popup shows name + monthly total).

**Section 6 — Top 10**: Top 10 Khách hàng + Top 10 Sản phẩm horizontal bar charts.

**Data Migration Required**: Migration 011 adds `staff_id` (nullable UUID FK → `distributor_staff.id`) to `customer_purchases` + index `idx_cp_staff`. Seed script updated to assign staff_id deterministically via hash.

**Pages to Remove**:
- `app/admin/check-users/` — delete
- `app/admin/check-clinics/` — delete
- `app/api/admin/check-users/` — delete
- `app/api/admin/check-clinics/` — delete
- `app/api/admin/users/` — delete
- AdminSidebar: remove check-users + check-clinics links, remove imports (MessageSquare, Hospital icons)

**Problematic code to delete**:
- `lib/admin/services/dashboard.ts` — entire file rewritten (was querying mv_dashboard_kpis, mv_monthly_queries, etc.)
- `app/admin/dashboard/DashboardClient.tsx` — completely replaced (all sections replaced)

### Claude's Discretion
- Exact color palette for pie charts (reuse existing CHART_COLORS array)
- Sparkline implementation in staff table (SparklineChart component already exists)
- Radar chart axis label truncation for long customer_type names
- Exact progress-bar visual in "Chỉ số đo lường" box

### Deferred Ideas (OUT OF SCOPE)
- Check Route page — Phase 9
- Check Display page — Phase 9
- Real-time refresh — v2 backlog
- Export to PDF/Excel — Not in scope for this phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH2-01 | Migration 011 adds `staff_id` FK to `customer_purchases`; check-users and check-clinics routes/API deleted; AdminSidebar links updated | Migration pattern from existing migrations 007-010; sidebar edit documented below |
| DASH2-02 | `lib/admin/services/dashboard.ts` completely rewritten to query purchase/sales tables; returns all dashboard data shapes | Service layer pattern from `nhap-hang.ts`; all source tables documented |
| DASH2-03 | Filter bar: NPP + month + ngành hàng + thương hiệu + kênh; Search button triggers refetch | NhapHangClient filter pattern; FilterBar extension documented |
| DASH2-05 | "Tổng Quan" section: grouped bar (Nhập/Bán by year) + composed area chart (monthly with 3-month forecast) | Recharts ComposedChart + forecast.ts reuse pattern documented |
| DASH2-06 | "Chỉ Số Tập Trung" section: daily line chart + metrics box + 6 pie charts + 4 KPI row | DashboardClient existing pattern; data shape documented |
| DASH2-07 | "Nhân Viên" + "Khách Hàng" + "Top 10" sections: staff table with sparklines, stacked bars, radar, map, top-10 bars | SparklineChart, MapView, RadarChart patterns all available in codebase |
</phase_requirements>

---

## Summary

Phase 8 is a **complete domain swap** of the `/admin/dashboard` page. The existing dashboard is fully built but queries the wrong tables — it was built for chatbot analytics (mv_dashboard_kpis, mv_monthly_queries) and must be entirely replaced with sales/distribution data from `purchase_orders`, `customer_purchases`, `distributor_staff`, `products`, `customers`, and `suppliers`.

The key insight is that almost all required UI components already exist in the codebase from phases 3-5: `SparklineChart`, `MapView`, `KpiCard`, `SectionHeader`, `FilterBar`, `RadarChart` (from NhapHangClient), `ComposedChart` (in DashboardClient itself). The work is primarily data reshaping — writing a new service layer and new DashboardClient that wires real sales data into these components.

The one structural prerequisite is **Migration 011** (adding `staff_id` to `customer_purchases`), which enables the Nhân Viên section. Without it the staff table cannot show per-staff sales, so it must come first. The page deletion (check-users, check-clinics) is a clean file removal with no dependencies.

**Primary recommendation:** Execute in 4 waves — (1) Migration 011 + file deletions + sidebar cleanup, (2) new service layer + API route rewrite, (3) DashboardClient full replacement with all 5 sections, (4) seed script update for staff_id assignment.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | Already installed | All charts (BarChart, ComposedChart, LineChart, RadarChart, PieChart) | Project standard, all existing pages use it |
| react-leaflet | Already installed | Customer map with pins | Already used in MapView component |
| @supabase/supabase-js | Already installed | All DB queries via service client | Project standard |
| next (App Router) | Already installed | SSR + Suspense streaming | Established pattern in DashboardLoader/page.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lib/admin/forecast.ts` | Internal | Linear regression forecast | Reuse for nhập/bán monthly series instead of query volume |
| `components/admin/SparklineChart.tsx` | Internal | Mini line chart in table cells | Staff daily sales sparkline |
| `components/admin/MapView.tsx` | Internal | Leaflet map with pins | Customer geographic section |
| `components/admin/KpiCard.tsx` | Internal | Colored KPI tiles | KPI summary row |
| `components/admin/SectionHeader.tsx` | Internal | Teal collapsible section headers | All 5 sections |
| `lib/i18n/vietnamese.ts` | Internal | VI dictionary | All new string keys for dashboard labels |

**No new npm packages required.** All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

No new files in new directories. All work is replacements/deletions within existing structure:

```
app/
├── admin/
│   ├── dashboard/
│   │   ├── page.tsx              # UPDATE: new searchParams (npp, month, nganhHang, thuongHieu, kenh)
│   │   ├── DashboardLoader.tsx   # UPDATE: pass new DashboardFilters shape
│   │   ├── DashboardClient.tsx   # FULL REWRITE: all 5 sections
│   │   └── DashboardSkeleton.tsx # UPDATE: match new section count/layout
│   ├── check-users/              # DELETE entire directory
│   └── check-clinics/            # DELETE entire directory
│
├── api/admin/
│   ├── dashboard/route.ts        # UPDATE: new filter params, call new getDashboardData
│   ├── check-users/              # DELETE entire directory
│   ├── check-clinics/            # DELETE entire directory
│   └── users/                   # DELETE entire directory
│
components/admin/
│   └── AdminSidebar.tsx          # UPDATE: remove check-users/check-clinics, remove MessageSquare+Hospital imports
│
lib/
├── admin/
│   ├── services/
│   │   └── dashboard.ts          # FULL REWRITE: new types + new query logic
│   └── forecast.ts               # NO CHANGE: reuse with new data shape (adapt MonthlyDataPoint)
├── i18n/
│   └── vietnamese.ts             # UPDATE: add new dashboard keys, remove old ones
│
supabase/migrations/
│   └── 20260329_011_add_staff_id_to_customer_purchases.sql  # NEW
│
scripts/
│   └── seed-sales.ts             # UPDATE: add staff_id assignment pass
```

### Pattern 1: New DashboardFilters Shape

The existing `DashboardFilters` uses `{ month, province, clinic_type }`. Replace entirely with:

```typescript
// lib/admin/services/dashboard.ts (new)
export interface DashboardFilters {
  npp: string           // supplier_id or '' for all
  month: string         // "2026-03" format (year-month)
  nganhHang: string     // product_group value or '' for all
  thuongHieu: string    // manufacturer value or '' for all
  kenh: string          // '' | 'le' | 'si'
}
```

Kênh filter maps customer_type codes:
- `kenh === 'le'` → customer_type IN ('TH','GSO','PHA','SPS')
- `kenh === 'si'` → customer_type IN ('WMO','PLT','BTS','OTHER')
- `kenh === ''` → no filter

### Pattern 2: Service Layer Data Shape

The new `getDashboardData()` must return all sections in one call. Modeled on the existing nhap-hang service pattern (JS-side aggregation, no raw SQL). Data shape:

```typescript
export interface DashboardData {
  // Dropdown population
  npp_list: Array<{ id: string; name: string }>
  filter_options: {
    nganh_hang: string[]    // distinct product_group values
    thuong_hieu: string[]   // distinct manufacturer values
  }

  // Section 2: Tổng Quan
  yearly_series: Array<{
    year: number
    ban_hang: number    // sum customer_purchases.total_value
    nhap_hang: number   // sum purchase_orders.total_amount
  }>
  monthly_series: Array<{
    year: number
    month: number
    ban_hang: number
    nhap_hang: number
    is_forecast: boolean
  }>

  // Section 3: Chỉ Số Tập Trung
  daily_series: Array<{
    day: number
    ban_hang: number
    nhap_hang: number
  }>
  metrics_box: {
    nhap_hang: number
    ban_hang: number
    customers_active: number
    customers_total: number
    sku_sold: number
    sku_total: number
    nhan_vien: number
  }
  pie_nhap: {
    by_nganh: Array<{ name: string; value: number }>
    by_nhom: Array<{ name: string; value: number }>
    by_thuong_hieu: Array<{ name: string; value: number }>
  }
  pie_ban: {
    by_nganh: Array<{ name: string; value: number }>
    by_nhom: Array<{ name: string; value: number }>
    by_thuong_hieu: Array<{ name: string; value: number }>
  }
  kpi_row: {
    tong_nhap: number
    tong_ban: number
    tong_nhap_prev_year: number    // for YoY delta badge
    tong_ban_prev_year: number
    sl_ban: number
    sl_km: number
    avg_per_order: number
  }

  // Section 4: Nhân Viên
  staff_list: Array<{
    staff_id: string
    staff_name: string
    total_sales: number
    order_count: number
    avg_per_order: number
    customer_count: number
    days_over_1m: number
    daily_sparkline: number[]   // 30 data points (one per day in selected month)
    by_nhom: Record<string, number>
    by_thuong_hieu: Record<string, number>
  }>

  // Section 5: Khách Hàng
  customer_section: {
    by_type_sales: Array<{ type: string; ban_hang: number }>      // for radar
    by_type_count: Array<{ type: string; count: number }>         // for count chart
    map_pins: Array<{
      id: string
      latitude: number
      longitude: number
      label: string
      popup: string           // "customer_name: total_value VND"
      customer_type: string
    }>
  }

  // Section 6: Top 10
  top10: {
    customers: Array<{ name: string; total_value: number }>
    products: Array<{ name: string; total_value: number }>
  }
}
```

### Pattern 3: Forecast Adaptation

`lib/admin/forecast.ts` uses `MonthlyDataPoint { year, month, query_count, session_count }`. The new service needs nhập/bán monthly series. Two options:

**Option A** (recommended): Adapt computeForecast to be generic. The function only needs x/y pairs; `query_count` is the single metric. Run it twice — once for ban_hang, once for nhap_hang:

```typescript
// Run forecast on each series independently
const banHangPoints = monthlyData.map(d => ({
  year: d.year, month: d.month, query_count: d.ban_hang, session_count: 0
}))
const nhapHangPoints = monthlyData.map(d => ({
  year: d.year, month: d.month, query_count: d.nhap_hang, session_count: 0
}))
const banForecast = computeForecast(banHangPoints)
const nhapForecast = computeForecast(nhapHangPoints)

// Merge back into unified monthly_series
```

**Option B**: Copy-paste and rename the function. Less clean, avoid.

### Pattern 4: Filter Bar for Dashboard Page

The existing `FilterBar` component (`components/admin/FilterBar.tsx`) has props for province/district/clinicType/date. The dashboard needs different filters (NPP, month, ngành hàng, thương hiệu, kênh, Search button).

**Do NOT modify FilterBar.tsx.** The NhapHang page already does its filter bar inline (not using FilterBar component). Follow the same pattern for the dashboard: implement the dashboard filter bar inline in DashboardClient, consisting of 5 selects + 1 search button. This avoids making FilterBar a mega-component with many optional props.

FilterBar.tsx already has `npp` and `nhom` in its VI.filter dictionary but is not used on the dashboard currently. The dashboard will have its own inline filter implementation.

### Pattern 5: SSR + Suspense + Client Refetch

Established in Phase 3, verified still in use:

```typescript
// page.tsx: parse new searchParams, pass to Loader
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ npp?: string; month?: string; nganhHang?: string; thuongHieu?: string; kenh?: string }>
}) {
  const params = await searchParams
  const filters: DashboardFilters = {
    npp: params.npp || '',
    month: params.month || new Date().toISOString().slice(0, 7),
    nganhHang: params.nganhHang || '',
    thuongHieu: params.thuongHieu || '',
    kenh: params.kenh || 'le',  // default = Kênh lẻ per spec
  }
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader filters={filters} />
    </Suspense>
  )
}
```

Client refetch on Search button click (not on onChange — same as nhap-hang):
```typescript
const handleSearch = async () => {
  setLoading(true)
  const params = new URLSearchParams()
  if (filters.npp) params.set('npp', filters.npp)
  params.set('month', filters.month)
  // ... etc
  router.push(`/admin/dashboard?${params.toString()}`)
  const res = await fetch(`/api/admin/dashboard?${params.toString()}`)
  if (res.ok) setData(await res.json())
  setLoading(false)
}
```

### Pattern 6: Migration 011 Structure

Follow the exact pattern of migrations 007–010:

```sql
-- supabase/migrations/20260329_011_add_staff_id_to_customer_purchases.sql
ALTER TABLE customer_purchases
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES distributor_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cp_staff ON customer_purchases (staff_id);
```

Then in seed-sales.ts, add a staff_id assignment pass:
- Fetch all suppliers and their distributor_staff (3 per NPP)
- Fetch all customer_purchases with customer_id
- Fetch customers to get supplier_id per customer
- For each purchase: `staff_index = detHash(customer_id_as_int) * 3 | 0` → pick one of the 3 staff for that NPP
- Batch upsert with staff_id

### Pattern 7: Stacked Horizontal Bar Charts for Nhân Viên

The stacked bar charts per staff use Recharts `BarChart layout="vertical"` with `stackId="a"`. One row per staff, segments by product group or manufacturer. Same pattern already used in DashboardClient for the drug_group_breakdown inline charts:

```typescript
// Each staff becomes one entry in the chart data array
const staffGroupData = staff_list.map(staff => ({
  name: staff.staff_name,
  ...staff.by_nhom  // { 'Thuốc thú y': 1200000, 'Dinh dưỡng': 800000, ... }
}))
// Collect all unique nhom keys across all staff for dynamic Bar rendering
const nhomKeys = [...new Set(staff_list.flatMap(s => Object.keys(s.by_nhom)))]
```

### Anti-Patterns to Avoid

- **Do not modify `lib/admin/forecast.ts` signature.** The function works with `MonthlyDataPoint`. Feed it adapted input, don't change the function.
- **Do not query raw SQL.** Supabase JS client only (`.from().select().eq()` etc.). Complex aggregations are done in JS after fetching, following nhap-hang.ts precedent.
- **Do not add province/clinic_type to new DashboardFilters.** These are chatbot analytics concepts that must be removed.
- **Do not keep any import of `mv_dashboard_kpis`, `mv_monthly_queries`, `mv_category_stats`, `mv_daily_queries`.** These are entirely wrong domain.
- **Do not auto-refetch on filter change.** Search button click only — spec and nhap-hang pattern both confirm this.
- **Do not use `router.push` alone for data refresh.** It changes URL but doesn't trigger SSR re-fetch from client side. Both `router.push` + `fetch /api/admin/dashboard` are needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linear regression forecast | Custom forecast function | `lib/admin/forecast.ts` `computeForecast()` | Already implemented, tested, handles edge cases |
| Geographic customer map | Custom map component | `components/admin/MapView.tsx` | Already handles dynamic import, SSR, Leaflet marker fix |
| Mini chart in table cells | Custom SVG sparkline | `components/admin/SparklineChart.tsx` | Already built, takes `data: number[]` |
| Section collapsible headers | Custom accordion | `components/admin/SectionHeader.tsx` | Already built with teal styling |
| KPI number tiles | Custom div | `components/admin/KpiCard.tsx` | Already built with color props |
| VND formatting | Custom locale function | `n.toLocaleString('vi-VN')` | Already used consistently in nhap-hang, khach-hang |
| Color palette | New CHART_COLORS | Copy `CHART_COLORS` from NhapHangClient | Project-standard 10-color array |

---

## Common Pitfalls

### Pitfall 1: customer_purchases Has No supplier_id — Filter via customers
**What goes wrong:** Filtering customer_purchases by NPP seems natural but `customer_purchases` has no `supplier_id` column — only `customer_id`.
**Why it happens:** Customers are linked to suppliers via `customers.supplier_id`, not purchases directly.
**How to avoid:** Always JOIN/filter via `customers.supplier_id`:
1. Fetch customers filtered by `supplier_id`
2. Extract `customer_ids`
3. Filter `customer_purchases` with `.in('customer_id', customerIds)`
**Warning signs:** Query returns all NPPs' data when NPP filter is applied.

### Pitfall 2: customer_purchases Has No product info — Separate products lookup
**What goes wrong:** Aggregating by ngành hàng or thương hiệu from customer_purchases fails because the table only has `product_id`.
**Why it happens:** Product metadata (product_group, manufacturer) is in `products` table.
**How to avoid:** Fetch all products once into a Map (same pattern as nhap-hang.ts lines 119-134). Join in JS.

### Pitfall 3: computeForecast Uses `query_count` Field Name
**What goes wrong:** Passing `{ year, month, ban_hang, nhap_hang }` directly to computeForecast fails — it reads `d.query_count`.
**Why it happens:** forecast.ts uses chatbot-domain field names.
**How to avoid:** Map data before passing: `{ year, month, query_count: d.ban_hang, session_count: 0 }`. Do this separately for nhập and bán series.

### Pitfall 4: MapView Pins Need Color Based on customer_type Not query_volume
**What goes wrong:** Reusing the existing `getColorForQueries()` function from old DashboardClient gives traffic-light colors based on query count — wrong for sales dashboard.
**Why it happens:** Old dashboard colored pins by query volume.
**How to avoid:** Use customer_type color map (same as in KhachHangClient `CUSTOMER_TYPE_CONFIG` — 8 types mapped to specific colors). Pass color to `MapPin.color`.

### Pitfall 5: Kênh Filter Is "Kênh lẻ" by Default (Not "Tất cả")
**What goes wrong:** Defaulting kenh to '' (all) matches the nhap-hang pattern but CONTEXT.md specifies default = "Kênh lẻ".
**Why it happens:** Spec deviates from other pages.
**How to avoid:** In page.tsx: `kenh: params.kenh || 'le'`. In DashboardClient initial state: `kenh: 'le'`.

### Pitfall 6: staff_id Is NULL Before Seed Script Runs
**What goes wrong:** After Migration 011, all existing `customer_purchases` have `staff_id = NULL`. The Nhân Viên section returns empty table until seed script runs.
**Why it happens:** Migration adds column as nullable with no default.
**How to avoid:** The seed script update must run after migration. Document this order dependency clearly in the plan.

### Pitfall 7: Deleting check-users/check-clinics Breaks AdminSidebar Imports
**What goes wrong:** AdminSidebar imports `MessageSquare` and `Hospital` from lucide-react for the deleted nav items. After removing the nav items, TypeScript may warn about unused imports.
**Why it happens:** Icon imports become dead code.
**How to avoid:** Remove the `{ href: '/admin/check-users' }` and `{ href: '/admin/check-clinics' }` nav items AND remove `MessageSquare, Hospital` from the lucide-react import line in AdminSidebar.tsx.

### Pitfall 8: YoY Delta Badge Requires Previous Year Data
**What goes wrong:** The 4-KPI summary row shows YoY delta badges (e.g., "+12% vs 2025"). If only querying selected month, there's no previous year data.
**Why it happens:** The service must query both current month AND same month last year.
**How to avoid:** In the service, when querying for `month = 2026-03`, also query `month = 2025-03` and compute the delta. Return both `tong_nhap_prev_year` and `tong_ban_prev_year` in `kpi_row`.

---

## Code Examples

Verified patterns from existing codebase:

### Kênh Filter Applied to customer_purchases

```typescript
// Source: CONTEXT.md decisions + nhap-hang.ts pattern
const KENH_LE_TYPES = ['TH', 'GSO', 'PHA', 'SPS']
const KENH_SI_TYPES = ['WMO', 'PLT', 'BTS', 'OTHER']

// Step 1: Get customers filtered by NPP + kênh
let custQuery = db.from('customers').select('id, supplier_id, customer_type, customer_name, latitude, longitude')
if (filters.npp) {
  custQuery = custQuery.eq('supplier_id', filters.npp)
}
if (filters.kenh === 'le') {
  custQuery = custQuery.in('customer_type', KENH_LE_TYPES)
} else if (filters.kenh === 'si') {
  custQuery = custQuery.in('customer_type', KENH_SI_TYPES)
}
const { data: customers } = await custQuery
const customerIds = (customers ?? []).map(c => c.id as string)

// Step 2: Filter purchases by customer IDs
let purchaseQuery = db
  .from('customer_purchases')
  .select('customer_id, product_id, purchase_date, qty, total_value, staff_id')
  .gte('purchase_date', startOfMonth)
  .lte('purchase_date', endOfMonth)
if (customerIds.length > 0) {
  purchaseQuery = purchaseQuery.in('customer_id', customerIds)
} else {
  // No matching customers — return empty
  return emptyDashboardData
}
```

### computeForecast Adaptation for Sales Data

```typescript
// Source: lib/admin/forecast.ts interface
import { computeForecast } from '@/lib/admin/forecast'

// Aggregate monthly ban_hang + nhap_hang from purchases/orders
const monthlyMap = new Map<string, { year: number; month: number; ban: number; nhap: number }>()
// ... fill monthlyMap ...

const monthlyArr = Array.from(monthlyMap.values())
  .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

// Run forecast independently for each series
const banForecast = computeForecast(
  monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.ban, session_count: 0 }))
)
const nhapForecast = computeForecast(
  monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.nhap, session_count: 0 }))
)

// Merge into unified monthly_series
const monthly_series = banForecast.map((b, i) => ({
  year: b.year,
  month: b.month,
  ban_hang: b.query_count,
  nhap_hang: nhapForecast[i]?.query_count ?? 0,
  is_forecast: b.is_forecast,
}))
```

### Recharts ComposedChart for Forecast (from existing DashboardClient)

```typescript
// Source: app/admin/dashboard/DashboardClient.tsx lines 316-346
// Bridge point pattern: last real point also gets forecast value
const forecastChartData = monthly_series.map((d, idx, arr) => {
  const label = `${String(d.year).slice(2)}/${String(d.month).padStart(2, '0')}`
  const isLastReal = !d.is_forecast && idx < arr.length - 1 && arr[idx + 1].is_forecast
  return {
    label,
    ban_real: d.is_forecast ? null : d.ban_hang,
    nhap_real: d.is_forecast ? null : d.nhap_hang,
    ban_forecast: d.is_forecast ? d.ban_hang : isLastReal ? d.ban_hang : null,
    nhap_forecast: d.is_forecast ? d.nhap_hang : isLastReal ? d.nhap_hang : null,
  }
})

// In render:
<ComposedChart data={forecastChartData}>
  <Area type="monotone" dataKey="ban_real" fill="#06b6d4" fillOpacity={0.3} stroke="#06b6d4" />
  <Area type="monotone" dataKey="nhap_real" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" />
  <Line type="monotone" dataKey="ban_forecast" stroke="#06b6d4" strokeDasharray="4 4" connectNulls dot={false} />
  <Line type="monotone" dataKey="nhap_forecast" stroke="#3b82f6" strokeDasharray="4 4" connectNulls dot={false} />
</ComposedChart>
```

### Stacked Horizontal Bar Chart for Staff Nhóm Breakdown

```typescript
// Source: DashboardClient.tsx lines 530-548 (existing inline bar in table cells)
// For the full-width standalone chart below the table:
const nhomKeys = [...new Set(staff_list.flatMap(s => Object.keys(s.by_nhom)))]
const staffNhomData = staff_list.map(s => ({
  name: s.staff_name.length > 12 ? s.staff_name.slice(0, 12) + '…' : s.staff_name,
  ...s.by_nhom,
}))

<BarChart layout="vertical" data={staffNhomData}>
  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
  <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} />
  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatVND(Number(v))} />
  <Legend />
  {nhomKeys.map((key, i) => (
    <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
  ))}
</BarChart>
```

### Progress Bar in Chỉ Số Đo Lường Box

```typescript
// Discretion area — recommended implementation
// Each metric: label + value + progress bar (value / max * 100%)
const metricsBox = [
  { label: 'Nhập hàng', value: metrics.nhap_hang, max: referenceMax, color: 'bg-blue-500' },
  { label: 'Bán hàng', value: metrics.ban_hang, max: referenceMax, color: 'bg-green-500' },
  { label: 'Khách hàng', value: metrics.customers_active, max: metrics.customers_total, format: 'fraction', color: 'bg-teal-500' },
  { label: 'SKU/Tổng SKU', value: metrics.sku_sold, max: metrics.sku_total, format: 'fraction', color: 'bg-cyan-500' },
  { label: 'Nhân viên', value: metrics.nhan_vien, max: metrics.nhan_vien, color: 'bg-purple-500' },
]

// Render each as:
// <div class="flex items-center gap-3">
//   <span class="text-xs text-gray-400 w-24">{label}</span>
//   <div class="flex-1 bg-gray-700 rounded-full h-2">
//     <div class={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
//   </div>
//   <span class="text-sm text-white font-medium">{formattedValue}</span>
// </div>
```

### Migration 011 Pattern

```sql
-- Source: migrations 007-010 pattern (IF NOT EXISTS guards)
-- supabase/migrations/20260329_011_add_staff_id_to_customer_purchases.sql

ALTER TABLE customer_purchases
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES distributor_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cp_staff ON customer_purchases (staff_id);
```

### Seed Script: staff_id Assignment Pass

```typescript
// Source: seed-sales.ts detHash pattern (line 41)
// Add after existing purchases are confirmed seeded

const { data: staffRows } = await supabase.from('distributor_staff').select('id, supplier_id')
const staffBySupplier = new Map<string, string[]>()
for (const s of staffRows ?? []) {
  const arr = staffBySupplier.get(s.supplier_id as string) ?? []
  arr.push(s.id as string)
  staffBySupplier.set(s.supplier_id as string, arr)
}

const { data: custRows } = await supabase.from('customers').select('id, supplier_id')
const custSupplierMap = new Map(custRows?.map(c => [c.id, c.supplier_id]) ?? [])

const { data: purchRows } = await supabase.from('customer_purchases').select('id, customer_id')
const updates = (purchRows ?? []).map((p, i) => {
  const supplierId = custSupplierMap.get(p.customer_id as string) ?? ''
  const staffList = staffBySupplier.get(supplierId) ?? []
  const staffId = staffList.length > 0
    ? staffList[Math.floor(detHash(i) * staffList.length)]
    : null
  return { id: p.id, staff_id: staffId }
})
await batchInsert('customer_purchases', updates, { onConflict: 'id' })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DashboardFilters: month + province + clinic_type | DashboardFilters: npp + month + nganhHang + thuongHieu + kenh | Phase 8 | All filter params change |
| Service queries mv_dashboard_kpis, mv_monthly_queries | Service queries purchase_orders, customer_purchases, distributor_staff | Phase 8 | Complete service rewrite |
| Dashboard sections: Tổng quan, Chỉ số tập trung, Người dùng, Phòng khám | Dashboard sections: Tổng quan, Chỉ số tập trung, Nhân viên, Khách hàng, Top 10 | Phase 8 | Section 3+4 domain swap |
| AdminSidebar CHECKED: check-customers, check-distributor, check-users, check-clinics | AdminSidebar CHECKED: check-customers, check-distributor only | Phase 8 | 2 items removed |

**Deprecated/outdated:**
- `lib/admin/services/dashboard.ts` (current): Entire file. Queries `mv_dashboard_kpis`, `mv_monthly_queries`, `mv_category_stats`, `mv_daily_queries`. These views still exist in the DB but are never queried in Phase 8+.
- `DashboardFilters.province` and `DashboardFilters.clinic_type`: These filter concepts are chatbot analytics domain. Do not port them.
- `app/admin/check-users/` and `app/admin/check-clinics/`: Wrong domain pages. Delete.

---

## Open Questions

1. **customers.supplier_id — does it exist?**
   - What we know: Migration 008 creates `customers` table without `supplier_id`. Migration 009 references `customers` for display_programs FK but does not add `supplier_id`.
   - What's unclear: Seed script in 06-06 was updated to "10 suppliers" — the customers may have been seeded with supplier_id. Need to verify if `supplier_id` exists as a column on `customers`.
   - Recommendation: The planner should include a task to verify the column exists (`SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='supplier_id'`). If absent, add it as part of Migration 011 or a separate alter before the service is written.

2. **Yearly series data gap — 2022/2023 zero bars acceptable?**
   - What we know: CONTEXT.md says "2022–2023 will show zero bars (seed data starts 2024) — this is acceptable"
   - What's unclear: The X-axis should still show 2022, 2023, 2024, 2025, 2026 even with zeros, to match reference design.
   - Recommendation: Hardcode years 2022–2026 in the yearly series generation and fill with 0 where no data exists.

3. **Ngày >1tr column threshold — 1,000,000 VND per day per staff?**
   - What we know: CONTEXT.md says "Ngày >1tr = count of days in the month where that staff's sales exceeded 1,000,000 VND"
   - What's unclear: With seed data daily totals, some staff may have 0 such days (if avg/day < 1M VND). This is cosmetically acceptable but should be verified with seed data.
   - Recommendation: Implement threshold as constant `const DAY_THRESHOLD = 1_000_000` so it can be adjusted if seed data shows all zeros.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — include this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — this is a Next.js project with no jest/vitest config found |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (TypeScript type check) |
| Full suite command | `npx next build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH2-01 | Migration 011 column added; deleted pages return 404; sidebar has no check-users/check-clinics links | manual-smoke | `npx tsc --noEmit` (compile) | ❌ Wave 0 |
| DASH2-02 | getDashboardData() returns all required fields without runtime error | manual-smoke | `npx tsc --noEmit` | N/A — service file |
| DASH2-03 | Filter bar renders 5 selects; Search triggers API call with correct params | manual-smoke | Browser test | N/A |
| DASH2-05 | Tổng Quan charts render; forecast series has is_forecast points | manual-smoke | Browser test | N/A |
| DASH2-06 | Chỉ Số Tập Trung renders 6 donuts + 4 KPIs + daily chart | manual-smoke | Browser test | N/A |
| DASH2-07 | Nhân Viên table shows staff names; Khách Hàng map shows pins; Top 10 bars render | manual-smoke | Browser test | N/A |

**Note:** This project has no automated test suite. All validation is via TypeScript compilation + manual browser smoke test.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (ensures no type errors introduced)
- **Per wave merge:** `npx next build` (full build check)
- **Phase gate:** Build passes + manual smoke test of all 5 dashboard sections before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework exists — all validation is TypeScript + build + manual. This is acceptable given project history (all prior phases verified manually).

---

## Sources

### Primary (HIGH confidence)
- `lib/admin/services/nhap-hang.ts` — Service layer query pattern verified by reading source
- `lib/admin/services/dashboard.ts` — Existing service confirmed as wrong domain; all query targets documented
- `lib/admin/forecast.ts` — computeForecast signature and MonthlyDataPoint interface confirmed by reading source
- `app/admin/dashboard/DashboardClient.tsx` — Existing client confirmed; ComposedChart forecast pattern verified
- `components/admin/MapView.tsx`, `SparklineChart.tsx`, `KpiCard.tsx`, `FilterBar.tsx` — All verified by reading source
- `components/admin/AdminSidebar.tsx` — Confirmed check-users/check-clinics links exist and must be removed
- `supabase/migrations/20260319_007_add_purchase_tables.sql` — suppliers, products, purchase_orders, purchase_order_items schema
- `supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql` — customers, customer_purchases schema (no staff_id, no supplier_id on customers)
- `supabase/migrations/20260320_009_add_check_customers_distributor_tables.sql` — distributor_staff schema
- `.planning/phases/08-dashboard-sales-rebuild/08-CONTEXT.md` — All locked decisions

### Secondary (MEDIUM confidence)
- `scripts/seed-sales.ts` — detHash pattern and batchInsert helper verified; staff_id assignment pattern modeled on existing code
- `app/admin/khach-hang/KhachHangClient.tsx` — CUSTOMER_TYPE_CONFIG verified for map pin color mapping

### Tertiary (LOW confidence)
- `customers.supplier_id` column existence: Not confirmed in any migration. Seed script references it but schema file does not show it. Flagged as Open Question 1.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture patterns: HIGH — all patterns verified from existing working code
- Data shapes: HIGH — all tables read from migration files
- Pitfalls: HIGH — derived from reading actual code and spotting real gaps (customers.supplier_id, computeForecast field naming)
- Validation: HIGH — consistent with all prior phases (no automated test suite)

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable stack, 30-day window)
