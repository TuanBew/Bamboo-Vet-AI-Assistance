# MySQL Migration Rev 2 — Tasks 6–16

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Checkboxes track progress.

**Goal:** Replace all Supabase data queries with MySQL client calls. Auth (Supabase) and RAGflow chatbot are frozen.

**Architecture:** Direct SQL queries against `_door`, `_dpur`, `_product` tables. SQL aliases map PascalCase MySQL columns back to snake_case so TypeScript interfaces stay unchanged. All aggregation continues in JavaScript (same as current).

**Tech Stack:** `lib/mysql/client.ts` (`query<T>`) — already built in Tasks 1–5.

---

## DISCOVERED DATABASE STRUCTURE (supersedes original plan)

| Original assumption | Actual MySQL |
|---|---|
| Table `door` | Table `_door` |
| Table `dpur` | Table `_dpur` |
| Table `product` | Table `_product` |
| `mv_dashboard_kpis` | Does NOT exist |
| Stored procedures exist | NO stored procedures |
| Date columns are DATE type | VARCHAR 'YYYY-MM-DD' |

**Column mapping** (`_door`): snake_case → PascalCase
```
saleperson_key → SalepersonKey      saleperson_name → SalepersonName
customer_key → CustomerKey           customer_name → CustomerName
cust_class_key → CustClassKey        cust_class_name → CustClassName
sku_code → SKUCode                   sku_name → SKUName
off_date → OffDate                   off_qty → OffQty
off_amt → OffAmt                     off_dsc → OffDsc
off_tax_amt → OffTaxAmt              category → Category
brand → Brand                        product → Product
lat → Lat                            long → `Long`  ← reserved keyword!
ship_from_code → ShipFromCode        ship_from_name → ShipFromName
province_name → ProvinceName         dist_province → DistProvince
town_name → TownName                 address → Address
v_chanel → V_Chanel
```

**Column mapping** (`_dpur`): snake_case → PascalCase
```
site_code → SiteCode    site_name → SiteName     region → Region
area → Area             dist_province → DistProvince
docno → Docno           sku_code → SKUCode        sku_name → SKUName
pur_date → PurDate      trntyp → Trntyp
pr_qty → PRQty          pr_amt → PRAmt            pr_tax_amt → PRTaxAmt
program_id → Program_ID category → Category       brand → Brand
product → Product
```

**Column mapping** (`_product`):
```
sku_code → SKUCode    sku_name → SKUName    last_cost → LastCost
brand → Brand         product → Product     category → Category
```

**Rule:** Always use SQL aliases to return snake_case column names.
```sql
-- Bad: returns PascalCase keys
SELECT SiteCode FROM `_dpur`

-- Good: returns snake_case keys matching existing TypeScript interfaces
SELECT SiteCode AS site_code FROM `_dpur`
```

---

## Task 6: Migrate npp-options.ts

**Files:**
- Modify: `lib/admin/services/npp-options.ts`

The current code queries `dpur.site_code, site_name`. MySQL equivalent queries `_dpur.SiteCode, SiteName`.

- [ ] **Step 1: Replace the service**

Replace entire `lib/admin/services/npp-options.ts` with:

```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

interface DpurRow {
  site_code: string
  site_name: string
}

async function _getNppOptions(): Promise<Array<{ site_code: string; site_name: string }>> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.from('dpur').select('site_code,site_name').order('site_name').limit(1000)
  const rows = await query<DpurRow>(
    'SELECT SiteCode AS site_code, SiteName AS site_name FROM `_dpur` ORDER BY SiteName LIMIT 1000',
    []
  )

  const seen = new Map<string, { site_code: string; site_name: string }>()
  for (const row of rows) {
    const code = row.site_code?.trim()
    if (code && !seen.has(code)) {
      seen.set(code, {
        site_code: code,
        site_name: row.site_name?.trim() || code,
      })
    }
  }
  return [...seen.values()]
}

export const getNppOptions = unstable_cache(
  _getNppOptions,
  ['npp-options'],
  { tags: ['npp-options'], revalidate: 86400 }
)
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS (no unit tests for this service; existing test suite must not regress).

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/npp-options.ts
git commit -m "feat(mysql): migrate npp-options service to MySQL"
```

---

## Task 7: Migrate dpur-geo.ts

**Files:**
- Modify: `lib/admin/services/dpur-geo.ts`

- [ ] **Step 1: Replace the service**

Replace entire `lib/admin/services/dpur-geo.ts` with:

```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

export interface DpurGeoEntry {
  site_name: string
  region: string
  area: string
  dist_province: string
}

interface DpurGeoRow {
  site_name: string
  region: string
  area: string
  dist_province: string
}

async function _getDpurGeoLookup(): Promise<DpurGeoEntry[]> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.from('dpur').select('site_name,region,area,dist_province')
  const rows = await query<DpurGeoRow>(
    'SELECT SiteName AS site_name, Region AS region, Area AS area, DistProvince AS dist_province FROM `_dpur`',
    []
  )

  const seen = new Set<string>()
  const result: DpurGeoEntry[] = []
  for (const r of rows) {
    const name = r.site_name?.trim() || ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push({
      site_name:     name,
      region:        r.region        || '',
      area:          r.area          || '',
      dist_province: r.dist_province || '',
    })
  }
  return result
}

export const getDpurGeoLookup = unstable_cache(
  _getDpurGeoLookup,
  ['geo-data'],
  { tags: ['geo-data'], revalidate: 86400 }
)
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/dpur-geo.ts
git commit -m "feat(mysql): migrate dpur-geo service to MySQL"
```

---

## Task 8: Migrate nhap-hang.ts

**Files:**
- Modify: `lib/admin/services/nhap-hang.ts`

The current Supabase code does a direct `.from('dpur')` range query then aggregates in JS. The JS aggregation is unchanged — only the data fetch changes.

- [ ] **Step 1: Replace the data fetch section**

In `lib/admin/services/nhap-hang.ts`, replace the imports and the data fetch block:

Replace:
```ts
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getNppOptions } from './npp-options'
```
With:
```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'
import { getNppOptions } from './npp-options'
```

Replace the `_getNhapHangData` function's data fetch block (lines 84–121, from `const db = createServiceClient()` through `})`):

