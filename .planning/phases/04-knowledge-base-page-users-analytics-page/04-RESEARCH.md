# Phase 4: Ton Kho + Khach Hang - Research

**Researched:** 2026-03-20
**Domain:** Supabase inventory snapshots, customer analytics, Recharts charting, Next.js SSR pages
**Confidence:** HIGH

## Summary

Phase 4 is a complete rebuild replacing the wrong Knowledge Base and Users pages with two new analytics pages: `/admin/ton-kho` (inventory stock analytics) and `/admin/khach-hang` (business customer analytics). The phase requires a new database migration for 3 tables (`inventory_snapshots`, `customers`, `customer_purchases`), seed data generation, teardown of 6 wrong files, sidebar link updates, and two full page implementations with service layers and API routes.

The existing codebase provides extremely strong patterns to follow. Phase 3's nhap-hang implementation (`NhapHangClient.tsx`, `nhap-hang.ts` service, `route.ts` API) establishes the exact architecture: SSR page with `searchParams` -> service function -> Client component with Recharts charts. The shared components (`DataTable`, `KpiCard`, `SectionHeader`, `FilterBar`) are all production-ready and tested. The 62-product catalog already exists in `data/seeds/products.ts` and the `products` table schema is compatible.

**Primary recommendation:** Follow the nhap-hang pattern exactly. The service layer fetches all snapshot data for the selected date, aggregates in JS (same as nhap-hang does for orders), and returns typed response objects. Both pages use client-side `DataTable` pagination (not server-side) since data volumes are small (~62 products, ~200 customers).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Teardown**: Delete `app/admin/knowledge-base/`, `app/admin/users/`, `app/api/admin/knowledge-base/`, `app/api/admin/users/`, `lib/admin/services/knowledge-base.ts`, `lib/admin/services/users.ts`
- **Keep untouched**: `components/admin/DataTable.tsx` -- do NOT rewrite
- **AdminSidebar.tsx**: Update two hrefs only (`knowledge-base` -> `ton-kho`, `users` -> `khach-hang`) and labels
- **Export**: Client-side only using `xlsx` (already installed), via `DataTable` with `exportConfig={{ copy: true, excel: true }}`
- **Inventory snapshots**: Date picker is functional, queries latest snapshot on or before selected date per product, default = today
- **Migration**: `20260320_008_add_ton_kho_khach_hang_tables.sql` creates `inventory_snapshots`, `customers`, `customer_purchases`
- **Products table**: Existing `products` table from migration 007 is compatible with 62-product catalog
- **Seed volumes**: 62 products, ~806 inventory_snapshots (62x13 weeks), ~200 customers (TH 28% / GSO 34% / PHA 14% / SPS 12% / BTS 9% / OTHER+PLT+WMO 3%), ~500-800 customer_purchases
- **Ton-kho layout**: 3 KPI cards (blue/orange/teal), 6 charts in 2x3 grid (4 H-BarCharts + 2 Donuts), DataTable with Copy+Excel
- **Khach-hang layout**: 3 chart panels (Line/Bar/H-Bar), 3 collapsible sections with KPI tiles and breakdown tables
- **New files**: `app/admin/ton-kho/`, `app/admin/khach-hang/`, `app/api/admin/ton-kho/`, `app/api/admin/khach-hang/`, `lib/admin/services/ton-kho.ts`, `lib/admin/services/khach-hang.ts`

