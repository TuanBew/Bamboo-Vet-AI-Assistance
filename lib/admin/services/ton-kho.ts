import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TonKhoFilters {
  snapshot_date: string  // YYYY-MM-DD, default today
  nhom: string           // product_group filter, empty = all
  search: string         // product name/code search
}

export interface TonKhoData {
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
    product_code: string
    product_name: string
    qty: number
    min_stock: number
    last_import_date: string
    unit_price: number
    total_value: number
  }>
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getTonKhoData(
  filters: TonKhoFilters
): Promise<TonKhoData> {
  const db = createServiceClient()

  // 1. Fetch latest snapshots per product (on or before snapshot_date)
  const { data: snapshots } = await db
    .from('inventory_snapshots')
    .select('product_id, snapshot_date, qty, unit_price')
    .lte('snapshot_date', filters.snapshot_date)
    .order('snapshot_date', { ascending: false })

  // Deduplicate: keep only latest snapshot per product
  const latestByProduct = new Map<string, { product_id: string; snapshot_date: string; qty: number; unit_price: number }>()
  for (const snap of snapshots ?? []) {
    const pid = snap.product_id as string
    if (!latestByProduct.has(pid)) {
      latestByProduct.set(pid, {
        product_id: pid,
        snapshot_date: snap.snapshot_date as string,
        qty: Number(snap.qty),
        unit_price: Number(snap.unit_price),
      })
    }
  }

  // 2. Fetch products for grouping info
  const { data: productRows } = await db
    .from('products')
    .select('id, product_code, product_name, product_group, classification, manufacturer')

  const productMap = new Map(
    (productRows ?? []).map(p => [
      p.id as string,
      {
        product_code: p.product_code as string,
        product_name: p.product_name as string,
        product_group: p.product_group as string,
        classification: p.classification as string,
        manufacturer: p.manufacturer as string,
      },
    ])
  )

  // 3. Fetch last import dates from purchase_order_items
  const { data: orderItems } = await db
    .from('purchase_order_items')
    .select('product_id, order_id')

  const { data: orders } = await db
    .from('purchase_orders')
    .select('id, order_date')

  // Build order_id -> order_date map
  const orderDateMap = new Map(
    (orders ?? []).map(o => [o.id as string, o.order_date as string])
  )

  // Group by product_id, take MAX order_date
  const lastImportMap = new Map<string, string>()
  for (const item of orderItems ?? []) {
    const pid = item.product_id as string
    const orderDate = orderDateMap.get(item.order_id as string) ?? ''
    if (!orderDate) continue
    const existing = lastImportMap.get(pid) ?? ''
    if (orderDate > existing) {
      lastImportMap.set(pid, orderDate)
    }
  }

  // 4. Join snapshots with product info, apply filters
  type JoinedProduct = {
    product_code: string
    product_name: string
    product_group: string
    classification: string
    manufacturer: string
    qty: number
    unit_price: number
    total_value: number
    last_import_date: string
  }

  const joinedProducts: JoinedProduct[] = []
  for (const [productId, snap] of latestByProduct) {
    const product = productMap.get(productId)
    if (!product) continue

    // Apply nhom filter
    if (filters.nhom && product.product_group !== filters.nhom) continue

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchCode = product.product_code.toLowerCase().includes(searchLower)
      const matchName = product.product_name.toLowerCase().includes(searchLower)
      if (!matchCode && !matchName) continue
    }

    joinedProducts.push({
      product_code: product.product_code,
      product_name: product.product_name,
      product_group: product.product_group,
      classification: product.classification,
      manufacturer: product.manufacturer,
      qty: snap.qty,
      unit_price: snap.unit_price,
      total_value: snap.qty * snap.unit_price,
      last_import_date: lastImportMap.get(productId) ?? 'N/A',
    })
  }

  // 5. Compute KPIs
  let total_value = 0
  let total_qty = 0
  let sku_in_stock = 0
  const total_sku = joinedProducts.length

  for (const p of joinedProducts) {
    total_value += p.total_value
    total_qty += p.qty
    if (p.qty > 0) sku_in_stock++
  }

  // 6. Compute chart aggregations
  const groupBy = (
    items: JoinedProduct[],
    keyFn: (p: JoinedProduct) => string,
    valueFn: (p: JoinedProduct) => number
  ): Array<{ name: string; value: number }> => {
    const map = new Map<string, number>()
    for (const item of items) {
      const key = keyFn(item) || 'Khac'
      map.set(key, (map.get(key) ?? 0) + valueFn(item))
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }

  const value_by_nhom = groupBy(joinedProducts, p => p.product_group, p => p.total_value)
  const value_by_brand = groupBy(joinedProducts, p => p.classification, p => p.total_value)
  const value_by_category = groupBy(joinedProducts, p => p.manufacturer, p => p.total_value)
  const qty_by_nhom = groupBy(joinedProducts, p => p.product_group, p => p.qty)
  const qty_by_brand = groupBy(joinedProducts, p => p.classification, p => p.qty)
  const qty_by_category = groupBy(joinedProducts, p => p.manufacturer, p => p.qty)

  // 7. Build products list
  const products = joinedProducts.map(p => ({
    product_code: p.product_code,
    product_name: p.product_name,
    qty: p.qty,
    min_stock: 10,
    last_import_date: p.last_import_date,
    unit_price: p.unit_price,
    total_value: p.total_value,
  }))

  return {
    kpis: {
      total_value,
      total_qty,
      sku_in_stock,
      total_sku,
    },
    value_by_nhom,
    value_by_brand,
    value_by_category,
    qty_by_nhom,
    qty_by_brand,
    qty_by_category,
    products,
  }
}
