import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TonKhoFilters {
  snapshot_date: string   // YYYY-MM-DD, default today
  npp: string             // site_code filter, empty = all
  brand: string           // brand filter, empty = all
  search: string          // product name/code search
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

  // 1. Filter options
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
  type ProductEntry = {
    sku_code: string; sku_name: string; qty: number
    product: string; brand: string; category: string
    unit_price: number; total_value: number
  }
  const products: ProductEntry[] = inventoryRows
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