### Claude's Discretion
- Exact KPI card color shades (use nhap-hang color palette as reference)
- Icon badge implementation for customer types (colored dot or lucide-react icon)
- Chart colors (use CHART_COLORS constant from existing dashboard/nhap-hang pages)
- Empty state copy for low-data sections

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TK-01 | New migration + seed data + file teardown + sidebar update | Migration schema from CONTEXT.md, seed pattern from `scripts/seed.ts`, exact files to delete confirmed, AdminSidebar.tsx lines 17-18 need updating |
| TK-02 | `GET /api/admin/ton-kho` API with KPIs, charts, products data | API response shape from design spec section 7.4, service pattern from `nhap-hang.ts`, Supabase query pattern for "latest snapshot <= date" |
| TK-03 | Ton-kho page UI with filter bar, KPIs, 2x3 chart grid, DataTable | Recharts patterns from NhapHangClient.tsx (CHART_COLORS, TOOLTIP_STYLE, horizontal BarChart, donut PieChart), DataTable API confirmed, reference image analyzed |
| KH-01 | `GET /api/admin/khach-hang` API with charts, KPIs, breakdowns, high-value stores | API response shape from design spec section 7.5, service pattern established |
| KH-02 | Khach-hang charts: LineChart + BarChart + H-BarChart | Recharts imports and patterns confirmed from NhapHangClient.tsx |
| KH-03 | "Tat ca khach hang" section: 4 KPI tiles + breakdown table | KpiCard component API confirmed, SectionHeader with `defaultOpen={true}`, breakdown table is custom (not DataTable) |
| KH-04 | "Khach hang dang mua hang" section: 4 KPIs + breakdown with extra columns | Same pattern as KH-03 with additional pct_of_total and pct_of_active columns |
| KH-05 | "So luong cua hieu thuc pham >300K" section: collapsible, collapsed by default | SectionHeader with `defaultOpen={false}`, graceful empty state pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | already installed | All charts (BarChart, PieChart, LineChart) | Used in DashboardClient, NhapHangClient |
| @tanstack/react-table | v8 (installed) | DataTable component (DO NOT TOUCH) | Powers existing DataTable.tsx |
| @supabase/supabase-js | installed | Database queries via service client | Used in all service layers |
| xlsx | installed | Client-side Excel export | Used in DataTable export handler |
| lucide-react | installed | Icons for KPI cards and UI elements | Used throughout admin UI |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next | v16 | SSR pages with searchParams Promise | Page components pattern |

### Alternatives Considered
None -- all libraries are already installed and in use. No new dependencies needed for Phase 4.

## Architecture Patterns

### Recommended Project Structure
```
app/admin/ton-kho/
  page.tsx            # SSR page, calls service, passes to Client
  TonKhoClient.tsx    # 'use client', charts + DataTable + filter bar
app/admin/khach-hang/
  page.tsx            # SSR page, calls service, passes to Client
  KhachHangClient.tsx # 'use client', charts + sections + KPI tiles
app/api/admin/ton-kho/
  route.ts            # GET handler, requireAdmin, parse params, call service
app/api/admin/khach-hang/
  route.ts            # GET handler, requireAdmin, parse params, call service
lib/admin/services/
  ton-kho.ts          # getTonKhoData() — Supabase queries + JS aggregation
  khach-hang.ts       # getKhachHangData() — Supabase queries + JS aggregation
supabase/migrations/
  20260320_008_add_ton_kho_khach_hang_tables.sql
data/seeds/
  inventory_snapshots.ts  # ~806 rows
  customers.ts            # ~200 rows
  customer_purchases.ts   # ~500-800 rows
```

### Pattern 1: SSR Page with Search Params (from nhap-hang/page.tsx)
**What:** Async server component receives `searchParams` as Promise, calls service function, passes data to client component.
**When to use:** Every admin page.
**Example:**
```typescript
// app/admin/ton-kho/page.tsx
export default async function AdminTonKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot_date?: string; nhom?: string }>
}) {
  const params = await searchParams
  const snapshot_date = params.snapshot_date || new Date().toISOString().slice(0, 10)
  const data = await getTonKhoData({ snapshot_date, nhom: params.nhom || '' })
  return <TonKhoClient initialData={data} initialFilters={{ snapshot_date, nhom: params.nhom || '' }} />
}
```