```ts
async function _getNhapHangData(
  filters: NhapHangFilters
): Promise<NhapHangData> {
  const startOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const lastDay = new Date(filters.year, filters.month, 0).getDate()
  const endOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-${lastDay}`

  // 1. Get NPP list (always all, for dropdown) — 24h cached
  const nppOptions = await getNppOptions()
  const suppliers = nppOptions.map(o => ({ id: o.site_code, name: o.site_name }))

  // 2. Fetch month rows from _dpur
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: let query = db.from('dpur').select(...).gte('pur_date', startOfMonth).lte('pur_date', endOfMonth)
  const conditions: string[] = ['PurDate >= ? AND PurDate <= ?']
  const params: unknown[] = [startOfMonth, endOfMonth]
  if (filters.npp) {
    conditions.push('SiteCode = ?')
    params.push(filters.npp)
  }
  const sql = `
    SELECT Docno AS docno, SiteCode AS site_code, SiteName AS site_name,
           SKUCode AS sku_code, SKUName AS sku_name, PurDate AS pur_date,
           Trntyp AS trntyp, PRQty AS pr_qty, PRAmt AS pr_amt,
           PRTaxAmt AS pr_tax_amt, Program_ID AS program_id,
           Category AS category, Brand AS brand, Product AS product
    FROM \`_dpur\`
    WHERE ${conditions.join(' AND ')}
  `
  const rawRows = await query<DpurRow>(sql, params)
  const rows: DpurRow[] = rawRows.map(r => ({
    docno: r.docno,
    site_code: r.site_code,
    site_name: r.site_name,
    sku_code: r.sku_code,
    sku_name: r.sku_name,
    pur_date: r.pur_date,
    trntyp: r.trntyp,
    pr_qty: Number(r.pr_qty ?? 0),
    pr_amt: Number(r.pr_amt ?? 0),
    pr_tax_amt: Number(r.pr_tax_amt ?? 0),
    program_id: String(r.program_id ?? '0'),
    category: r.category || 'Khác',
    brand: r.brand || 'Khác',
    product: r.product || 'Khác',
  }))
```

The rest of the function (lines 123 onwards: `const receiveRows = ...` through the return) is unchanged.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/nhap-hang.ts
git commit -m "feat(mysql): migrate nhap-hang service to MySQL"
```

---

## Task 9: Migrate ton-kho.ts

**Files:**
- Modify: `lib/admin/services/ton-kho.ts`

The Supabase version used 2 stored procedures. Replaced with direct SQL + JS aggregation.

**Inventory calculation:** `qty = SUM(PRQty where Trntyp='I') - SUM(PRQty where Trntyp='D')` per SKU per site, up to `snapshot_date`. Unit price comes from `_product.LastCost`.

- [ ] **Step 1: Replace the entire file**

