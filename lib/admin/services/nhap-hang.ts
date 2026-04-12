import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { getNppOptions } from './npp-options'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NhapHangFilters {
  npp: string   // site_code or empty string for all
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
// Row type from dpur table
// ---------------------------------------------------------------------------

interface DpurRow {
  docno: string
  site_code: string
  site_name: string
  sku_code: string
  sku_name: string
  pur_date: string          // YYYY-MM-DD
  trntyp: string            // 'I' = receive, 'D' = return to supplier
  pr_qty: number
  pr_amt: number
  pr_tax_amt: number
  program_id: string        // '0' = regular, anything else = promo/free
  category: string          // ngành hàng
  brand: string             // thương hiệu
  product: string           // nhóm sản phẩm
}

// Revenue for a single row (regular receive only)
function calcRowRevenue(row: DpurRow): number {
  return row.pr_amt + row.pr_tax_amt
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getNhapHangData(
  filters: NhapHangFilters
): Promise<NhapHangData> {
  const db = createServiceClient()

  const startOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const lastDay = new Date(filters.year, filters.month, 0).getDate()
  const endOfMonth = `${filters.year}-${String(filters.month).padStart(2, '0')}-${lastDay}`

  // 1. Get NPP list (always all, for dropdown) — 24h cached
  const nppOptions = await getNppOptions()
  const suppliers = nppOptions.map(o => ({ id: o.site_code, name: o.site_name }))

  // 2. Fetch month rows from dpur
  let query = db
    .from('dpur')
    .select('docno,site_code,site_name,sku_code,sku_name,pur_date,trntyp,pr_qty,pr_amt,pr_tax_amt,program_id,category,brand,product')
    .gte('pur_date', startOfMonth)
    .lte('pur_date', endOfMonth)

  if (filters.npp) {
    query = query.eq('site_code', filters.npp)
  }

  const { data: rawRows } = await query
  const rows: DpurRow[] = (rawRows ?? []).map(r => ({
    docno: r.docno as string,
    site_code: r.site_code as string,
    site_name: r.site_name as string,
    sku_code: r.sku_code as string,
    sku_name: r.sku_name as string,
    pur_date: r.pur_date as string,
    trntyp: r.trntyp as string,
    pr_qty: Number(r.pr_qty ?? 0),
    pr_amt: Number(r.pr_amt ?? 0),
    pr_tax_amt: Number(r.pr_tax_amt ?? 0),
    program_id: String(r.program_id ?? '0'),
    category: r.category as string || 'Khác',
    brand: r.brand as string || 'Khác',
    product: r.product as string || 'Khác',
  }))

  const receiveRows    = rows.filter(r => r.trntyp === 'I')
  const regularRows    = receiveRows.filter(r => r.program_id === '0')
  const promoRows      = receiveRows.filter(r => r.program_id !== '0')
  const returnRows     = rows.filter(r => r.trntyp === 'D')

  // 3. KPIs
  const regularRevenue = regularRows.reduce((s, r) => s + calcRowRevenue(r), 0)
  const returnRevenue  = returnRows.reduce((s, r)  => s + calcRowRevenue(r), 0)
  const total_revenue  = regularRevenue - returnRevenue

  const total_quantity   = regularRows.reduce((s, r) => s + r.pr_qty, 0)
  const total_promo_qty  = promoRows.reduce((s, r) => s + r.pr_qty, 0)
  const orderSet         = new Set(receiveRows.map(r => r.docno))
  const total_orders     = orderSet.size
  const skuSet           = new Set(receiveRows.map(r => r.sku_code))
  const total_skus       = skuSet.size
  const avg_per_order    = total_orders > 0 ? Math.round(total_revenue / total_orders) : 0

  // 4. Daily revenue (by day of month)
  const dailyRevMap = new Map<number, number>()
  for (const r of regularRows) {
    const day = new Date(r.pur_date).getDate()
    dailyRevMap.set(day, (dailyRevMap.get(day) ?? 0) + calcRowRevenue(r))
  }
  for (const r of returnRows) {
    const day = new Date(r.pur_date).getDate()
    dailyRevMap.set(day, (dailyRevMap.get(day) ?? 0) - calcRowRevenue(r))
  }
  const daily_revenue = Array.from(dailyRevMap.entries())
    .map(([day, revenue]) => ({ day, revenue }))
    .sort((a, b) => a.day - b.day)

  // 5. Daily quantity (by day of month)
  const dailyQtyMap = new Map<number, { quantity: number; promo_qty: number }>()
  for (const r of regularRows) {
    const day = new Date(r.pur_date).getDate()
    const cur = dailyQtyMap.get(day) ?? { quantity: 0, promo_qty: 0 }
    cur.quantity += r.pr_qty
    dailyQtyMap.set(day, cur)
  }
  for (const r of promoRows) {
    const day = new Date(r.pur_date).getDate()
    const cur = dailyQtyMap.get(day) ?? { quantity: 0, promo_qty: 0 }
    cur.promo_qty += r.pr_qty
    dailyQtyMap.set(day, cur)
  }
  const daily_quantity = Array.from(dailyQtyMap.entries())
    .map(([day, v]) => ({ day, quantity: v.quantity, promo_qty: v.promo_qty }))
    .sort((a, b) => a.day - b.day)

  // 6. Orders list (group by docno — regular receives only)
  const orderMap = new Map<string, { date: string; total: number; site: string }>()
  for (const r of receiveRows) {
    const existing = orderMap.get(r.docno)
    const rev = r.program_id === '0' ? calcRowRevenue(r) : 0
    if (existing) {
      existing.total += rev
    } else {
      orderMap.set(r.docno, {
        date: r.pur_date,
        total: rev,
        site: r.site_name,
      })
    }
  }
  const orders = Array.from(orderMap.entries())
    .map(([docno, v]) => ({
      order_code: docno,
      order_date: v.date.replace(/-/g, '/'),
      total_amount: Math.round(v.total),
      supplier_name: v.site,
    }))
    .sort((a, b) => a.order_date.localeCompare(b.order_date))

  // 7. Order items (for detail drawer): group by docno → sku_code
  const orderItemsMap = new Map<string, Map<string, {
    product_name: string; quantity: number; promo_qty: number; amt: number; tax: number
  }>>()
  for (const r of receiveRows) {
    if (!orderItemsMap.has(r.docno)) {
      orderItemsMap.set(r.docno, new Map())
    }
    const skuMap = orderItemsMap.get(r.docno)!
    const cur = skuMap.get(r.sku_code) ?? { product_name: r.sku_name, quantity: 0, promo_qty: 0, amt: 0, tax: 0 }
    if (r.program_id === '0') {
      cur.quantity  += r.pr_qty
      cur.amt       += r.pr_amt
      cur.tax       += r.pr_tax_amt
    } else {
      cur.promo_qty += r.pr_qty
    }
    skuMap.set(r.sku_code, cur)
  }

  const order_items: Record<string, Array<{
    product_code: string; product_name: string
    quantity: number; promo_qty: number; unit_price: number; subtotal: number
  }>> = {}
  for (const [docno, skuMap] of orderItemsMap.entries()) {
    order_items[docno] = Array.from(skuMap.entries()).map(([sku_code, v]) => ({
      product_code: sku_code,
      product_name: v.product_name,
      quantity: v.quantity,
      promo_qty: v.promo_qty,
      unit_price: v.quantity > 0 ? Math.round(v.amt / v.quantity) : 0,
      subtotal: Math.round(v.amt + v.tax),
    }))
  }

  // 8. Top 10 products by revenue
  const skuRevMap = new Map<string, { name: string; revenue: number }>()
  for (const r of regularRows) {
    const cur = skuRevMap.get(r.sku_code)
    const rev = calcRowRevenue(r)
    if (cur) {
      cur.revenue += rev
    } else {
      skuRevMap.set(r.sku_code, { name: r.sku_name.trim(), revenue: rev })
    }
  }
  const top_products = Array.from(skuRevMap.entries())
    .map(([code, v]) => ({ product_code: code, product_name: v.name, total_revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)

  // 9. By industry (category)
  const industryMap = new Map<string, number>()
  for (const r of regularRows) {
    industryMap.set(r.category, (industryMap.get(r.category) ?? 0) + calcRowRevenue(r))
  }
  const by_industry = Array.from(industryMap.entries())
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
    .filter(d => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // 10. By product group (product column)
  const productGrpMap = new Map<string, number>()
  for (const r of regularRows) {
    productGrpMap.set(r.product, (productGrpMap.get(r.product) ?? 0) + calcRowRevenue(r))
  }
  const by_product_group = Array.from(productGrpMap.entries())
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
    .filter(d => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // 11. By brand
  const brandMap = new Map<string, number>()
  for (const r of regularRows) {
    const b = r.brand.trim() || 'Khác'
    brandMap.set(b, (brandMap.get(b) ?? 0) + calcRowRevenue(r))
  }
  const by_brand = Array.from(brandMap.entries())
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
    .filter(d => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  return {
    kpis: { total_revenue: Math.round(total_revenue), total_quantity, total_promo_qty, total_orders, total_skus, avg_per_order },
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

export const getNhapHangData = unstable_cache(
  _getNhapHangData,
  ['nhap-hang'],
  { tags: ['nhap-hang'], revalidate: 3600 }
)