### Pattern 2: Service Layer (from lib/admin/services/nhap-hang.ts)
**What:** Async function using `createServiceClient()`, fetches data, aggregates in JS, returns typed object.
**When to use:** Every data-fetching operation.
**Example:**
```typescript
// lib/admin/services/ton-kho.ts
import { createServiceClient } from '@/lib/supabase/server'

export interface TonKhoData {
  kpis: { total_value: number; total_qty: number; sku_in_stock: number; total_sku: number }
  value_by_nhom: Array<{ name: string; value: number }>
  // ... more chart data ...
  products: Array<{ product_code: string; product_name: string; qty: number; unit_price: number; total_value: number }>
}

export async function getTonKhoData(filters: TonKhoFilters): Promise<TonKhoData> {
  const db = createServiceClient()
  // Query inventory_snapshots for latest snapshot <= filters.snapshot_date per product
  // Join with products table for grouping
  // Aggregate in JS (same pattern as nhap-hang)
}
```

### Pattern 3: API Route (from app/api/admin/nhap-hang/route.ts)
**What:** GET handler with `requireAdmin()` guard, parses search params, calls service, returns JSON.
**When to use:** Every admin API endpoint.
**Example:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getTonKhoData } from '@/lib/admin/services/ton-kho'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const snapshot_date = searchParams.get('snapshot_date') || new Date().toISOString().slice(0, 10)
  // ... parse other params ...

  try {
    const data = await getTonKhoData({ snapshot_date, nhom, search })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Ton kho API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Pattern 4: Client Component with Recharts (from NhapHangClient.tsx)
**What:** `'use client'` component with useState for data/filters/loading, fetch on filter change, Recharts charts with consistent styling.
**When to use:** All chart pages.
**Key constants to reuse:**
```typescript
const CHART_COLORS = [
  '#06b6d4', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1',
]

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  color: 'white',
}

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN')
}
```

### Pattern 5: Supabase "Latest Snapshot On or Before Date" Query
**What:** The core inventory query pattern for getting per-product stock levels at a specific date.
**When to use:** ton-kho service layer.
**Approach:** Supabase JS client does not support window functions or subqueries directly. Use a two-step approach:
1. Fetch all snapshots with `snapshot_date <= selected_date`, ordered by `product_id, snapshot_date DESC`
2. In JS, deduplicate to keep only the latest per product_id (first occurrence after sort)
```typescript
const { data: snapshots } = await db
  .from('inventory_snapshots')
  .select('product_id, snapshot_date, qty, unit_price')
  .lte('snapshot_date', filters.snapshot_date)
  .order('snapshot_date', { ascending: false })

// Deduplicate: keep only latest snapshot per product
const latestByProduct = new Map<string, typeof snapshots[0]>()
for (const snap of snapshots ?? []) {
  if (!latestByProduct.has(snap.product_id)) {
    latestByProduct.set(snap.product_id, snap)
  }
}
```
**Alternative (more efficient):** Use Supabase RPC with a SQL function that does `DISTINCT ON (product_id)`. But the JS approach is fine for ~806 rows.

### Anti-Patterns to Avoid
- **Do NOT rewrite DataTable.tsx** -- it is working and tested. Use it as-is with `exportConfig={{ copy: true, excel: true }}`.
- **Do NOT use server-side pagination** for ton-kho or khach-hang DataTable -- data volumes are small (62 products, ~200 customers). Use client-side filtering/pagination.
- **Do NOT build a custom filter bar from scratch** -- the nhap-hang page builds its own inline filter bar (not using FilterBar component), which is the simpler pattern for page-specific filters. Follow that approach.
- **Do NOT use FilterBar component** for ton-kho/khach-hang -- it was built for dashboard/check-users (province/district/clinicType selectors). The ton-kho filter (NPP + date picker + nhom dropdown) and khach-hang filter (NPP dropdown only) are simpler and page-specific. Build inline like nhap-hang does.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable paginated table with export | Custom table component | `DataTable` with `exportConfig` | Already built, tested, supports Copy+Excel |
| Collapsible sections | Custom toggle logic | `SectionHeader` with `defaultOpen` prop | Already built with chevron toggle |
| Colored KPI display | Custom card styling | `KpiCard` with `bgColor`/`textColor` props | Consistent styling across pages |
| VND number formatting | Custom formatter | `n.toLocaleString('vi-VN')` (same `formatVND` as nhap-hang) | Standard JS, no library needed |
| Excel export | Custom xlsx builder | `DataTable`'s built-in `handleExcel` via dynamic `import('xlsx')` | Already handles sheet creation |

## Common Pitfalls

### Pitfall 1: Snapshot Date Query Returns All Historical Data
**What goes wrong:** Fetching all snapshots without date filtering returns hundreds of rows per product.
**Why it happens:** The `inventory_snapshots` table has 13 weekly snapshots per product (~806 total rows).
**How to avoid:** Always filter `.lte('snapshot_date', selected_date)` and deduplicate per product_id in JS.
**Warning signs:** KPI values are wildly inflated (summing all weeks instead of one snapshot).

### Pitfall 2: Products Table Has Existing Products from Nhap-hang Seed
**What goes wrong:** Trying to insert 62 products that may already exist.
**Why it happens:** `seedProducts()` in `scripts/seed.ts` already inserts all 62 products from `data/seeds/products.ts`.
**How to avoid:** The products are ALREADY seeded. The inventory_snapshots seed just needs to look up existing product IDs. Use `upsert` with `onConflict: 'product_code'` if re-inserting, or just query existing products and reference their IDs.
**Warning signs:** "duplicate key" errors during seed.

### Pitfall 3: AdminSidebar Href Update Breaks Active State
**What goes wrong:** Changing hrefs but forgetting to update labels or icons.
**Why it happens:** The sidebar `NAV_SECTIONS` array has href, label, and icon fields.
**How to avoid:** Update both href AND label for the two items:
- Line 17: `{ href: '/admin/knowledge-base', label: 'Ton kho tri thuc', icon: BookOpen }` -> `{ href: '/admin/ton-kho', label: 'Ton kho', icon: Package }` (reuse Package icon or use Warehouse)
- Line 18: `{ href: '/admin/users', label: 'Khach hang', icon: Users }` -> `{ href: '/admin/khach-hang', label: 'Khach hang', icon: Users }`

### Pitfall 4: Khach-hang "Purchasing Customers" Count > Active Count Is NOT a Bug
**What goes wrong:** Developer sees 588 purchasing customers vs 455 active customers and thinks it is a data error.
**Why it happens:** This is intentional -- the count reflects order occurrences, not unique customers. One customer with multiple orders counts multiple times in the purchasing tally.
**How to avoid:** Seed data must reflect this pattern. The CONTEXT.md explicitly notes "Total with orders can exceed total active customers."

### Pitfall 5: Seed Script Idempotency
**What goes wrong:** Running seed twice creates duplicate rows or errors.
**Why it happens:** `customer_purchases` uses `insert` not `upsert`.
**How to avoid:** Follow existing seed pattern -- use `upsert` with `onConflict` and `ignoreDuplicates: true`. For tables without unique business keys (like `customer_purchases`), add an idempotency check at the top: query count, skip if already seeded.

### Pitfall 6: Ton-kho Date Picker Needs HTML date Input
**What goes wrong:** Using month/year selectors instead of a date picker for inventory snapshots.
**Why it happens:** Nhap-hang uses month/year selectors, but ton-kho needs a specific date.
**How to avoid:** Use `<input type="date" />` with the same styling classes as nhap-hang selectors: `className="bg-gray-800 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm"`. Default value = today's date in YYYY-MM-DD format.

## Code Examples

### Horizontal BarChart (from NhapHangClient.tsx, lines 271-299)
```typescript
// Used for "Gia tri ton theo nhom", "Gia tri ton theo thuong hieu", etc.
<ResponsiveContainer width="100%" height={Math.max(250, data.length * 30)}>
  <BarChart layout="vertical" data={data} margin={{ left: 10, right: 40 }}>
    <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
    <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatVND(Number(v))} />
    <YAxis
      type="category"
      dataKey="name"
      width={180}
      tick={{ fill: '#9ca3af', fontSize: 11 }}
      tickFormatter={(v) => String(v).length > 25 ? String(v).slice(0, 25) + '...' : String(v)}
    />
    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatVND(Number(value)), 'Gia tri']} />
    <Bar dataKey="value" fill="#06b6d4" name="Gia tri">
      <LabelList dataKey="value" position="right" fill="#9ca3af" fontSize={11} formatter={(v) => formatVND(Number(v))} />
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

### Donut PieChart (from NhapHangClient.tsx, lines 314-343)
```typescript
// Used for "Gia tri ton theo nganh hang", "So luong ton theo nganh hang"
<ResponsiveContainer width="100%" height={280}>
  <PieChart>
    <Pie
      data={chartData.filter(d => d.value > 0)}
      dataKey="value"
      nameKey="name"
      cx="40%"
      cy="50%"
      innerRadius={60}
      outerRadius={90}
      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
      labelLine={false}
    >
      {chartData.filter(d => d.value > 0).map((_, i) => (
        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
      ))}
    </Pie>
    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatVND(Number(value)), 'Gia tri']} />
    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
  </PieChart>
