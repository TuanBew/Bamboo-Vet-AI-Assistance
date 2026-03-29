import { createServiceClient } from '@/lib/supabase/server'
import { computeForecast } from '@/lib/admin/forecast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  npp: string           // supplier_id or '' for all
  month: string         // "2026-03" format (year-month)
  nganhHang: string     // classification value or '' for all
  thuongHieu: string    // manufacturer value or '' for all
  kenh: string          // '' | 'le' | 'si'
}

export interface DashboardData {
  npp_list: Array<{ id: string; name: string }>
  filter_options: {
    nganh_hang: string[]
    thuong_hieu: string[]
  }
  yearly_series: Array<{
    year: number
    ban_hang: number
    nhap_hang: number
  }>
  monthly_series: Array<{
    year: number
    month: number
    ban_hang: number
    nhap_hang: number
    is_forecast: boolean
  }>
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
    tong_nhap_prev_year: number
    tong_ban_prev_year: number
    sl_ban: number
    sl_km: number
    avg_per_order: number
  }
  staff_list: Array<{
    staff_id: string
    staff_name: string
    total_sales: number
    order_count: number
    avg_per_order: number
    customer_count: number
    days_over_1m: number
    daily_sparkline: number[]
    by_nhom: Record<string, number>
    by_thuong_hieu: Record<string, number>
  }>
  customer_section: {
    by_type_sales: Array<{ type: string; ban_hang: number }>
    by_type_count: Array<{ type: string; count: number }>
    map_pins: Array<{
      id: string
      latitude: number
      longitude: number
      label: string
      popup: string
      customer_type: string
    }>
  }
  top10: {
    customers: Array<{ name: string; total_value: number }>
    products: Array<{ name: string; total_value: number }>
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KENH_LE_TYPES = ['TH', 'GSO', 'PHA', 'SPS']
const KENH_SI_TYPES = ['WMO', 'PLT', 'BTS', 'OTHER']
const DAY_THRESHOLD = 1_000_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number)
  return { year: y, month: m }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

interface CustomerRow {
  id: string
  customer_type: string
  customer_name: string
  latitude: number | null
  longitude: number | null
  supplier_id: string | null
}

async function getFilteredCustomerIds(
  db: ReturnType<typeof createServiceClient>,
  filters: DashboardFilters
): Promise<{ customerIds: string[]; allCustomers: CustomerRow[] }> {
  let query = db.from('customers').select('id, customer_type, customer_name, latitude, longitude, supplier_id')
  if (filters.npp) query = query.eq('supplier_id', filters.npp)
  if (filters.kenh === 'le') query = query.in('customer_type', KENH_LE_TYPES)
  else if (filters.kenh === 'si') query = query.in('customer_type', KENH_SI_TYPES)
  const { data } = await query
  const customers = (data ?? []) as CustomerRow[]
  return { customerIds: customers.map(c => c.id), allCustomers: customers }
}

