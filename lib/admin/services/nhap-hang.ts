import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NhapHangFilters {
  npp: string    // supplier_id or empty string for all
  year: number
  month: number
}

export interface NhapHangData {
  kpis: {
    total_revenue: number
    total_quantity: number
    total_promo_qty: number
    total_orders: number
    total_skus: number
    avg_per_order: number
  }
  daily_revenue: Array<{ day: number; revenue: number }>
  daily_quantity: Array<{ day: number; quantity: number; promo_qty: number }>
  orders: Array<{
    order_code: string
    order_date: string    // YYYY/MM/DD slash format
    total_amount: number
    supplier_name: string
  }>
  order_items: Record<string, Array<{
    product_code: string
    product_name: string
    quantity: number
    promo_qty: number
    unit_price: number
    subtotal: number
  }>>
  top_products: Array<{
    product_code: string
    product_name: string
    total_revenue: number
  }>
  by_industry: Array<{ name: string; revenue: number }>
  by_product_group: Array<{ name: string; revenue: number }>
  by_brand: Array<{ name: string; revenue: number }>
  suppliers: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getNhapHangData(
  filters: NhapHangFilters
): Promise<NhapHangData> {
  const db = createServiceClient()

  // 1. Fetch suppliers list (always, for dropdown)
  const { data: supplierRows } = await db
    .from('suppliers')
    .select('id, supplier_name')
    .order('supplier_code')

  const suppliers = (supplierRows ?? []).map(s => ({
    id: s.id as string,
    name: s.supplier_name as string,
  }))

  // Build supplier id -> name map
  const supplierNameMap = new Map(suppliers.map(s => [s.id, s.name]))

  // 2. Fetch orders for month/npp
  const startOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const endOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-${new Date(filters.year, filters.month, 0).getDate()}`

  let orderQuery = db
    .from('purchase_orders')
    .select('id, order_code, order_date, supplier_id, total_amount')
    .gte('order_date', startOfMonth)
    .lte('order_date', endOfMonth)
    .order('order_date', { ascending: true })

  if (filters.npp) {
    orderQuery = orderQuery.eq('supplier_id', filters.npp)
  }

  const { data: orderRows } = await orderQuery

  const matchedOrders = orderRows ?? []
  const orderIds = matchedOrders.map(o => o.id as string)

  // 3. Fetch all order items for matched orders + join products
  let allItems: Array<{
    order_id: string
    product_id: string
    quantity: number
    promo_qty: number
    unit_price: number
    subtotal: number
  }> = []

  if (orderIds.length > 0) {
    const { data: itemRows } = await db
      .from('purchase_order_items')
      .select('order_id, product_id, quantity, promo_qty, unit_price, subtotal')
      .in('order_id', orderIds)

    allItems = (itemRows ?? []).map(r => ({
      order_id: r.order_id as string,
      product_id: r.product_id as string,
      quantity: Number(r.quantity),
      promo_qty: Number(r.promo_qty),
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
    }))
  }

  // Fetch products for lookup
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

  // Build order_code -> order_id map and order_id -> order_date map
  const orderCodeMap = new Map(matchedOrders.map(o => [o.id as string, o.order_code as string]))
  const orderDateMap = new Map(matchedOrders.map(o => [o.id as string, o.order_date as string]))

  // 4. Compute KPIs from items
  let total_revenue = 0
  let total_quantity = 0
  let total_promo_qty = 0
  const skuSet = new Set<string>()

  for (const item of allItems) {
    total_revenue += item.quantity * item.unit_price
    total_quantity += item.quantity
    total_promo_qty += item.promo_qty
    skuSet.add(item.product_id)
  }

  const total_orders = matchedOrders.length
  const total_skus = skuSet.size
  const avg_per_order = total_orders > 0 ? Math.round(total_revenue / total_orders) : 0

  // 5. Compute daily_revenue: group items by order date's day
  const dailyRevenueMap = new Map<number, number>()
  for (const item of allItems) {
    const dateStr = orderDateMap.get(item.order_id) ?? ''
    const day = new Date(dateStr).getDate()
    dailyRevenueMap.set(day, (dailyRevenueMap.get(day) ?? 0) + item.quantity * item.unit_price)
  }
  const daily_revenue = Array.from(dailyRevenueMap.entries())
    .map(([day, revenue]) => ({ day, revenue }))
    .sort((a, b) => a.day - b.day)

  // 6. Compute daily_quantity: group items by order date's day
  const dailyQtyMap = new Map<number, { quantity: number; promo_qty: number }>()
  for (const item of allItems) {
    const dateStr = orderDateMap.get(item.order_id) ?? ''
    const day = new Date(dateStr).getDate()
    const existing = dailyQtyMap.get(day) ?? { quantity: 0, promo_qty: 0 }
    existing.quantity += item.quantity
    existing.promo_qty += item.promo_qty
    dailyQtyMap.set(day, existing)
  }
  const daily_quantity = Array.from(dailyQtyMap.entries())
    .map(([day, { quantity, promo_qty }]) => ({ day, quantity, promo_qty }))
    .sort((a, b) => a.day - b.day)

  // 7. Build order_items map: Record<order_code, items[]>
  const order_items: Record<string, Array<{
    product_code: string
    product_name: string
    quantity: number
    promo_qty: number
    unit_price: number
    subtotal: number
  }>> = {}

  for (const order of matchedOrders) {
    const code = order.order_code as string
    const orderId = order.id as string
    const items = allItems
      .filter(i => i.order_id === orderId)
      .map(i => {
        const product = productMap.get(i.product_id)
        return {
          product_code: product?.product_code ?? '',
          product_name: product?.product_name ?? '',
          quantity: i.quantity,
          promo_qty: i.promo_qty,
          unit_price: i.unit_price,
          subtotal: i.quantity * i.unit_price,
        }
      })
    order_items[code] = items
  }

  // 8. Compute top_products: group by product, sum revenue, top 10
  const productRevenue = new Map<string, { code: string; name: string; revenue: number }>()
  for (const item of allItems) {
    const product = productMap.get(item.product_id)
    if (!product) continue
    const existing = productRevenue.get(item.product_id)
    const rev = item.quantity * item.unit_price
    if (existing) {
      existing.revenue += rev
    } else {
      productRevenue.set(item.product_id, {
        code: product.product_code,
        name: product.product_name,
        revenue: rev,
      })
    }
  }
  const top_products = Array.from(productRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(p => ({
      product_code: p.code,
      product_name: p.name,
      total_revenue: p.revenue,
    }))

  // 9. Compute by_industry: group by product_group
  const industryMap = new Map<string, number>()
  for (const item of allItems) {
    const product = productMap.get(item.product_id)
    if (!product) continue
    const group = product.product_group || 'Khác'
    industryMap.set(group, (industryMap.get(group) ?? 0) + item.quantity * item.unit_price)
  }
  const by_industry = Array.from(industryMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // 10. Compute by_product_group: group by classification
  const classificationMap = new Map<string, number>()
  for (const item of allItems) {
    const product = productMap.get(item.product_id)
    if (!product) continue
    const cls = product.classification || 'Khác'
    classificationMap.set(cls, (classificationMap.get(cls) ?? 0) + item.quantity * item.unit_price)
  }
  const by_product_group = Array.from(classificationMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // 11. Compute by_brand: group by manufacturer
  const brandMap = new Map<string, number>()
  for (const item of allItems) {
    const product = productMap.get(item.product_id)
    if (!product) continue
    const brand = product.manufacturer || 'Khác'
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + item.quantity * item.unit_price)
  }
  const by_brand = Array.from(brandMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // Build orders array with YYYY/MM/DD slash format
  const orders = matchedOrders.map(o => ({
    order_code: o.order_code as string,
    order_date: (o.order_date as string).replace(/-/g, '/'),
    total_amount: Number(o.total_amount),
    supplier_name: supplierNameMap.get(o.supplier_id as string) ?? '',
  }))

  return {
    kpis: {
      total_revenue,
      total_quantity,
      total_promo_qty,
      total_orders,
      total_skus,
      avg_per_order,
    },
    daily_revenue,
    daily_quantity,
    orders,
    order_items,
    top_products,
    by_industry,
    by_product_group,
    by_brand,
    suppliers,
  }
}