</ResponsiveContainer>
```

### KpiCard Usage (from NhapHangClient.tsx)
```typescript
<KpiCard
  value={formatVND(data.kpis.total_value)}
  label="Tong gia tri ton"
  icon={<DollarSign className="h-5 w-5" />}
  bgColor="bg-blue-500"
  textColor="text-white"
/>
```

### DataTable Usage with Export
```typescript
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable'

const columns: DataTableColumn<ProductRow>[] = [
  { key: 'product_code', label: 'Ma san pham', sortable: true },
  { key: 'product_name', label: 'Ten san pham', sortable: true },
  { key: 'qty', label: 'So luong', sortable: true, render: (v) => formatVND(Number(v)) },
  { key: 'unit_price', label: 'Don gia', sortable: true, render: (v) => formatVND(Number(v)) },
  { key: 'total_value', label: 'Thanh tien', sortable: true, render: (v) => formatVND(Number(v)) },
]

<DataTable
  data={data.products}
  columns={columns}
  exportConfig={{ copy: true, excel: true }}
  showSearch={true}
  searchPlaceholder="Tim kiem san pham..."
  pageSize={10}
/>
```

### SectionHeader with Collapse (for khach-hang)
```typescript
// Open by default
<SectionHeader title="Tat ca khach hang" defaultOpen={true}>
  {/* KPI tiles + breakdown table */}
