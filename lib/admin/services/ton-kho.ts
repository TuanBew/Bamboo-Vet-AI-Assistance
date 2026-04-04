import { createServiceClient } from '@/lib/supabase/server'

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
    total_value: number       // SUM(qty * unit_price) for latest snapshots
    total_qty: number         // SUM(qty)
    sku_in_stock: number      // COUNT where qty > 0
    total_sku: number         // total product count
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
    product: string      // nganh hang (inloc.product column)
    brand: string        // thuong hieu
    unit_price: number   // last_cost from product table
    total_value: number
  }>
}

// ---------------------------------------------------------------------------
// Row types from real tables
// ---------------------------------------------------------------------------

interface InlocRow {
  site_code: string
  site_name: string
  sku_code: string
  sku_name: string
  inv_date: string
  onhand_qty: number
  category: string   // nhom
  brand: string      // thuong hieu
  product: string    // nganh hang
}

interface ProductRow {
  site_code: string
  sku_code: string
  last_cost: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number
): Array<{ name: string; value: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item) || 'Khac'
    map.set(key, (map.get(key) ?? 0) + valueFn(item))
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getTonKhoData(
  filters: TonKhoFilters
): Promise<TonKhoData> {
  const db = createServiceClient()

  // Step A: Get filter options (always, regardless of filters)
  // Fetch distinct NPPs
  const { data: nppRows } = await db
    .from('inloc')
    .select('site_code, site_name')

  const nppMap = new Map<string, string>()
  for (const row of nppRows ?? []) {
    if (row.site_code && row.site_name) {
      nppMap.set(row.site_code as string, row.site_name as string)
    }
  }
  const npps = Array.from(nppMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Fetch distinct brands from a separate query
  const { data: brandRows } = await db
    .from('inloc')
    .select('brand')

  const brandSet = new Set<string>()
  for (const row of brandRows ?? []) {
    const b = row.brand as string | null
    if (b && b.trim()) brandSet.add(b.trim())
  }
  const brands = Array.from(brandSet).sort()

  // Step B+C combined: Fetch all inloc rows <= snapshot_date, deduplicate in JS
  // Paginate to handle large datasets
  const PAGE_SIZE = 1000
  let allInlocRows: InlocRow[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    let query = db
      .from('inloc')
      .select('site_code, site_name, sku_code, sku_name, inv_date, onhand_qty, category, brand, product')
      .lte('inv_date', filters.snapshot_date)

    if (filters.npp) {
      query = query.eq('site_code', filters.npp)
    }

    const { data: pageRows, error } = await query.range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Inloc query error:', error)
      break
    }

    const rows = (pageRows ?? []) as unknown as InlocRow[]
    allInlocRows = allInlocRows.concat(rows)

    if (rows.length < PAGE_SIZE) {
      hasMore = false
    } else {
      offset += PAGE_SIZE
    }
  }

  // Find latest inv_date per (site_code, sku_code)
  const latestDateMap = new Map<string, string>()
  for (const row of allInlocRows) {
    const key = `${row.site_code}|${row.sku_code}`
    const existing = latestDateMap.get(key)
    if (!existing || row.inv_date > existing) {
      latestDateMap.set(key, row.inv_date)
    }
  }

  // Filter to only rows matching latest date, SUM onhand_qty per (site_code, sku_code)
  interface AggItem {
    site_code: string
    sku_code: string
    sku_name: string
    qty: number
    category: string
    brand: string
    product: string
  }

  const aggMap = new Map<string, AggItem>()
  for (const row of allInlocRows) {
    const key = `${row.site_code}|${row.sku_code}`
    if (row.inv_date !== latestDateMap.get(key)) continue

    const existing = aggMap.get(key)
    if (existing) {
      existing.qty += Number(row.onhand_qty) || 0
    } else {
      aggMap.set(key, {
        site_code: row.site_code,
        sku_code: row.sku_code,
        sku_name: row.sku_name,
        qty: Number(row.onhand_qty) || 0,
        category: row.category || '',
        brand: row.brand || '',
        product: row.product || '',
      })
    }
  }

  // Step D: Join with product table for last_cost
  let allProductRows: ProductRow[] = []
  offset = 0
  hasMore = true

  while (hasMore) {
    let query = db
      .from('product')
      .select('site_code, sku_code, last_cost')

    if (filters.npp) {
      query = query.eq('site_code', filters.npp)
    }

    const { data: pageRows, error } = await query.range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Product query error:', error)
      break
    }

    const rows = (pageRows ?? []) as unknown as ProductRow[]
    allProductRows = allProductRows.concat(rows)

    if (rows.length < PAGE_SIZE) {
      hasMore = false
    } else {
      offset += PAGE_SIZE
    }
  }

  const costMap = new Map<string, number>()
  for (const row of allProductRows) {
    const key = `${row.site_code}|${row.sku_code}`
    costMap.set(key, Number(row.last_cost) || 0)
  }

  // Step E: Apply brand and search filters, build joined items
  type JoinedItem = {
    sku_code: string
    sku_name: string
    qty: number
    category: string  // nhom
    brand: string     // thuong hieu
    product: string   // nganh hang
    unit_price: number
    total_value: number
  }

  const joinedItems: JoinedItem[] = []
  for (const [key, agg] of aggMap) {
    // Apply brand filter
    if (filters.brand && agg.brand !== filters.brand) continue

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchCode = agg.sku_code.toLowerCase().includes(searchLower)
      const matchName = agg.sku_name.toLowerCase().includes(searchLower)
      if (!matchCode && !matchName) continue
    }

    const unit_price = costMap.get(key) ?? 0
    joinedItems.push({
      sku_code: agg.sku_code,
      sku_name: agg.sku_name,
      qty: agg.qty,
      category: agg.category,
      brand: agg.brand,
      product: agg.product,
      unit_price,
      total_value: agg.qty * unit_price,
    })
  }

  // Step F: Compute KPIs
  let total_value = 0
  let total_qty = 0
  let sku_in_stock = 0
  const total_sku = joinedItems.length

  for (const item of joinedItems) {
    total_value += item.total_value
    total_qty += item.qty
    if (item.qty > 0) sku_in_stock++
  }

  // Step G: Compute chart aggregations
  const value_by_nhom = groupBy(joinedItems, i => i.category, i => i.total_value)
  const value_by_brand = groupBy(joinedItems, i => i.brand, i => i.total_value)
  const value_by_category = groupBy(joinedItems, i => i.product, i => i.total_value)
  const qty_by_nhom = groupBy(joinedItems, i => i.category, i => i.qty)
  const qty_by_brand = groupBy(joinedItems, i => i.brand, i => i.qty)
  const qty_by_category = groupBy(joinedItems, i => i.product, i => i.qty)

  // Step H: Build products array, sorted by total_value DESC
  const products = joinedItems
    .map(item => ({
      sku_code: item.sku_code,
      sku_name: item.sku_name,
      qty: item.qty,
      product: item.product,
      brand: item.brand,
      unit_price: item.unit_price,
      total_value: item.total_value,
    }))
    .sort((a, b) => b.total_value - a.total_value)

  return {
    filter_options: { npps, brands },
    kpis: { total_value, total_qty, sku_in_stock, total_sku },
    value_by_nhom,
    value_by_brand,
    value_by_category,
    qty_by_nhom,
    qty_by_brand,
    qty_by_category,
    products,
  }
}