```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types (unchanged from original)
// ---------------------------------------------------------------------------

export interface TonKhoFilters {
  snapshot_date: string
  npp: string
  brand: string
  search: string
}

export interface TonKhoData {
  filter_options: {
    npps: Array<{ code: string; name: string }>
    brands: string[]
  }
  kpis: {
    total_value: number
    total_qty: number
    sku_in_stock: number
    total_sku: number
  }
  value_by_nhom: Array<{ name: string; value: number }>
  value_by_brand: Array<{ name: string; value: number }>
  value_by_category: Array<{ name: string; value: number }>
  qty_by_nhom: Array<{ name: string; value: number }>
  qty_by_brand: Array<{ name: string; value: number }>
  qty_by_category: Array<{ name: string; value: number }>
  products: Array<{
    sku_code: string
    sku_name: string
    qty: number
    product: string
    brand: string
    unit_price: number
    total_value: number
  }>
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface DpurInventoryRow {
  site_code: string
  sku_code: string
  sku_name: string
  category: string
  brand: string
  product: string
  recv_qty: number
  ret_qty: number
}

interface ProductPriceRow {
  sku_code: string
  site_code: string
  last_cost: number
}

interface NppRow {
  site_code: string
  site_name: string
}

interface BrandRow {
  brand: string
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getTonKhoData(filters: TonKhoFilters): Promise<TonKhoData> {
  // LEGACY SUPABASE: db.rpc('get_ton_kho_filter_options') + db.rpc('get_ton_kho_data', {...})

  // 1. Filter options in parallel
  const [nppRows, brandRows] = await Promise.all([
    query<NppRow>('SELECT SiteCode AS site_code, SiteName AS site_name FROM `_dpur` GROUP BY SiteCode, SiteName ORDER BY SiteName', []),
    query<BrandRow>('SELECT DISTINCT Brand AS brand FROM `_dpur` WHERE Brand IS NOT NULL ORDER BY Brand', []),
  ])

  const seen = new Map<string, string>()
  for (const r of nppRows) {
    const code = r.site_code?.trim()
    if (code && !seen.has(code)) seen.set(code, r.site_name?.trim() || code)
  }
  const npps = Array.from(seen.entries()).map(([code, name]) => ({ code, name }))
  const brands = brandRows.map(r => r.brand).filter(Boolean)

  // 2. Build inventory conditions
  const inventoryConditions: string[] = ['d.PurDate <= ?']
  const inventoryParams: unknown[] = [filters.snapshot_date]
  if (filters.npp) {
    inventoryConditions.push('d.SiteCode = ?')
    inventoryParams.push(filters.npp)
  }
  if (filters.brand) {
    inventoryConditions.push('d.Brand = ?')
    inventoryParams.push(filters.brand)
  }
  if (filters.search) {
    inventoryConditions.push('(d.SKUCode LIKE ? OR d.SKUName LIKE ?)')
    inventoryParams.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  // 3. Fetch cumulative received/returned per SKU per site
  const inventorySql = `
    SELECT
      d.SiteCode AS site_code,
      d.SKUCode AS sku_code,
      MAX(d.SKUName) AS sku_name,
      MAX(d.Category) AS category,
      MAX(d.Brand) AS brand,
      MAX(d.Product) AS product,
      SUM(CASE WHEN d.Trntyp = 'I' THEN d.PRQty ELSE 0 END) AS recv_qty,
      SUM(CASE WHEN d.Trntyp = 'D' THEN d.PRQty ELSE 0 END) AS ret_qty
    FROM \`_dpur\` d
    WHERE ${inventoryConditions.join(' AND ')}
    GROUP BY d.SiteCode, d.SKUCode
  `
  const inventoryRows = await query<DpurInventoryRow>(inventorySql, inventoryParams)

  // 4. Fetch prices from _product
  const priceConditions: string[] = []
  const priceParams: unknown[] = []
  if (filters.npp) {
    priceConditions.push('SiteCode = ?')
    priceParams.push(filters.npp)
  }
  const priceSql = `
    SELECT SiteCode AS site_code, SKUCode AS sku_code, LastCost AS last_cost
    FROM \`_product\`
    ${priceConditions.length > 0 ? 'WHERE ' + priceConditions.join(' AND ') : ''}
  `
  const priceRows = await query<ProductPriceRow>(priceSql, priceParams)
  const priceMap = new Map<string, number>()
  for (const p of priceRows) {
    const key = `${p.site_code}|${p.sku_code}`
    if (!priceMap.has(key)) priceMap.set(key, Number(p.last_cost ?? 0))
  }

  // 5. Build products list (net qty > 0 only)
  const total_sku = inventoryRows.length
  const products = inventoryRows
    .map(r => {
      const qty = Number(r.recv_qty ?? 0) - Number(r.ret_qty ?? 0)
      const unitPrice = priceMap.get(`${r.site_code}|${r.sku_code}`) ?? 0
      return {
        sku_code:    r.sku_code,
        sku_name:    r.sku_name,
        qty,
        product:     r.product  || 'Khác',
        brand:       r.brand    || 'Khác',
        category:    r.category || 'Khác',
        unit_price:  unitPrice,
        total_value: qty * unitPrice,
      }
    })
    .filter(p => p.qty > 0)

  // 6. KPIs
  const total_qty   = products.reduce((s, p) => s + p.qty, 0)
  const total_value = products.reduce((s, p) => s + p.total_value, 0)
  const sku_in_stock = products.length

  // 7. Group-by charts
  const groupBy = (key: 'product' | 'brand' | 'category', metric: 'qty' | 'total_value') => {
    const m = new Map<string, number>()
    for (const p of products) {
      const k = p[key] || 'Khác'
      m.set(k, (m.get(k) ?? 0) + p[metric])
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  return {
    filter_options: { npps, brands },
    kpis: { total_value, total_qty, sku_in_stock, total_sku },
    value_by_nhom:     groupBy('product',  'total_value'),
    value_by_brand:    groupBy('brand',    'total_value'),
    value_by_category: groupBy('category', 'total_value'),
    qty_by_nhom:       groupBy('product',  'qty'),
    qty_by_brand:      groupBy('brand',    'qty'),
    qty_by_category:   groupBy('category', 'qty'),
    products: products.map(({ category: _c, ...rest }) => rest),
  }
}

export const getTonKhoData = unstable_cache(
  _getTonKhoData,
  ['ton-kho'],
  { tags: ['ton-kho'], revalidate: 3600 }
)
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/ton-kho.ts
git commit -m "feat(mysql): migrate ton-kho service to MySQL"
```

---

## Task 10: Migrate khach-hang.ts

**Files:**
- Modify: `lib/admin/services/khach-hang.ts`

The 2 Supabase RPCs are replaced with direct `_door` queries + JS aggregation.

- [ ] **Step 1: Replace the entire file**

```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types (unchanged)
// ---------------------------------------------------------------------------

export interface KhachHangFilters { npp: string }

export interface CustomerBreakdown {
  type_code: string; type_name: string; count: number; pct: number
}
export interface PurchasingBreakdown {
  type_code: string; type_name: string; count: number; pct_of_total: number; pct_of_active: number
}
export interface CustomerGeoPoint {
  customer_key: string; customer_name: string; cust_class_key: string
  cust_class_name: string; lat: number; lng: number; province: string
  address: string; site_code: string
}
export interface KhachHangData {
  new_by_month: Array<{ month: string; count: number }>
  by_province: Array<{ name: string; count: number }>
  by_district: Array<{ name: string; count: number }>
  npp_options: Array<{ code: string; name: string }>
  all_customers: {
    kpis: { total: number; active_count: number; mapped_pct: number; geo_pct: number; type_count: number }
    breakdown: CustomerBreakdown[]
  }
  purchasing_customers: {
    kpis: { total_count: number; active_count: number; mapped_pct: number; geo_pct: number; type_count: number }
    breakdown: PurchasingBreakdown[]
  }
  geo_points: CustomerGeoPoint[]
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CustomerRow {
  customer_key: string
  customer_name: string
  cust_class_key: string | null
  cust_class_name: string | null
  lat: number | null
  lng: number | null
  province_name: string | null
  dist_province: string | null
  address: string | null
  ship_from_code: string | null
  first_date: string
  last_date: string
}

interface NppRow { code: string; name: string }

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getKhachHangData(filters: KhachHangFilters): Promise<KhachHangData> {
  // LEGACY SUPABASE: db.rpc('get_khach_hang_summary') + db.rpc('get_khach_hang_geo')

  const nppFilter = filters.npp ? ' AND ShipFromCode = ?' : ''
  const nppParam  = filters.npp ? [filters.npp] : []

  const [customerRows, nppRows] = await Promise.all([
    // 1. One row per distinct customer with their attributes and first/last purchase date
    query<CustomerRow>(`
      SELECT
        CustomerKey         AS customer_key,
        MAX(CustomerName)   AS customer_name,
        MAX(CustClassKey)   AS cust_class_key,
        MAX(CustClassName)  AS cust_class_name,
        MAX(Lat)            AS lat,
        MAX(\`Long\`)       AS lng,
        MAX(ProvinceName)   AS province_name,
        MAX(DistProvince)   AS dist_province,
        MAX(Address)        AS address,
        MAX(ShipFromCode)   AS ship_from_code,
        MIN(OffDate)        AS first_date,
        MAX(OffDate)        AS last_date
      FROM \`_door\`
      WHERE 1=1 ${nppFilter}
      GROUP BY CustomerKey
    `, nppParam),
    // 2. NPP options from _door
    query<NppRow>(
      'SELECT DISTINCT ShipFromCode AS code, ShipFromName AS name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ShipFromName',
      []
    ),
  ])

  const total = customerRows.length
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  const activeRows   = customerRows.filter(r => r.last_date >= cutoff)
  const mappedRows   = customerRows.filter(r => r.cust_class_key && r.cust_class_key.toUpperCase() !== 'OTHER')
  const geoRows      = customerRows.filter(r => r.lat && r.lng)

  // new_by_month: first purchase month per customer
  const monthCountMap = new Map<string, number>()
  for (const r of customerRows) {
    const mo = r.first_date.slice(0, 7)
    monthCountMap.set(mo, (monthCountMap.get(mo) ?? 0) + 1)
  }
  const new_by_month = Array.from(monthCountMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // by_province
  const provinceCounts = new Map<string, number>()
  for (const r of customerRows) {
    const p = r.province_name || 'Khác'
    provinceCounts.set(p, (provinceCounts.get(p) ?? 0) + 1)
  }
  const by_province = Array.from(provinceCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // by_district
  const districtCounts = new Map<string, number>()
  for (const r of customerRows) {
    const d = r.dist_province || 'Khác'
    districtCounts.set(d, (districtCounts.get(d) ?? 0) + 1)
  }
  const by_district = Array.from(districtCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // all_customers breakdown by type
  const typeMap = new Map<string, { code: string; name: string; count: number }>()
  for (const r of customerRows) {
    const code = r.cust_class_key || 'OTHER'
    const name = r.cust_class_name || 'Khác'
    const cur = typeMap.get(code)
    if (cur) cur.count++
    else typeMap.set(code, { code, name, count: 1 })
  }
  const allBreakdown: CustomerBreakdown[] = Array.from(typeMap.values()).map(t => ({
    type_code: t.code,
    type_name: t.name,
    count: t.count,
    pct: total > 0 ? Math.round((t.count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  // purchasing_customers breakdown (active customers only)
  const activeTotal = activeRows.length
  const activeTypeMap = new Map<string, { code: string; name: string; count: number }>()
  for (const r of activeRows) {
    const code = r.cust_class_key || 'OTHER'
    const name = r.cust_class_name || 'Khác'
    const cur = activeTypeMap.get(code)
    if (cur) cur.count++
    else activeTypeMap.set(code, { code, name, count: 1 })
  }
  const purchasingBreakdown: PurchasingBreakdown[] = Array.from(activeTypeMap.values()).map(t => ({
    type_code: t.code,
    type_name: t.name,
    count: t.count,
    pct_of_total:  total       > 0 ? Math.round((t.count / total)       * 100) : 0,
    pct_of_active: activeTotal > 0 ? Math.round((t.count / activeTotal) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  // geo_points
  const geo_points: CustomerGeoPoint[] = geoRows.map(r => ({
    customer_key:   r.customer_key,
    customer_name:  r.customer_name,
    cust_class_key: r.cust_class_key || 'OTHER',
    cust_class_name: r.cust_class_name || 'Khác',
    lat:     Number(r.lat),
    lng:     Number(r.lng),
    province: r.province_name || '',
    address:  r.address || '',
    site_code: r.ship_from_code || '',
  }))

  // npp_options dedup
  const nppSeen = new Map<string, string>()
  for (const r of nppRows) {
    if (r.code && !nppSeen.has(r.code)) nppSeen.set(r.code, r.name || r.code)
  }
  const npp_options = Array.from(nppSeen.entries()).map(([code, name]) => ({ code, name }))

  return {
    new_by_month,
    by_province,
    by_district,
    npp_options,
    all_customers: {
      kpis: {
        total,
        active_count: activeRows.length,
        mapped_pct:   total > 0 ? Math.round((mappedRows.length / total) * 100) : 0,
        geo_pct:      total > 0 ? Math.round((geoRows.length   / total) * 100) : 0,
        type_count:   typeMap.size,
      },
      breakdown: allBreakdown,
    },
    purchasing_customers: {
      kpis: {
        total_count:  activeTotal,
        active_count: activeTotal,
        mapped_pct:   activeTotal > 0 ? Math.round((activeRows.filter(r => r.cust_class_key && r.cust_class_key.toUpperCase() !== 'OTHER').length / activeTotal) * 100) : 0,
        geo_pct:      activeTotal > 0 ? Math.round((activeRows.filter(r => r.lat && r.lng).length / activeTotal) * 100) : 0,
        type_count:   activeTypeMap.size,
      },
      breakdown: purchasingBreakdown,
    },
    geo_points,
  }
}

export const getKhachHangData = unstable_cache(
  _getKhachHangData,
  ['khach-hang'],
  { tags: ['khach-hang'], revalidate: 3600 }
)
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/khach-hang.ts
git commit -m "feat(mysql): migrate khach-hang service to MySQL"
```

---

## Task 11: Migrate check-distributor.ts

**Files:**
- Modify: `lib/admin/services/check-distributor.ts`

The 3 Supabase RPCs are replaced with direct SQL queries.

- [ ] **Step 1: Replace the data fetch in `_getCheckDistributorData`**

Replace the imports:
```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'
import { getDpurGeoLookup, type DpurGeoEntry } from './dpur-geo'
```

Replace the `_getCheckDistributorData` function body (keeping the `matchGeo` helper and types unchanged):

```ts
async function _getCheckDistributorData(
  filters: CheckDistributorFilters
): Promise<CheckDistributorData> {
  // LEGACY SUPABASE: db.rpc('get_check_distributor_pivot', {...}) + db.rpc('get_check_distributor_filter_options', {...})

  // Build dynamic WHERE conditions
  const pivotConditions = ['YEAR(OffDate) = ?']
  const pivotParams: unknown[] = [filters.year]
  if (filters.system_type) { pivotConditions.push('V_Chanel = ?'); pivotParams.push(filters.system_type) }
  if (filters.ship_from) { pivotConditions.push('ShipFromCode = ?'); pivotParams.push(filters.ship_from) }
  if (filters.category) { pivotConditions.push('Category = ?'); pivotParams.push(filters.category) }
  if (filters.brand) { pivotConditions.push('Brand = ?'); pivotParams.push(filters.brand) }
  if (filters.search) {
    pivotConditions.push('(ShipFromCode LIKE ? OR ShipFromName LIKE ?)')
    pivotParams.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  const whereClause = 'WHERE ' + pivotConditions.join(' AND ')

  // Pivot SQL: monthly revenue per distributor
  interface PivotRow {
    distributor_code: string; distributor_name: string
    m1: number; m2: number; m3: number; m4: number
    m5: number; m6: number; m7: number; m8: number
    m9: number; m10: number; m11: number; m12: number
  }
  interface CountRow { total: number }
  interface OptRow { val: string }

  const pivotSql = `
    SELECT
      ShipFromCode AS distributor_code,
      ShipFromName AS distributor_name,
      SUM(CASE WHEN MONTH(OffDate) = 1  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m1,
      SUM(CASE WHEN MONTH(OffDate) = 2  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m2,
      SUM(CASE WHEN MONTH(OffDate) = 3  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m3,
      SUM(CASE WHEN MONTH(OffDate) = 4  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m4,
      SUM(CASE WHEN MONTH(OffDate) = 5  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m5,
      SUM(CASE WHEN MONTH(OffDate) = 6  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m6,
      SUM(CASE WHEN MONTH(OffDate) = 7  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m7,
      SUM(CASE WHEN MONTH(OffDate) = 8  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m8,
      SUM(CASE WHEN MONTH(OffDate) = 9  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m9,
      SUM(CASE WHEN MONTH(OffDate) = 10 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m10,
      SUM(CASE WHEN MONTH(OffDate) = 11 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m11,
      SUM(CASE WHEN MONTH(OffDate) = 12 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m12
    FROM \`_door\`
    ${whereClause}
    GROUP BY ShipFromCode, ShipFromName
    ORDER BY ShipFromName
    LIMIT ?, ?
  `
  const countSql = `SELECT COUNT(DISTINCT ShipFromCode) AS total FROM \`_door\` ${whereClause}`

  // Filter options SQL
  const optYear = [filters.year]
  const yearWhere = 'WHERE YEAR(OffDate) = ?'

  const [[pivotRows, countRows, sysTypeRows, shipFromRows, catRows, brandRows], dpurSites] = await Promise.all([
    Promise.all([
      query<PivotRow>(pivotSql, [...pivotParams, (filters.page - 1) * filters.page_size, filters.page_size]),
      query<CountRow>(countSql, pivotParams),
      query<OptRow>(`SELECT DISTINCT V_Chanel AS val FROM \`_door\` ${yearWhere} AND V_Chanel IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT ShipFromCode AS val FROM \`_door\` ${yearWhere} AND ShipFromCode IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT Category AS val FROM \`_door\` ${yearWhere} AND Category IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT Brand AS val FROM \`_door\` ${yearWhere} AND Brand IS NOT NULL ORDER BY val`, optYear),
    ]),
    getDpurGeoLookup(),
  ])

  const distributorData = pivotRows.map(row => {
    const geo = matchGeo(row.distributor_name, dpurSites)
    return {
      distributor_id:   row.distributor_code,
      region:           geo.region,
      zone:             geo.area,
      province:         geo.dist_province,
      distributor_code: row.distributor_code,
      distributor_name: row.distributor_name,
      monthly_data: {
        '1': row.m1, '2': row.m2, '3': row.m3, '4': row.m4,
        '5': row.m5, '6': row.m6, '7': row.m7, '8': row.m8,
        '9': row.m9, '10': row.m10, '11': row.m11, '12': row.m12,
      },
    }
  })

  return {
    distributors: {
      data:      distributorData,
      total:     Number(countRows[0]?.total ?? 0),
      page:      filters.page,
      page_size: filters.page_size,
    },
    filter_options: {
      system_types: sysTypeRows.map(r => r.val),
      ship_froms:   shipFromRows.map(r => r.val),
      categories:   catRows.map(r => r.val),
      brands:       brandRows.map(r => r.val),
    },
  }
}
```

Replace `getDistributorDetail` function:

```ts
export async function getDistributorDetail(
  id: string,
  month: number,
  year: number
): Promise<DistributorDetailData> {
  // LEGACY SUPABASE: db.rpc('get_check_distributor_detail', {...})
  interface DetailRow {
    staff_id: string; staff_name: string; day: number
    revenue: number; customer_count: number
  }
  interface NameRow { distributor_name: string }

  const [detailRows, nameRows] = await Promise.all([
    query<DetailRow>(`
      SELECT
        SalepersonKey   AS staff_id,
        SalepersonName  AS staff_name,
        DAY(OffDate)    AS day,
        SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS revenue,
        COUNT(DISTINCT CustomerKey) AS customer_count
      FROM \`_door\`
      WHERE ShipFromCode = ? AND YEAR(OffDate) = ? AND MONTH(OffDate) = ?
      GROUP BY SalepersonKey, SalepersonName, DAY(OffDate)
      ORDER BY SalepersonKey, DAY(OffDate)
    `, [id, year, month]),
    query<NameRow>(
      'SELECT MAX(ShipFromName) AS distributor_name FROM `_door` WHERE ShipFromCode = ? LIMIT 1',
      [id]
    ),
  ])

  const distributor_name = nameRows[0]?.distributor_name || id
  const lastDay = new Date(year, month, 0).getDate()

  // Group by staff
  const staffMap = new Map<string, { name: string; days: Map<number, { revenue: number; customer_count: number }> }>()
  for (const r of detailRows) {
    if (!staffMap.has(r.staff_id)) {
      staffMap.set(r.staff_id, { name: r.staff_name, days: new Map() })
    }
    staffMap.get(r.staff_id)!.days.set(r.day, {
      revenue: Number(r.revenue ?? 0),
      customer_count: Number(r.customer_count ?? 0),
    })
  }

  const staff = Array.from(staffMap.entries()).map(([sid, s]) => ({
    staff_id:   sid,
    staff_name: s.name,
    daily_data: Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1
      const day = s.days.get(d)
      return { day, revenue: day?.revenue ?? 0, customer_count: day?.customer_count ?? 0 }
    }),
  }))

  return { distributor_name, distributor_id: id, year, month, staff }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/check-distributor.ts
git commit -m "feat(mysql): migrate check-distributor service to MySQL"
```

---

## Task 12: Migrate check-customers.ts

**Files:**
- Modify: `lib/admin/services/check-customers.ts`

4 Supabase RPCs → direct SQL queries.

- [ ] **Step 1: Replace the entire file**

```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types (unchanged)
// ---------------------------------------------------------------------------

export interface CheckCustomersFilters {
  distributor_id: string; search: string; page: number; page_size: number
  customer_key_filter: string; customer_name_filter: string; province: string
  town: string; cust_class_key: string; has_geo: string
}
export interface CustClassOption { cust_class_key: string; cust_class_name: string }
export interface LocationHierarchy {
  provinces: string[]
  towns: Array<{ province_name: string; town_name: string }>
}
export interface CustomerRow {
  customer_key: string; customer_name: string; cust_class_key: string
  cust_class_name: string; address: string; town_name: string
  dist_province: string; province_name: string; lat: number | null
  long: number | null; ship_from_code: string; ship_from_name: string
}
export interface MapPin {
  customer_key: string; customer_name: string; cust_class_key: string
  cust_class_name: string; lat: number; long: number
}
export interface RevenuePivotRow { brand: string; month: string; revenue: number }
export interface CheckCustomersData {
  map_pins: MapPin[]
  customers: { data: CustomerRow[]; total: number; page: number; page_size: number }
  npp_options: Array<{ ship_from_code: string; ship_from_name: string }>
  cust_class_options: CustClassOption[]
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  // LEGACY SUPABASE: 4 parallel RPCs

  // Build conditions for main queries
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.distributor_id) { conditions.push('ShipFromCode = ?'); params.push(filters.distributor_id) }
  if (filters.search) {
    conditions.push('(CustomerKey LIKE ? OR CustomerName LIKE ?)')
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  if (filters.customer_key_filter) { conditions.push('CustomerKey LIKE ?'); params.push(`%${filters.customer_key_filter}%`) }
  if (filters.customer_name_filter) { conditions.push('CustomerName LIKE ?'); params.push(`%${filters.customer_name_filter}%`) }
  if (filters.province) { conditions.push('ProvinceName = ?'); params.push(filters.province) }
  if (filters.town) { conditions.push('TownName = ?'); params.push(filters.town) }
  if (filters.cust_class_key) { conditions.push('CustClassKey = ?'); params.push(filters.cust_class_key) }
  if (filters.has_geo === 'yes') conditions.push('Lat IS NOT NULL AND `Long` IS NOT NULL')
  if (filters.has_geo === 'no') conditions.push('(Lat IS NULL OR `Long` IS NULL)')

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  interface CustomerDbRow {
    customer_key: string; customer_name: string; cust_class_key: string
    cust_class_name: string; address: string; town_name: string
    dist_province: string; province_name: string; lat: number | null
    long: number | null; ship_from_code: string; ship_from_name: string
  }
  interface CountRow { total: number }
  interface MapPinRow {
    customer_key: string; customer_name: string; cust_class_key: string
    cust_class_name: string; lat: number; long: number
  }
  interface NppRow { ship_from_code: string; ship_from_name: string }
  interface ClassRow { cust_class_key: string; cust_class_name: string }

  const distinctCustomerSql = `
    SELECT
      CustomerKey         AS customer_key,
      MAX(CustomerName)   AS customer_name,
      MAX(CustClassKey)   AS cust_class_key,
      MAX(CustClassName)  AS cust_class_name,
      MAX(Address)        AS address,
      MAX(TownName)       AS town_name,
      MAX(DistProvince)   AS dist_province,
      MAX(ProvinceName)   AS province_name,
      MAX(Lat)            AS lat,
      MAX(\`Long\`)       AS \`long\`,
      MAX(ShipFromCode)   AS ship_from_code,
      MAX(ShipFromName)   AS ship_from_name
    FROM \`_door\`
    ${whereClause}
    GROUP BY CustomerKey
  `

  const [customersAll, nppRows, classRows] = await Promise.all([
    query<CustomerDbRow>(distinctCustomerSql, params),
    query<NppRow>('SELECT DISTINCT ShipFromCode AS ship_from_code, ShipFromName AS ship_from_name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ShipFromName', []),
    query<ClassRow>('SELECT DISTINCT CustClassKey AS cust_class_key, CustClassName AS cust_class_name FROM `_door` WHERE CustClassKey IS NOT NULL ORDER BY CustClassKey', []),
  ])

  const total = customersAll.length
  const offset = (filters.page - 1) * filters.page_size
  const pageData = customersAll.slice(offset, offset + filters.page_size)

  const map_pins: MapPin[] = customersAll
    .filter(r => r.lat && r.long)
    .map(r => ({
      customer_key:    r.customer_key,
      customer_name:   r.customer_name,
      cust_class_key:  r.cust_class_key || 'OTHER',
      cust_class_name: r.cust_class_name || 'Khác',
      lat:  Number(r.lat),
      long: Number(r.long),
    }))

  const npp_seen = new Map<string, string>()
  for (const r of nppRows) {
    if (!npp_seen.has(r.ship_from_code)) npp_seen.set(r.ship_from_code, r.ship_from_name)
  }
  const npp_options = Array.from(npp_seen.entries()).map(([ship_from_code, ship_from_name]) => ({ ship_from_code, ship_from_name }))

  const class_seen = new Map<string, string>()
  for (const r of classRows) {
    if (!class_seen.has(r.cust_class_key)) class_seen.set(r.cust_class_key, r.cust_class_name)
  }
  const cust_class_options = Array.from(class_seen.entries()).map(([cust_class_key, cust_class_name]) => ({ cust_class_key, cust_class_name }))

  return {
    map_pins,
    customers: { data: pageData as CustomerRow[], total, page: filters.page, page_size: filters.page_size },
    npp_options,
    cust_class_options,
  }
}

export const getCheckCustomersData = unstable_cache(
  _getCheckCustomersData,
  ['check-customers'],
  { tags: ['check-customers'], revalidate: 3600 }
)

// ---------------------------------------------------------------------------
// Location hierarchy for cascade dropdowns
// ---------------------------------------------------------------------------

export async function getCustomerLocations(): Promise<LocationHierarchy> {
  // LEGACY SUPABASE: db.rpc('get_check_customers_locations')
  interface LocRow { province_name: string; town_name: string }
  const rows = await query<LocRow>(
    'SELECT DISTINCT ProvinceName AS province_name, TownName AS town_name FROM `_door` WHERE ProvinceName IS NOT NULL ORDER BY ProvinceName, TownName',
    []
  )
  const provinces = [...new Set(rows.map(r => r.province_name).filter(Boolean))]
  const towns = rows.filter(r => r.town_name).map(r => ({ province_name: r.province_name, town_name: r.town_name }))
  return { provinces, towns }
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions
// ---------------------------------------------------------------------------

export async function getCustomerAutocomplete(
  field: 'customer_key' | 'customer_name',
  queryStr: string,
  limit = 10
): Promise<string[]> {
  // LEGACY SUPABASE: db.rpc('get_check_customers_autocomplete', {...})
  const col = field === 'customer_key' ? 'CustomerKey' : 'CustomerName'
  interface AutoRow { val: string }
  const rows = await query<AutoRow>(
    `SELECT DISTINCT ${col} AS val FROM \`_door\` WHERE ${col} LIKE ? ORDER BY ${col} LIMIT ?`,
    [`%${queryStr}%`, limit]
  )
  return rows.map(r => r.val)
}

// ---------------------------------------------------------------------------
// Per-customer revenue pivot
// ---------------------------------------------------------------------------

export async function getCustomerRevenue(customerKey: string): Promise<RevenuePivotRow[]> {
  // LEGACY SUPABASE: db.rpc('get_customer_revenue', { p_customer_key })
  interface RevenueRow { brand: string; month: string; revenue: number }
  return query<RevenueRow>(`
    SELECT
      Brand AS brand,
      DATE_FORMAT(OffDate, '%Y-%m') AS month,
      SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS revenue
    FROM \`_door\`
    WHERE CustomerKey = ?
    GROUP BY Brand, DATE_FORMAT(OffDate, '%Y-%m')
    ORDER BY month
  `, [customerKey])
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/check-customers.ts
git commit -m "feat(mysql): migrate check-customers service to MySQL"
```

---

## Task 13: Migrate ai-analysis route

**Files:**
- Modify: `app/api/ai-analysis/route.ts`

2 Supabase RPCs → direct SQL GROUP BY queries.

- [ ] **Step 1: Replace the data fetch block in route.ts**

Replace the imports:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { query } from '@/lib/mysql/client'
import {
  aggregateForGemini, buildGeminiPrompt, stripMarkdownWrapper, type MonthlyRow,
} from '@/lib/admin/services/ai-analysis'
```

Replace the data fetch inside `POST`:
```ts
// LEGACY SUPABASE: db.rpc('dashboard_door_monthly', {...}) + db.rpc('dashboard_dpur_monthly', {...})

interface DoorMonthlyRow { yr: number; mo: number; ban_hang: number }
interface DpurMonthlyRow { yr: number; mo: number; nhap_hang: number }

const [salesResult, purchaseResult] = await Promise.all([
  query<DoorMonthlyRow>(`
    SELECT YEAR(OffDate) AS yr, MONTH(OffDate) AS mo,
      SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang
    FROM \`_door\`
    GROUP BY YEAR(OffDate), MONTH(OffDate)
    ORDER BY yr, mo
  `, []),
  query<DpurMonthlyRow>(`
    SELECT YEAR(PurDate) AS yr, MONTH(PurDate) AS mo,
      SUM(CASE WHEN Trntyp = 'I' THEN PRAmt + PRTaxAmt ELSE -(PRAmt + PRTaxAmt) END) AS nhap_hang
    FROM \`_dpur\`
    GROUP BY YEAR(PurDate), MONTH(PurDate)
    ORDER BY yr, mo
  `, []),
])

const salesRows: MonthlyRow[] = salesResult.map(r => ({ year: r.yr, month: r.mo, value: r.ban_hang ?? 0 }))
const purchaseRows: MonthlyRow[] = purchaseResult.map(r => ({ year: r.yr, month: r.mo, value: r.nhap_hang ?? 0 }))
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai-analysis/route.ts
git commit -m "feat(mysql): migrate ai-analysis route to MySQL"
```

---

## Task 14: Migrate dashboard.ts

**Files:**
- Modify: `lib/admin/services/dashboard.ts`

The dashboard service already does most aggregation in JavaScript. The 9 Supabase calls (4 filter options, 4 aggregates, 1 total customers) + 5 direct table queries all map to direct MySQL queries with the same JS aggregation.

- [ ] **Step 1: Replace imports and the fetch block in `getDashboardData`**

Replace the top 3 imports:
```ts
import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'
import { computeMovingAverageForecast } from '@/lib/admin/forecast'
```

In `getDashboardData`, replace the entire section from line 220 (`let monthDoorQ = db.from('door')...`) through the closing `])` of `Promise.all` (around line 301), with:

```ts
  // Build conditions for month-scoped queries
  const doorMonthConds  = ['OffDate >= ?', 'OffDate <= ?']
  const doorMonthParams: unknown[] = [startOfMonth, endOfMonth]
  const dpurMonthConds  = ['PurDate >= ?', 'PurDate <= ?']
  const dpurMonthParams: unknown[] = [startOfMonth, endOfMonth]
  const doorPrevConds   = ['OffDate >= ?', 'OffDate <= ?']
  const doorPrevParams: unknown[] = [prevStartOfMonth, prevEndOfMonth]
  const dpurPrevConds   = ['PurDate >= ?', 'PurDate <= ?']
  const dpurPrevParams: unknown[] = [prevStartOfMonth, prevEndOfMonth]

  if (npp)   { doorMonthConds.push('ShipFromCode = ?'); doorMonthParams.push(npp); dpurMonthConds.push('SiteCode = ?'); dpurMonthParams.push(npp); doorPrevConds.push('ShipFromCode = ?'); doorPrevParams.push(npp); dpurPrevConds.push('SiteCode = ?'); dpurPrevParams.push(npp) }
  if (nganh) { doorMonthConds.push('Category = ?'); doorMonthParams.push(nganh); dpurMonthConds.push('Category = ?'); dpurMonthParams.push(nganh); doorPrevConds.push('Category = ?'); doorPrevParams.push(nganh); dpurPrevConds.push('Category = ?'); dpurPrevParams.push(nganh) }
  if (th)    { doorMonthConds.push('Brand = ?'); doorMonthParams.push(th); dpurMonthConds.push('Brand = ?'); dpurMonthParams.push(th); doorPrevConds.push('Brand = ?'); doorPrevParams.push(th); dpurPrevConds.push('Brand = ?'); dpurPrevParams.push(th) }
  if (kenh)  { doorMonthConds.push('V_Chanel = ?'); doorMonthParams.push(kenh); doorPrevConds.push('V_Chanel = ?'); doorPrevParams.push(kenh) }

  const doorWhere     = 'WHERE ' + doorMonthConds.join(' AND ')
  const dpurWhere     = 'WHERE ' + dpurMonthConds.join(' AND ')
  const doorPrevWhere = 'WHERE ' + doorPrevConds.join(' AND ')
  const dpurPrevWhere = 'WHERE ' + dpurPrevConds.join(' AND ')

  // Build year/monthly aggregate conditions (no date range, uses all-time)
  const aggConds: string[] = []
  const aggParams: unknown[] = []
  const dpurAggConds: string[] = []
  const dpurAggParams: unknown[] = []
  if (npp)   { aggConds.push('ShipFromCode = ?'); aggParams.push(npp); dpurAggConds.push('SiteCode = ?'); dpurAggParams.push(npp) }
  if (nganh) { aggConds.push('Category = ?'); aggParams.push(nganh); dpurAggConds.push('Category = ?'); dpurAggParams.push(nganh) }
  if (th)    { aggConds.push('Brand = ?'); aggParams.push(th); dpurAggConds.push('Brand = ?'); dpurAggParams.push(th) }
  if (kenh)  { aggConds.push('V_Chanel = ?'); aggParams.push(kenh) }
  const aggWhere     = aggConds.length     > 0 ? 'WHERE ' + aggConds.join(' AND ')     : ''
  const dpurAggWhere = dpurAggConds.length > 0 ? 'WHERE ' + dpurAggConds.join(' AND ') : ''

  interface NppRow    { ship_from_code: string; ship_from_name: string }
  interface CatRow    { category: string }
  interface BrandRow  { brand: string }
  interface ChanRow   { v_chanel: string }
  interface YearlyBanRow  { yr: number; ban_hang: number }
  interface YearlyNhapRow { yr: number; nhap_hang: number }
  interface MonthlyBanRow  { yr: number; mo: number; ban_hang: number }
  interface MonthlyNhapRow { yr: number; mo: number; nhap_hang: number }
  interface CountRow  { total: number }

  const [
    nppListRows, categoriesRows, brandsRows, channelsRows,
    doorYearlyRows, doorMonthlyRows, dpurYearlyRows, dpurMonthlyRows,
    monthDoorRows, monthDpurRows, prevDoorRows, prevDpurRows,
    skuCountRows, totalCustomersRows,
  ] = await Promise.all([
    // LEGACY SUPABASE: db.rpc('dashboard_npp_list')
    query<NppRow>('SELECT DISTINCT ShipFromCode AS ship_from_code, ShipFromName AS ship_from_name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ShipFromName', []),
    // LEGACY SUPABASE: db.rpc('dashboard_categories')
    query<CatRow>(`SELECT DISTINCT Category AS category FROM \`_door\` ${aggWhere} AND Category IS NOT NULL ORDER BY Category`, aggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_brands')
    query<BrandRow>(`SELECT DISTINCT Brand AS brand FROM \`_door\` ${aggWhere} AND Brand IS NOT NULL ORDER BY Brand`, aggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_channels')
    query<ChanRow>(`SELECT DISTINCT V_Chanel AS v_chanel FROM \`_door\` ${aggWhere} AND V_Chanel IS NOT NULL ORDER BY V_Chanel`, aggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_door_yearly', {...})
    query<YearlyBanRow>(`SELECT YEAR(OffDate) AS yr, SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang FROM \`_door\` ${aggWhere} GROUP BY yr ORDER BY yr`, aggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_door_monthly', {...})
    query<MonthlyBanRow>(`SELECT YEAR(OffDate) AS yr, MONTH(OffDate) AS mo, SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang FROM \`_door\` ${aggWhere} GROUP BY yr, mo ORDER BY yr, mo`, aggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_dpur_yearly', {...})
    query<YearlyNhapRow>(`SELECT YEAR(PurDate) AS yr, SUM(CASE WHEN Trntyp='I' THEN PRAmt+PRTaxAmt ELSE -(PRAmt+PRTaxAmt) END) AS nhap_hang FROM \`_dpur\` ${dpurAggWhere} GROUP BY yr ORDER BY yr`, dpurAggParams),
    // LEGACY SUPABASE: db.rpc('dashboard_dpur_monthly', {...})
    query<MonthlyNhapRow>(`SELECT YEAR(PurDate) AS yr, MONTH(PurDate) AS mo, SUM(CASE WHEN Trntyp='I' THEN PRAmt+PRTaxAmt ELSE -(PRAmt+PRTaxAmt) END) AS nhap_hang FROM \`_dpur\` ${dpurAggWhere} GROUP BY yr, mo ORDER BY yr, mo`, dpurAggParams),
    // LEGACY SUPABASE: monthDoorQ.range(0, 49999)
    query<DoorRow>(`
      SELECT SalepersonKey AS saleperson_key, SalepersonName AS saleperson_name,
             CustomerKey AS customer_key, CustomerName AS customer_name,
             CustClassKey AS cust_class_key, CustClassName AS cust_class_name,
             SKUCode AS sku_code, SKUName AS sku_name,
             Category AS category, Brand AS brand, Product AS product,
             OffDate AS off_date, OffQty AS off_qty, OffAmt AS off_amt,
             OffDsc AS off_dsc, OffTaxAmt AS off_tax_amt,
             Lat AS lat, \`Long\` AS \`long\`
      FROM \`_door\` ${doorWhere} LIMIT 50000
    `, doorMonthParams),
    // LEGACY SUPABASE: monthDpurQ.range(0, 49999)
    query<DpurRow>(`
      SELECT PurDate AS pur_date, PRQty AS pr_qty, PRAmt AS pr_amt,
             PRTaxAmt AS pr_tax_amt, Trntyp AS trntyp,
             SKUCode AS sku_code, SKUName AS sku_name,
             Category AS category, Brand AS brand, Product AS product
      FROM \`_dpur\` ${dpurWhere} LIMIT 50000
    `, dpurMonthParams),
    // LEGACY SUPABASE: prevDoorQ.range(0, 49999)
    query<{ off_date: string; off_qty: number; off_amt: number; off_dsc: number | null; off_tax_amt: number }>(`
      SELECT OffDate AS off_date, OffQty AS off_qty, OffAmt AS off_amt,
             OffDsc AS off_dsc, OffTaxAmt AS off_tax_amt
      FROM \`_door\` ${doorPrevWhere} LIMIT 50000
    `, doorPrevParams),
    // LEGACY SUPABASE: prevDpurQ.range(0, 49999)
    query<{ pur_date: string; pr_amt: number; pr_tax_amt: number; trntyp: string }>(`
      SELECT PurDate AS pur_date, PRAmt AS pr_amt, PRTaxAmt AS pr_tax_amt, Trntyp AS trntyp
      FROM \`_dpur\` ${dpurPrevWhere} LIMIT 50000
    `, dpurPrevParams),
    // LEGACY SUPABASE: db.from('product').select('sku_code', { count: 'exact', head: true })
    query<CountRow>('SELECT COUNT(*) AS total FROM `_product`', []),
    // LEGACY SUPABASE: db.rpc('dashboard_total_customer_count', {...})
    query<CountRow>(`SELECT COUNT(DISTINCT CustomerKey) AS total FROM \`_door\` ${aggWhere}`, aggParams),
  ])
```

Then replace the result extraction after `Promise.all`:

```ts
  // Adapt result shapes to match existing processing code
  const nppListResult   = { data: nppListRows }
  const categoriesResult = { data: categoriesRows }
  const brandsResult    = { data: brandsRows }
  const channelsResult  = { data: channelsRows }
  const doorYearlyResult  = { data: doorYearlyRows }
  const doorMonthlyResult = { data: doorMonthlyRows }
  const dpurYearlyResult  = { data: dpurYearlyRows }
  const dpurMonthlyResult = { data: dpurMonthlyRows }
  const skuTotalResult  = { count: Number(skuCountRows[0]?.total ?? 0) }
  const totalCustomersResult = { data: Number(totalCustomersRows[0]?.total ?? 0) }
```

And update section 2 (filter options) to use the new shape:

Replace `nppListResult.data ?? []` → `nppListRows`
Replace `categoriesResult.data ?? []` → `categoriesRows` 
Replace `brandsResult.data ?? []` → `brandsRows`
Replace `channelsResult.data ?? []` → `channelsRows`

Replace sections 3 and 4 data extraction:

Section 3 (yearly): replace `doorYearlyResult.data` → `doorYearlyRows`, `dpurYearlyResult.data` → `dpurYearlyRows`
Section 4 (monthly): replace `doorMonthlyResult.data` → `doorMonthlyRows`, `dpurMonthlyResult.data` → `dpurMonthlyRows`
Section 5 (row data): replace `monthDoorResult.data` → `monthDoorRows`, `monthDpurResult.data` → `monthDpurRows`, etc.
Section 7 (metrics_box): replace `skuTotalResult.count` → `Number(skuCountRows[0]?.total ?? 0)`, `totalCustomersResult.data` → `Number(totalCustomersRows[0]?.total ?? 0)`

Also rename row types so they match: Section 3 uses `row.yr`, `row.ban_hang` — these match the aliases.

The channel/brand/category processing uses `.map((r: { v_chanel: string }) => r.v_chanel)` etc — these match the aliases.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/services/dashboard.ts
git commit -m "feat(mysql): migrate dashboard service to MySQL"
```

---

## Task 15: Settings Hybrid + Refresh No-op

**Files:**
- Modify: `app/admin/settings/page.tsx`
- Modify: `app/admin/_actions/refresh-views.ts`

### settings/page.tsx: Remove `mv_dashboard_kpis` query

Replace the `mv_dashboard_kpis` query block:
```ts
// LEGACY SUPABASE: const { data: kpis } = await svc.from('mv_dashboard_kpis').select('refreshed_at').single()
const refreshedAt = 'N/A — MySQL migration active'
```

Remove the `const svc = createServiceClient()` line if no longer needed (the `profiles` query still uses it).

### refresh-views.ts: Remove MySQL-unneeded view refresh

The `refresh_admin_views` RPC no longer makes sense since there are no MySQL materialized views. Replace the function body:

```ts
'use server'

import { revalidateTag } from 'next/cache'

export async function refreshMaterializedViews() {
  // LEGACY SUPABASE: svc.rpc('refresh_admin_views') — MySQL has no materialized views to refresh
  // Cache invalidation still happens to force fresh data on next load

  revalidateTag('dashboard-fast')
  revalidateTag('dashboard-slow')
  revalidateTag('nhap-hang')
  revalidateTag('ton-kho')
  revalidateTag('khach-hang')
  revalidateTag('check-customers')
  revalidateTag('check-distributor')

  return { success: true as const }
}
```

- [ ] **Step 1: Apply settings/page.tsx change**

In `app/admin/settings/page.tsx`, replace:
```ts
  const { data: kpis } = await svc
    .from('mv_dashboard_kpis')
    .select('refreshed_at')
    .single()

  const refreshedAt = kpis?.refreshed_at
    ? new Date(kpis.refreshed_at).toLocaleString('vi-VN')
    : 'Chua co du lieu'
```
With:
```ts
  // LEGACY SUPABASE: mv_dashboard_kpis view no longer exists in MySQL
  const refreshedAt = 'MySQL migration active'
```

- [ ] **Step 2: Apply refresh-views.ts change**

Replace entire `app/admin/_actions/refresh-views.ts` content with:

```ts
'use server'

import { revalidateTag } from 'next/cache'

export async function refreshMaterializedViews() {
  // LEGACY SUPABASE: svc.rpc('refresh_admin_views') — no materialized views in MySQL

  revalidateTag('dashboard-fast')
  revalidateTag('dashboard-slow')
  revalidateTag('nhap-hang')
  revalidateTag('ton-kho')
  revalidateTag('khach-hang')
  revalidateTag('check-customers')
  revalidateTag('check-distributor')

  return { success: true as const }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/settings/page.tsx app/admin/_actions/refresh-views.ts
git commit -m "feat(mysql): settings hybrid + remove refresh-views Supabase RPC"
```

---

## Task 16: Full Verification

**Goal:** Confirm the migrated app renders real data from MySQL.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open each admin page and verify data loads**

Open browser and check:
- `/admin/dashboard` — charts render, KPI numbers are non-zero
- `/admin/nhap-hang` — orders table shows rows, KPI cards non-zero
- `/admin/ton-kho` — products list visible
- `/admin/khach-hang` — charts render
- `/admin/check-customers` — customer list loads, map renders
- `/admin/check-distributor` — pivot table renders
- `/admin/settings` — shows "MySQL migration active"

- [ ] **Step 3: Review .mysql-audit.log**

```bash
tail -20 .mysql-audit.log
```

Expected: entries showing actual SQL queries being executed.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:all
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(mysql): complete migration — all services using MySQL client"
```

---

## Appendix: aggWhere edge case fix

In Task 14 (dashboard.ts), the `aggWhere` conditions query for `AND Category IS NOT NULL` after the WHERE clause. However, if `aggWhere` is empty string, the `AND` will cause a syntax error. Fix by pre-checking:

For the categories query, use:
```ts
const catFilter = aggConds.length > 0
  ? 'WHERE ' + aggConds.join(' AND ') + ' AND Category IS NOT NULL'
  : 'WHERE Category IS NOT NULL'
query<CatRow>(`SELECT DISTINCT Category AS category FROM \`_door\` ${catFilter} ORDER BY Category`, aggParams),
```

Apply the same pattern for brands and channels.