</SectionHeader>

// Collapsed by default
<SectionHeader title="So luong cua hieu thuc pham >300K" defaultOpen={false}>
  {/* High value stores table or empty state */}
</SectionHeader>
```

### Migration SQL Pattern (from existing migration 007)
```sql
-- Follow IF NOT EXISTS pattern
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  qty           integer NOT NULL DEFAULT 0,
  unit_price    numeric(12,0) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, snapshot_date)
);

-- RLS policy pattern
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_snapshots' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON inventory_snapshots FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
```

### Seed Script Pattern (from existing seed.ts)
```typescript
// New seed function follows existing pattern
async function seedInventorySnapshots(): Promise<SeedResult> {
  console.log('Seeding inventory_snapshots...')

  // Idempotency check
  const { count } = await supabase.from('inventory_snapshots').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  inventory_snapshots already seeded (${count} rows). Skipping.`)
    return { inserted: 0, skipped: count }
  }

  // Get product IDs from existing products table
  const { data: products } = await supabase.from('products').select('id, product_code')
  const productMap = new Map((products ?? []).map(p => [p.product_code, p.id]))

  // Generate 13 weekly snapshots per product
  const { INVENTORY_SNAPSHOTS } = await import('../data/seeds/inventory_snapshots')
  // ... batch insert with upsert ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Knowledge Base page (AI docs) | Ton Kho page (inventory stock) | Phase 4 rebuild | Complete domain change |
| Users analytics (chatbot users) | Khach Hang page (business customers) | Phase 4 rebuild | Complete domain change |
| Server-side pagination for small datasets | Client-side pagination via DataTable | Phase 4 decision | Simpler implementation, fine for ~62/~200 rows |

## Key Implementation Details

### AdminSidebar.tsx Changes (lines 17-18)
Current:
```typescript
{ href: '/admin/knowledge-base', label: 'Ton kho tri thuc', icon: BookOpen },
{ href: '/admin/users', label: 'Khach hang', icon: Users },
```
Change to:
```typescript
{ href: '/admin/ton-kho', label: 'Ton kho', icon: Package },
{ href: '/admin/khach-hang', label: 'Khach hang', icon: Users },
```
Note: `Package` is already imported in AdminSidebar.tsx (line 6). `BookOpen` import can be removed.

### Files to Delete (confirmed existing)
- `app/admin/knowledge-base/KnowledgeBaseClient.tsx` -- EXISTS
- `app/admin/knowledge-base/page.tsx` -- EXISTS
- `app/admin/users/UsersClient.tsx` -- EXISTS
- `app/admin/users/page.tsx` -- EXISTS
- `app/api/admin/knowledge-base/route.ts` -- EXISTS
- `app/api/admin/users/route.ts` -- EXISTS
- `lib/admin/services/knowledge-base.ts` -- EXISTS
- `lib/admin/services/users.ts` -- EXISTS

### Inventory Snapshot Query Strategy
The Supabase JS client cannot do `DISTINCT ON` or window functions. Two viable approaches:

**Approach A (recommended for ~806 rows):** Fetch all snapshots `<= date`, deduplicate in JS
```typescript
const { data } = await db.from('inventory_snapshots')
  .select('product_id, snapshot_date, qty, unit_price')
  .lte('snapshot_date', date)
  .order('snapshot_date', { ascending: false })

const latest = new Map()
for (const row of data ?? []) {
  if (!latest.has(row.product_id)) latest.set(row.product_id, row)
}
```

**Approach B (if performance matters):** Create an RPC function in the migration:
```sql
CREATE OR REPLACE FUNCTION get_latest_snapshots(p_date date)
RETURNS TABLE(product_id uuid, snapshot_date date, qty int, unit_price numeric) AS $$
  SELECT DISTINCT ON (product_id) product_id, snapshot_date, qty, unit_price
  FROM inventory_snapshots
  WHERE snapshot_date <= p_date
  ORDER BY product_id, snapshot_date DESC
$$ LANGUAGE sql STABLE;
```
Then call via `db.rpc('get_latest_snapshots', { p_date: date })`.

**Recommendation:** Use Approach A. With only ~806 rows total, JS deduplication is trivial and avoids adding RPC complexity. The entire fetch + dedup is < 100ms.

### Khach-hang Breakdown Table Structure
The breakdown tables in khach-hang sections are NOT DataTable instances -- they are simple HTML tables with 5-8 rows (one per customer type). They should be rendered as plain `<table>` elements with the dark admin styling, similar to the orders table in NhapHangClient.tsx (lines 238-268).

### Customer Type Icon Badges
Each customer type needs a distinct colored icon/badge. Recommendation (Claude's discretion):
```typescript
const CUSTOMER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  TH:    { label: 'Tap hoa',       color: 'bg-green-500',  icon: 'Store' },
  GSO:   { label: 'Bach hoa',      color: 'bg-blue-500',   icon: 'Building' },
  PHA:   { label: 'Nha thuoc',     color: 'bg-red-500',    icon: 'Cross' },
  SPS:   { label: 'Me & Be',       color: 'bg-pink-500',   icon: 'Baby' },
  BTS:   { label: 'My pham',       color: 'bg-purple-500', icon: 'Sparkles' },
  OTHER: { label: 'Khac',          color: 'bg-gray-500',   icon: 'HelpCircle' },
  PLT:   { label: 'Phu lieu toc',  color: 'bg-yellow-500', icon: 'Scissors' },
  WMO:   { label: 'Cho',           color: 'bg-orange-500', icon: 'ShoppingBag' },
}
```
Use lucide-react icons with a small colored badge/dot beside the icon. The reference image shows square colored icon badges.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation + build check |
| Config file | none (no automated test setup in project) |
| Quick run command | `npx next build` |
| Full suite command | `npx next build && npx next start` (manual page check) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TK-01 | Migration runs, seed completes, old files deleted, sidebar updated | manual | `npx tsx scripts/seed.ts` (after migration applied) | N/A |
| TK-02 | API returns correct shape with snapshot_date filtering | manual | `curl localhost:3000/api/admin/ton-kho?snapshot_date=2026-03-20` | N/A |
| TK-03 | Ton-kho page renders KPIs, charts, DataTable | manual | Navigate to `/admin/ton-kho` | N/A |
| KH-01 | API returns correct shape with all sections | manual | `curl localhost:3000/api/admin/khach-hang` | N/A |
| KH-02 | 3 chart panels render with non-zero data | manual | Navigate to `/admin/khach-hang` | N/A |
| KH-03 | "Tat ca khach hang" section renders 4 KPIs + breakdown | manual | Visual check | N/A |
| KH-04 | "Khach hang dang mua hang" section renders correctly | manual | Visual check | N/A |
| KH-05 | ">300K" section is collapsed by default, shows empty state | manual | Visual check | N/A |

### Sampling Rate
- **Per task commit:** `npx next build` (type-check + bundle)
- **Per wave merge:** Full build + manual page navigation
- **Phase gate:** All pages render with seed data, API responses match expected shapes

### Wave 0 Gaps
- No automated test infrastructure exists in this project -- all validation is manual (build + visual)
- This is consistent with Phases 1-3 which used the same approach

## Open Questions

1. **Min stock threshold for ton-kho DataTable**
   - What we know: The design spec mentions "Ton min" column in the product table
   - What's unclear: No `min_stock` field exists in `inventory_snapshots` or `products` table schema
   - Recommendation: Add a `min_stock` column to `products` table in the migration, or hardcode a default (e.g., 10). Since CONTEXT.md's table schema does not include it, set a reasonable default per product in seed data.

2. **"Last import date" for ton-kho DataTable**
   - What we know: The design spec mentions "Ngay nhap moi nhat" column
   - What's unclear: This requires joining `purchase_order_items` -> `purchase_orders` to find the latest order_date per product
   - Recommendation: Query this in the service layer with a separate Supabase query grouping by product_id and taking MAX(order_date).

## Sources

### Primary (HIGH confidence)
- `app/admin/nhap-hang/NhapHangClient.tsx` -- Recharts patterns, CHART_COLORS, chart styling
- `lib/admin/services/nhap-hang.ts` -- Service layer pattern, Supabase query style
- `app/api/admin/nhap-hang/route.ts` -- API route pattern
- `components/admin/DataTable.tsx` -- DataTable API (props, ExportConfig interface)
- `components/admin/KpiCard.tsx` -- KpiCard API (value, label, icon, bgColor, textColor)
- `components/admin/SectionHeader.tsx` -- SectionHeader API (title, defaultOpen, children)
- `components/admin/AdminSidebar.tsx` -- Current nav items, lines 17-18 need updating
- `supabase/migrations/20260319_007_add_purchase_tables.sql` -- Products table schema confirmed
- `data/seeds/products.ts` -- 62 products already seeded
- `scripts/seed.ts` -- Seed script pattern (idempotency, batch insert, progress logging)
- `docs/2026-03-18-admin-dashboard-design.md` sections 7.4, 7.5 -- API response shapes, page layouts
- `samples/3_ton_kho.jpg` -- Visual reference for ton-kho layout
- `samples/4_khach_hang.jpg` -- Visual reference for khach-hang layout

### Secondary (MEDIUM confidence)
- `04-CONTEXT.md` -- User decisions, table schemas, seed volumes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in prior phases
- Architecture: HIGH -- exact patterns exist in nhap-hang implementation, copy-adapt
- Pitfalls: HIGH -- confirmed via code reading (existing products, sidebar links, DataTable API)
- Supabase query strategy: HIGH -- JS deduplication is simple and sufficient for data volume

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependency changes expected)