interface ProductInfo {
  product_name: string
  product_group: string
  classification: string
  manufacturer: string
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData> {
  const db = createServiceClient()
  const { year, month } = parseMonth(filters.month)
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`
  const daysInMonth = lastDayOfMonth(year, month)

  // Previous year same month
  const prevYear = year - 1
  const prevStartOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-01`
  const prevEndOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-${lastDayOfMonth(prevYear, month)}`

  // -- Parallel fetches --
  const { customerIds, allCustomers } = await getFilteredCustomerIds(db, filters)

  // Products map
  const { data: productRows } = await db
    .from('products')
    .select('id, product_name, product_group, classification, manufacturer')
  const productMap = new Map<string, ProductInfo>(
    (productRows ?? []).map(p => [
      p.id as string,
      {
        product_name: p.product_name as string,
        product_group: p.product_group as string,
        classification: (p.classification as string) || '',
        manufacturer: (p.manufacturer as string) || '',
      },
    ])
  )

  // NPP list
  const { data: supplierRows } = await db
    .from('suppliers')
    .select('id, supplier_name')
    .order('supplier_name')
  const npp_list = (supplierRows ?? []).map(s => ({
    id: s.id as string,
    name: s.supplier_name as string,
  }))

  // Filter options
  const nganh_hang_set = new Set<string>()
  const thuong_hieu_set = new Set<string>()
  for (const p of productMap.values()) {
    if (p.classification) nganh_hang_set.add(p.classification)
    if (p.manufacturer) thuong_hieu_set.add(p.manufacturer)
  }
  const filter_options = {
    nganh_hang: Array.from(nganh_hang_set).sort(),
    thuong_hieu: Array.from(thuong_hieu_set).sort(),
  }

  // -----------------------------------------------------------------------
  // Customer purchases (ban_hang) for selected month
  // -----------------------------------------------------------------------
  let monthPurchases: Array<{
    customer_id: string
    product_id: string
    purchase_date: string
    qty: number
    total_value: number
    staff_id: string | null
  }> = []

  if (customerIds.length > 0) {
    const { data: cpRows } = await db
      .from('customer_purchases')
      .select('customer_id, product_id, purchase_date, qty, total_value, staff_id')
      .gte('purchase_date', startOfMonth)
      .lte('purchase_date', endOfMonth)
      .in('customer_id', customerIds)

    monthPurchases = (cpRows ?? []).map(r => ({
      customer_id: r.customer_id as string,
      product_id: r.product_id as string,
      purchase_date: r.purchase_date as string,
      qty: Number(r.qty),
      total_value: Number(r.total_value),
      staff_id: (r.staff_id as string) || null,
    }))
  }

  // JS-side filter by nganhHang / thuongHieu
  if (filters.nganhHang) {
    monthPurchases = monthPurchases.filter(p => {
      const prod = productMap.get(p.product_id)
      return prod && prod.classification === filters.nganhHang
    })
  }
  if (filters.thuongHieu) {
    monthPurchases = monthPurchases.filter(p => {
      const prod = productMap.get(p.product_id)
      return prod && prod.manufacturer === filters.thuongHieu
    })
  }

  // -----------------------------------------------------------------------
  // All customer purchases (for yearly/monthly series) - no month filter
  // -----------------------------------------------------------------------
  let allPurchases: Array<{
    customer_id: string
    product_id: string
    purchase_date: string
    qty: number
    total_value: number
  }> = []

  if (customerIds.length > 0) {
    const { data: allCpRows } = await db
      .from('customer_purchases')
      .select('customer_id, product_id, purchase_date, qty, total_value')
      .in('customer_id', customerIds)

    allPurchases = (allCpRows ?? []).map(r => ({
      customer_id: r.customer_id as string,
      product_id: r.product_id as string,
      purchase_date: r.purchase_date as string,
      qty: Number(r.qty),
      total_value: Number(r.total_value),
    }))
  }

  // JS-side filter by nganhHang / thuongHieu for series
  if (filters.nganhHang) {
    allPurchases = allPurchases.filter(p => {
      const prod = productMap.get(p.product_id)
      return prod && prod.classification === filters.nganhHang
    })
  }
  if (filters.thuongHieu) {
    allPurchases = allPurchases.filter(p => {
      const prod = productMap.get(p.product_id)
      return prod && prod.manufacturer === filters.thuongHieu
    })
  }

  // -----------------------------------------------------------------------
  // Purchase orders (nhap_hang) for selected month
  // -----------------------------------------------------------------------
  let orderQuery = db
    .from('purchase_orders')
    .select('id, supplier_id, order_date, total_amount')
    .gte('order_date', startOfMonth)
    .lte('order_date', endOfMonth)
  if (filters.npp) orderQuery = orderQuery.eq('supplier_id', filters.npp)
  const { data: monthOrderRows } = await orderQuery
  const monthOrders = monthOrderRows ?? []
  const monthOrderIds = monthOrders.map(o => o.id as string)

  let monthOrderItems: Array<{
    order_id: string
    product_id: string
    quantity: number
    promo_qty: number
    unit_price: number
    subtotal: number
  }> = []

  if (monthOrderIds.length > 0) {
    const { data: itemRows } = await db
      .from('purchase_order_items')
      .select('order_id, product_id, quantity, promo_qty, unit_price, subtotal')
      .in('order_id', monthOrderIds)
    monthOrderItems = (itemRows ?? []).map(r => ({
      order_id: r.order_id as string,
      product_id: r.product_id as string,
      quantity: Number(r.quantity),
      promo_qty: Number(r.promo_qty),
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
    }))
  }

  // JS-side filter nhap items by nganhHang / thuongHieu
  if (filters.nganhHang) {
    monthOrderItems = monthOrderItems.filter(i => {
      const prod = productMap.get(i.product_id)
      return prod && prod.classification === filters.nganhHang
    })
  }
  if (filters.thuongHieu) {
    monthOrderItems = monthOrderItems.filter(i => {
      const prod = productMap.get(i.product_id)
      return prod && prod.manufacturer === filters.thuongHieu
    })
  }

  // -----------------------------------------------------------------------
  // All purchase orders (for yearly/monthly series) - no month filter
  // -----------------------------------------------------------------------
  let allOrderQuery = db
    .from('purchase_orders')
    .select('id, supplier_id, order_date, total_amount')
  if (filters.npp) allOrderQuery = allOrderQuery.eq('supplier_id', filters.npp)
  const { data: allOrderRows } = await allOrderQuery
  const allOrders = allOrderRows ?? []
  const allOrderIds = allOrders.map(o => o.id as string)

  let allOrderItems: Array<{
    order_id: string
    product_id: string
    quantity: number
    promo_qty: number
    unit_price: number
    subtotal: number
  }> = []

  if (allOrderIds.length > 0) {
    const { data: allItemRows } = await db
      .from('purchase_order_items')
      .select('order_id, product_id, quantity, promo_qty, unit_price, subtotal')
      .in('order_id', allOrderIds)
    allOrderItems = (allItemRows ?? []).map(r => ({
      order_id: r.order_id as string,
      product_id: r.product_id as string,
      quantity: Number(r.quantity),
      promo_qty: Number(r.promo_qty),
      unit_price: Number(r.unit_price),
      subtotal: Number(r.subtotal),
    }))
  }

  if (filters.nganhHang) {
    allOrderItems = allOrderItems.filter(i => {
      const prod = productMap.get(i.product_id)
      return prod && prod.classification === filters.nganhHang
    })
  }
  if (filters.thuongHieu) {
    allOrderItems = allOrderItems.filter(i => {
      const prod = productMap.get(i.product_id)
      return prod && prod.manufacturer === filters.thuongHieu
    })
  }

  // Build order_id -> order_date map for all orders
  const orderDateMap = new Map(allOrders.map(o => [o.id as string, o.order_date as string]))

  // -----------------------------------------------------------------------
  // h. Yearly series
  // -----------------------------------------------------------------------
  const yearlyBanMap = new Map<number, number>()
  const yearlyNhapMap = new Map<number, number>()

  for (const p of allPurchases) {
    const y = new Date(p.purchase_date).getFullYear()
    yearlyBanMap.set(y, (yearlyBanMap.get(y) ?? 0) + p.total_value)
  }
  for (const item of allOrderItems) {
    const dateStr = orderDateMap.get(item.order_id)
    if (!dateStr) continue
    const y = new Date(dateStr).getFullYear()
    yearlyNhapMap.set(y, (yearlyNhapMap.get(y) ?? 0) + item.subtotal)
  }

  const allYears = new Set([...yearlyBanMap.keys(), ...yearlyNhapMap.keys()])
  for (let y = 2022; y <= 2026; y++) allYears.add(y)
  const yearly_series = Array.from(allYears)
    .sort()
    .map(y => ({
      year: y,
      ban_hang: yearlyBanMap.get(y) ?? 0,
      nhap_hang: yearlyNhapMap.get(y) ?? 0,
    }))

  // -----------------------------------------------------------------------
  // i. Monthly series + forecast
  // -----------------------------------------------------------------------
  const monthlyBanMap = new Map<string, number>()
  const monthlyNhapMap = new Map<string, number>()

  for (const p of allPurchases) {
    const d = new Date(p.purchase_date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    monthlyBanMap.set(key, (monthlyBanMap.get(key) ?? 0) + p.total_value)
  }
  for (const item of allOrderItems) {
    const dateStr = orderDateMap.get(item.order_id)
    if (!dateStr) continue
    const d = new Date(dateStr)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    monthlyNhapMap.set(key, (monthlyNhapMap.get(key) ?? 0) + item.subtotal)
  }

  const allMonthKeys = new Set([...monthlyBanMap.keys(), ...monthlyNhapMap.keys()])
  const monthlyArr = Array.from(allMonthKeys)
    .map(k => {
      const [y, m] = k.split('-').map(Number)
      return { year: y, month: m, ban_hang: monthlyBanMap.get(k) ?? 0, nhap_hang: monthlyNhapMap.get(k) ?? 0 }
    })
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // Run forecast independently for ban and nhap
  const banForecast = computeForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.ban_hang, session_count: 0 }))
  )
  const nhapForecast = computeForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.nhap_hang, session_count: 0 }))
  )

  // Merge forecasts
  const monthlySeriesMap = new Map<string, { year: number; month: number; ban_hang: number; nhap_hang: number; is_forecast: boolean }>()
  for (const fp of banForecast) {
    const key = `${fp.year}-${fp.month}`
    monthlySeriesMap.set(key, {
      year: fp.year,
      month: fp.month,
      ban_hang: fp.query_count,
      nhap_hang: 0,
      is_forecast: fp.is_forecast,
    })
  }
  for (const fp of nhapForecast) {
    const key = `${fp.year}-${fp.month}`
    const existing = monthlySeriesMap.get(key)
    if (existing) {
      existing.nhap_hang = fp.query_count
      if (fp.is_forecast) existing.is_forecast = true
    } else {
      monthlySeriesMap.set(key, {
        year: fp.year,
        month: fp.month,
        ban_hang: 0,
        nhap_hang: fp.query_count,
        is_forecast: fp.is_forecast,
      })
    }
  }
  const monthly_series = Array.from(monthlySeriesMap.values())
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // -----------------------------------------------------------------------
  // j. Daily series for selected month
  // -----------------------------------------------------------------------
  const dailyBanMap = new Map<number, number>()
  const dailyNhapMap = new Map<number, number>()

  for (const p of monthPurchases) {
    const day = new Date(p.purchase_date).getDate()
    dailyBanMap.set(day, (dailyBanMap.get(day) ?? 0) + p.total_value)
  }

  // Build month order_id -> order_date map for nhap daily
  const monthOrderDateMap = new Map(monthOrders.map(o => [o.id as string, o.order_date as string]))
  for (const item of monthOrderItems) {
    const dateStr = monthOrderDateMap.get(item.order_id)
    if (!dateStr) continue
    const day = new Date(dateStr).getDate()
    dailyNhapMap.set(day, (dailyNhapMap.get(day) ?? 0) + item.subtotal)
  }

  const daily_series: DashboardData['daily_series'] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const ban = dailyBanMap.get(d) ?? 0
    const nhap = dailyNhapMap.get(d) ?? 0
    if (ban > 0 || nhap > 0) {
      daily_series.push({ day: d, ban_hang: ban, nhap_hang: nhap })
    }
  }

  // -----------------------------------------------------------------------
  // k. Metrics box
  // -----------------------------------------------------------------------
  const nhapHangMonth = monthOrderItems.reduce((s, i) => s + i.subtotal, 0)
  const banHangMonth = monthPurchases.reduce((s, p) => s + p.total_value, 0)
  const activeCustomerIds = new Set(monthPurchases.map(p => p.customer_id))
  const soldProductIds = new Set(monthPurchases.map(p => p.product_id))

  // Staff count for NPP
  let nhanVienCount = 0
  {
    let staffQuery = db.from('distributor_staff').select('id', { count: 'exact', head: true })
    if (filters.npp) staffQuery = staffQuery.eq('supplier_id', filters.npp)
    const { count } = await staffQuery
    nhanVienCount = count ?? 0
  }

  const metrics_box: DashboardData['metrics_box'] = {
    nhap_hang: nhapHangMonth,
    ban_hang: banHangMonth,
    customers_active: activeCustomerIds.size,
    customers_total: allCustomers.length,
    sku_sold: soldProductIds.size,
    sku_total: productMap.size,
    nhan_vien: nhanVienCount,
  }

  // -----------------------------------------------------------------------
  // l. Pie charts
  // -----------------------------------------------------------------------
  const pieNhapNganh = new Map<string, number>()
  const pieNhapNhom = new Map<string, number>()
  const pieNhapTH = new Map<string, number>()

  for (const item of monthOrderItems) {
    const prod = productMap.get(item.product_id)
    if (!prod) continue
    const nganh = prod.classification || 'Khac'
    const nhom = prod.product_group || 'Khac'
    const th = prod.manufacturer || 'Khac'
    pieNhapNganh.set(nganh, (pieNhapNganh.get(nganh) ?? 0) + item.subtotal)
    pieNhapNhom.set(nhom, (pieNhapNhom.get(nhom) ?? 0) + item.subtotal)
    pieNhapTH.set(th, (pieNhapTH.get(th) ?? 0) + item.subtotal)
  }

  const pieBanNganh = new Map<string, number>()
  const pieBanNhom = new Map<string, number>()
  const pieBanTH = new Map<string, number>()

  for (const p of monthPurchases) {
    const prod = productMap.get(p.product_id)
    if (!prod) continue
    const nganh = prod.classification || 'Khac'
    const nhom = prod.product_group || 'Khac'
    const th = prod.manufacturer || 'Khac'
    pieBanNganh.set(nganh, (pieBanNganh.get(nganh) ?? 0) + p.total_value)
    pieBanNhom.set(nhom, (pieBanNhom.get(nhom) ?? 0) + p.total_value)
    pieBanTH.set(th, (pieBanTH.get(th) ?? 0) + p.total_value)
  }

  const toNameValue = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

  const pie_nhap: DashboardData['pie_nhap'] = {
    by_nganh: toNameValue(pieNhapNganh),
    by_nhom: toNameValue(pieNhapNhom),
    by_thuong_hieu: toNameValue(pieNhapTH),
  }
  const pie_ban: DashboardData['pie_ban'] = {
    by_nganh: toNameValue(pieBanNganh),
    by_nhom: toNameValue(pieBanNhom),
    by_thuong_hieu: toNameValue(pieBanTH),
  }

  // -----------------------------------------------------------------------
  // m. KPI row
  // -----------------------------------------------------------------------
  const slBan = monthPurchases.reduce((s, p) => s + p.qty, 0)
  const slKm = monthOrderItems.reduce((s, i) => s + i.promo_qty, 0)

  // Distinct purchase transactions = distinct (customer_id, purchase_date) combos
  const purchaseTransactions = new Set(
    monthPurchases.map(p => `${p.customer_id}|${p.purchase_date}`)
  )
  const avgPerOrder = purchaseTransactions.size > 0
    ? Math.round(banHangMonth / purchaseTransactions.size)
    : 0

  // Previous year same month
  let prevYearBan = 0
  let prevYearNhap = 0
  if (customerIds.length > 0) {
    const { data: prevCpRows } = await db
      .from('customer_purchases')
      .select('total_value')
      .gte('purchase_date', prevStartOfMonth)
      .lte('purchase_date', prevEndOfMonth)
      .in('customer_id', customerIds)
    prevYearBan = (prevCpRows ?? []).reduce((s, r) => s + Number(r.total_value), 0)
  }
  {
    let prevOrderQuery = db
      .from('purchase_orders')
      .select('id')
      .gte('order_date', prevStartOfMonth)
      .lte('order_date', prevEndOfMonth)
    if (filters.npp) prevOrderQuery = prevOrderQuery.eq('supplier_id', filters.npp)
    const { data: prevOrderRows } = await prevOrderQuery
    const prevOrderIds = (prevOrderRows ?? []).map(o => o.id as string)
    if (prevOrderIds.length > 0) {
      const { data: prevItemRows } = await db
        .from('purchase_order_items')
        .select('subtotal')
        .in('order_id', prevOrderIds)
      prevYearNhap = (prevItemRows ?? []).reduce((s, r) => s + Number(r.subtotal), 0)
    }
  }

  const kpi_row: DashboardData['kpi_row'] = {
    tong_nhap: nhapHangMonth,
    tong_ban: banHangMonth,
    tong_nhap_prev_year: prevYearNhap,
    tong_ban_prev_year: prevYearBan,
    sl_ban: slBan,
    sl_km: slKm,
    avg_per_order: avgPerOrder,
  }

  // -----------------------------------------------------------------------
  // n. Staff list
  // -----------------------------------------------------------------------
  let staff_list: DashboardData['staff_list'] = []
  {
    let staffQuery = db.from('distributor_staff').select('id, staff_name, supplier_id')
    if (filters.npp) staffQuery = staffQuery.eq('supplier_id', filters.npp)
    const { data: staffRows } = await staffQuery
    const staffMembers = staffRows ?? []

    if (staffMembers.length > 0) {
      const staffIds = staffMembers.map(s => s.id as string)

      // Get purchases for these staff in selected month
      let staffPurchaseQuery = db
        .from('customer_purchases')
        .select('customer_id, product_id, purchase_date, qty, total_value, staff_id')
        .gte('purchase_date', startOfMonth)
        .lte('purchase_date', endOfMonth)
        .in('staff_id', staffIds)
      const { data: staffPurchaseRows } = await staffPurchaseQuery

      let staffPurchases = (staffPurchaseRows ?? []).map(r => ({
        customer_id: r.customer_id as string,
        product_id: r.product_id as string,
        purchase_date: r.purchase_date as string,
        qty: Number(r.qty),
        total_value: Number(r.total_value),
        staff_id: r.staff_id as string,
      }))

      // Apply product filters
      if (filters.nganhHang) {
        staffPurchases = staffPurchases.filter(p => {
          const prod = productMap.get(p.product_id)
          return prod && prod.classification === filters.nganhHang
        })
      }
      if (filters.thuongHieu) {
        staffPurchases = staffPurchases.filter(p => {
          const prod = productMap.get(p.product_id)
          return prod && prod.manufacturer === filters.thuongHieu
        })
      }

      staff_list = staffMembers.map(staff => {
        const sid = staff.id as string
        const myPurchases = staffPurchases.filter(p => p.staff_id === sid)

        const totalSales = myPurchases.reduce((s, p) => s + p.total_value, 0)
        const transactions = new Set(myPurchases.map(p => `${p.customer_id}|${p.purchase_date}`))
        const orderCount = transactions.size
        const customerCount = new Set(myPurchases.map(p => p.customer_id)).size

        // Daily sparkline
        const dailyMap = new Map<number, number>()
        for (const p of myPurchases) {
          const day = new Date(p.purchase_date).getDate()
          dailyMap.set(day, (dailyMap.get(day) ?? 0) + p.total_value)
        }
        const dailySparkline: number[] = []
        let daysOver1m = 0
        for (let d = 1; d <= daysInMonth; d++) {
          const val = dailyMap.get(d) ?? 0
          dailySparkline.push(val)
          if (val > DAY_THRESHOLD) daysOver1m++
        }

        // by_nhom and by_thuong_hieu
        const byNhom: Record<string, number> = {}
        const byTH: Record<string, number> = {}
        for (const p of myPurchases) {
          const prod = productMap.get(p.product_id)
          if (!prod) continue
          const nhom = prod.product_group || 'Khac'
          const th = prod.manufacturer || 'Khac'
          byNhom[nhom] = (byNhom[nhom] ?? 0) + p.total_value
          byTH[th] = (byTH[th] ?? 0) + p.total_value
        }

        return {
          staff_id: sid,
          staff_name: staff.staff_name as string,
          total_sales: totalSales,
          order_count: orderCount,
          avg_per_order: orderCount > 0 ? Math.round(totalSales / orderCount) : 0,
          customer_count: customerCount,
          days_over_1m: daysOver1m,
          daily_sparkline: dailySparkline,
          by_nhom: byNhom,
          by_thuong_hieu: byTH,
        }
      })
    }
  }

  // -----------------------------------------------------------------------
  // o. Customer section
  // -----------------------------------------------------------------------
  // by_type_sales
  const typeSalesMap = new Map<string, number>()
  for (const p of monthPurchases) {
    const cust = allCustomers.find(c => c.id === p.customer_id)
    if (!cust) continue
    typeSalesMap.set(cust.customer_type, (typeSalesMap.get(cust.customer_type) ?? 0) + p.total_value)
  }
  const by_type_sales = Array.from(typeSalesMap.entries())
    .map(([type, ban_hang]) => ({ type, ban_hang }))
    .sort((a, b) => b.ban_hang - a.ban_hang)

  // by_type_count
  const typeCountMap = new Map<string, number>()
  for (const c of allCustomers) {
    typeCountMap.set(c.customer_type, (typeCountMap.get(c.customer_type) ?? 0) + 1)
  }
  const by_type_count = Array.from(typeCountMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // map_pins: customers with lat/lon
  const customerMonthlyTotals = new Map<string, number>()
  for (const p of monthPurchases) {
    customerMonthlyTotals.set(p.customer_id, (customerMonthlyTotals.get(p.customer_id) ?? 0) + p.total_value)
  }

  const map_pins = allCustomers
    .filter(c => c.latitude != null && c.longitude != null)
    .map(c => ({
      id: c.id,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      label: c.customer_name,
      popup: `${c.customer_name}: ${(customerMonthlyTotals.get(c.id) ?? 0).toLocaleString('vi-VN')} VND`,
      customer_type: c.customer_type,
    }))

  const customer_section: DashboardData['customer_section'] = {
    by_type_sales,
    by_type_count,
    map_pins,
  }

  // -----------------------------------------------------------------------
  // p. Top 10
  // -----------------------------------------------------------------------
  // Top 10 customers by total_value in selected month
  const custTotals = new Map<string, { name: string; total: number }>()
  for (const p of monthPurchases) {
    const cust = allCustomers.find(c => c.id === p.customer_id)
    const name = cust?.customer_name ?? 'Unknown'
    const existing = custTotals.get(p.customer_id)
    if (existing) {
      existing.total += p.total_value
    } else {
      custTotals.set(p.customer_id, { name, total: p.total_value })
    }
  }
  const topCustomers = Array.from(custTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(c => ({ name: c.name, total_value: c.total }))

  // Top 10 products by total_value in selected month
  const prodTotals = new Map<string, { name: string; total: number }>()
  for (const p of monthPurchases) {
    const prod = productMap.get(p.product_id)
    const name = prod?.product_name ?? 'Unknown'
    const existing = prodTotals.get(p.product_id)
    if (existing) {
      existing.total += p.total_value
    } else {
      prodTotals.set(p.product_id, { name, total: p.total_value })
    }
  }
  const topProducts = Array.from(prodTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(p => ({ name: p.name, total_value: p.total }))

  const top10: DashboardData['top10'] = {
    customers: topCustomers,
    products: topProducts,
  }

  // -----------------------------------------------------------------------
  // Return complete dashboard data
  // -----------------------------------------------------------------------
  return {
    npp_list,
    filter_options,
    yearly_series,
    monthly_series,
    daily_series,
    metrics_box,
    pie_nhap,
    pie_ban,
    kpi_row,
    staff_list,
    customer_section,
    top10,
  }
}
