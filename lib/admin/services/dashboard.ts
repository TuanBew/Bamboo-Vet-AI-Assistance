import { createServiceClient } from '@/lib/supabase/server'
import { computeForecast } from '@/lib/admin/forecast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  npp: string           // ship_from_code or '' for all
  month: string         // "2026-03" format (year-month)
  nganhHang: string     // category value or '' for all
  thuongHieu: string    // brand value or '' for all
  kenh: string          // v_chanel value or '' for all
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

/** Revenue formula: off_amt + off_tax_amt - off_dsc (off_dsc can be null) */
function calcRevenue(row: { off_amt: number; off_tax_amt: number; off_dsc: number | null }): number {
  return row.off_amt + row.off_tax_amt - (row.off_dsc ?? 0)
}

/** Purchase value formula: pr_amt + pr_tax_amt */
function calcPurchaseValue(row: { pr_amt: number; pr_tax_amt: number }): number {
  return row.pr_amt + row.pr_tax_amt
}

/** Free promotion: row was given at zero cost (off_amt = 0). Used for slKm count. */
function isFreePromo(row: { off_amt: number }): boolean {
  return row.off_amt === 0
}

const toNameValue = (map: Map<string, number>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

// ---------------------------------------------------------------------------
// Row types for month-scoped queries
// ---------------------------------------------------------------------------
interface DoorRow {
  saleperson_key: string
  saleperson_name: string
  customer_key: string
  customer_name: string
  type_name: string
  sku_code: string
  sku_name: string
  category: string
  brand: string
  product: string
  off_date: string
  off_qty: number
  off_amt: number
  off_dsc: number | null
  off_tax_amt: number
  lat: number | null
  long: number | null
}

interface DpurRow {
  pur_date: string
  pr_qty: number
  pr_amt: number
  pr_tax_amt: number
  trntyp: string
  sku_code: string
  sku_name: string
  category: string
  brand: string
  product: string
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
  const prevYear = year - 1
  const prevStartOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-01`
  const prevEndOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-${lastDayOfMonth(prevYear, month)}`

  const npp = filters.npp
  const nganh = filters.nganhHang
  const th = filters.thuongHieu
  const kenh = filters.kenh

  // -----------------------------------------------------------------------
  // 1. Build month-scoped queries with conditional filters
  // -----------------------------------------------------------------------
  let monthDoorQ = db.from('door')
    .select('saleperson_key,saleperson_name,customer_key,customer_name,type_name,sku_code,sku_name,category,brand,product,off_date,off_qty,off_amt,off_dsc,off_tax_amt,lat,long')
    .gte('off_date', startOfMonth)
    .lte('off_date', endOfMonth)
  if (npp)   monthDoorQ = monthDoorQ.eq('ship_from_code', npp)
  if (nganh) monthDoorQ = monthDoorQ.eq('category', nganh)
  if (th)    monthDoorQ = monthDoorQ.eq('brand', th)
  if (kenh)  monthDoorQ = monthDoorQ.eq('v_chanel', kenh)
  const monthDoorFetch = monthDoorQ.range(0, 49999)

  let monthDpurQ = db.from('dpur')
    .select('pur_date,pr_qty,pr_amt,pr_tax_amt,trntyp,sku_code,sku_name,category,brand,product')
    .gte('pur_date', startOfMonth)
    .lte('pur_date', endOfMonth)
  if (npp)   monthDpurQ = monthDpurQ.eq('site_code', npp)
  if (nganh) monthDpurQ = monthDpurQ.eq('category', nganh)
  if (th)    monthDpurQ = monthDpurQ.eq('brand', th)
  const monthDpurFetch = monthDpurQ.range(0, 49999)

  let prevDoorQ = db.from('door')
    .select('off_date,off_qty,off_amt,off_dsc,off_tax_amt')
    .gte('off_date', prevStartOfMonth)
    .lte('off_date', prevEndOfMonth)
  if (npp)   prevDoorQ = prevDoorQ.eq('ship_from_code', npp)
  if (nganh) prevDoorQ = prevDoorQ.eq('category', nganh)
  if (th)    prevDoorQ = prevDoorQ.eq('brand', th)
  if (kenh)  prevDoorQ = prevDoorQ.eq('v_chanel', kenh)
  const prevDoorFetch = prevDoorQ.range(0, 49999)

  let prevDpurQ = db.from('dpur')
    .select('pur_date,pr_amt,pr_tax_amt,trntyp')
    .gte('pur_date', prevStartOfMonth)
    .lte('pur_date', prevEndOfMonth)
  if (npp)   prevDpurQ = prevDpurQ.eq('site_code', npp)
  if (nganh) prevDpurQ = prevDpurQ.eq('category', nganh)
  if (th)    prevDpurQ = prevDpurQ.eq('brand', th)
  const prevDpurFetch = prevDpurQ.range(0, 49999)

  // -----------------------------------------------------------------------
  // 2. Run all queries in parallel: RPC aggregates + month-scoped row fetches
  // -----------------------------------------------------------------------
  const [
    nppListResult,
    categoriesResult,
    brandsResult,
    doorYearlyResult,
    doorMonthlyResult,
    dpurYearlyResult,
    dpurMonthlyResult,
    monthDoorResult,
    monthDpurResult,
    prevDoorResult,
    prevDpurResult,
    skuTotalResult,
    totalCustomersResult,
    locationResult,
  ] = await Promise.all([
    // Filter option lookups (distinct values from DB)
    db.rpc('dashboard_npp_list'),
    db.rpc('dashboard_categories'),
    db.rpc('dashboard_brands'),

    // Yearly/monthly series — server-side GROUP BY aggregation
    db.rpc('dashboard_door_yearly',   { p_npp: npp, p_nganh: nganh, p_thuong_hieu: th, p_kenh: kenh }),
    db.rpc('dashboard_door_monthly',  { p_npp: npp, p_nganh: nganh, p_thuong_hieu: th, p_kenh: kenh }),
    db.rpc('dashboard_dpur_yearly',   { p_npp: npp, p_nganh: nganh, p_thuong_hieu: th }),
    db.rpc('dashboard_dpur_monthly',  { p_npp: npp, p_nganh: nganh, p_thuong_hieu: th }),

    // Month-scoped row queries (date-filtered, manageable size)
    monthDoorFetch,
    monthDpurFetch,
    prevDoorFetch,
    prevDpurFetch,

    // Total SKU count
    db.from('product').select('sku_code', { count: 'exact', head: true }),

    // Total distinct customer count (all-time)
    db.rpc('dashboard_total_customer_count', { p_npp: npp, p_nganh: nganh, p_thuong_hieu: th, p_kenh: kenh }),

    // Customer locations (for map pins)
    db.rpc('dashboard_customers_with_location', { p_npp: npp, p_kenh: kenh }),
  ])

  // -----------------------------------------------------------------------
  // 2. Process filter options
  // -----------------------------------------------------------------------
  const nppMap = new Map<string, string>()
  for (const row of (nppListResult.data ?? []) as Array<{ ship_from_code: string; ship_from_name: string }>) {
    nppMap.set(row.ship_from_code, row.ship_from_name || row.ship_from_code)
  }
  const npp_list = Array.from(nppMap.entries()).map(([id, name]) => ({ id, name }))

  const nganh_hang = (categoriesResult.data ?? []).map((r: { category: string }) => r.category)
  const thuong_hieu = (brandsResult.data ?? []).map((r: { brand: string }) => r.brand)
  const filter_options = { nganh_hang, thuong_hieu }

  // -----------------------------------------------------------------------
  // 3. Yearly series from RPC results
  // -----------------------------------------------------------------------
  const yearlyBanMap = new Map<number, number>()
  for (const row of (doorYearlyResult.data ?? []) as Array<{ yr: number; ban_hang: number }>) {
    if (row.yr) yearlyBanMap.set(row.yr, row.ban_hang ?? 0)
  }

  const yearlyNhapMap = new Map<number, number>()
  for (const row of (dpurYearlyResult.data ?? []) as Array<{ yr: number; nhap_hang: number }>) {
    if (row.yr) yearlyNhapMap.set(row.yr, row.nhap_hang ?? 0)
  }

  const allYears = new Set([...yearlyBanMap.keys(), ...yearlyNhapMap.keys()])
  const currentCalendarYear = new Date().getFullYear()
  for (let y = currentCalendarYear - 3; y <= currentCalendarYear; y++) allYears.add(y)
  const yearly_series = Array.from(allYears)
    .sort()
    .map(y => ({
      year: y,
      ban_hang: yearlyBanMap.get(y) ?? 0,
      nhap_hang: yearlyNhapMap.get(y) ?? 0,
    }))

  // -----------------------------------------------------------------------
  // 4. Monthly series + forecast from RPC results
  // -----------------------------------------------------------------------
  const monthlyBanMap = new Map<string, number>()
  for (const row of (doorMonthlyResult.data ?? []) as Array<{ yr: number; mo: number; ban_hang: number }>) {
    if (row.yr && row.mo) {
      monthlyBanMap.set(`${row.yr}-${row.mo}`, row.ban_hang ?? 0)
    }
  }

  const monthlyNhapMap = new Map<string, number>()
  for (const row of (dpurMonthlyResult.data ?? []) as Array<{ yr: number; mo: number; nhap_hang: number }>) {
    if (row.yr && row.mo) {
      monthlyNhapMap.set(`${row.yr}-${row.mo}`, row.nhap_hang ?? 0)
    }
  }

  const allMonthKeys = new Set([...monthlyBanMap.keys(), ...monthlyNhapMap.keys()])
  const monthlyArr = Array.from(allMonthKeys)
    .map(k => {
      const [y, m] = k.split('-').map(Number)
      return { year: y, month: m, ban_hang: monthlyBanMap.get(k) ?? 0, nhap_hang: monthlyNhapMap.get(k) ?? 0 }
    })
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  const banForecast = computeForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.ban_hang, session_count: 0 }))
  )
  const nhapForecast = computeForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, query_count: d.nhap_hang, session_count: 0 }))
  )

  const monthlySeriesMap = new Map<string, { year: number; month: number; ban_hang: number; nhap_hang: number; is_forecast: boolean }>()
  for (const fp of banForecast) {
    const key = `${fp.year}-${fp.month}`
    monthlySeriesMap.set(key, { year: fp.year, month: fp.month, ban_hang: fp.query_count, nhap_hang: 0, is_forecast: fp.is_forecast })
  }
  for (const fp of nhapForecast) {
    const key = `${fp.year}-${fp.month}`
    const existing = monthlySeriesMap.get(key)
    if (existing) {
      existing.nhap_hang = fp.query_count
      if (fp.is_forecast) existing.is_forecast = true
    } else {
      monthlySeriesMap.set(key, { year: fp.year, month: fp.month, ban_hang: 0, nhap_hang: fp.query_count, is_forecast: fp.is_forecast })
    }
  }
  const monthly_series = Array.from(monthlySeriesMap.values())
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // -----------------------------------------------------------------------
  // 5. Month-scoped row data
  // -----------------------------------------------------------------------
  const monthDoorRows = (monthDoorResult.data ?? []) as DoorRow[]
  const monthDpurRows = (monthDpurResult.data ?? []) as DpurRow[]
  const prevDoorRows  = (prevDoorResult.data  ?? []) as Array<{ off_date: string; off_qty: number; off_amt: number; off_dsc: number | null; off_tax_amt: number }>
  const prevDpurRows  = (prevDpurResult.data  ?? []) as Array<{ pur_date: string; pr_amt: number; pr_tax_amt: number; trntyp: string }>

  // -----------------------------------------------------------------------
  // 6. Daily series for selected month
  // -----------------------------------------------------------------------
  const dailyBanMap = new Map<number, number>()
  for (const row of monthDoorRows) {
    const day = new Date(row.off_date).getDate()
    dailyBanMap.set(day, (dailyBanMap.get(day) ?? 0) + calcRevenue(row))
  }

  const dailyNhapMap = new Map<number, number>()
  for (const row of monthDpurRows) {
    const day = new Date(row.pur_date).getDate()
    const current = dailyNhapMap.get(day) ?? 0
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') dailyNhapMap.set(day, current + val)
    else if (row.trntyp === 'D') dailyNhapMap.set(day, current - val)
  }

  const daily_series: DashboardData['daily_series'] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const ban = dailyBanMap.get(d) ?? 0
    const nhap = dailyNhapMap.get(d) ?? 0
    if (ban > 0 || nhap > 0) daily_series.push({ day: d, ban_hang: ban, nhap_hang: nhap })
  }

  // -----------------------------------------------------------------------
  // 7. Metrics box (month-scoped)
  // -----------------------------------------------------------------------
  const banHangMonth = monthDoorRows.reduce((s, r) => s + calcRevenue(r), 0)

  let nhapHangMonth = 0
  for (const row of monthDpurRows) {
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') nhapHangMonth += val
    else if (row.trntyp === 'D') nhapHangMonth -= val
  }

  const activeCustomerKeys = new Set(monthDoorRows.map(r => r.customer_key))
  const soldSkuCodes = new Set(monthDoorRows.map(r => r.sku_code))
  const nhanVienInMonth = new Set(monthDoorRows.map(r => r.saleperson_key))
  const customers_total = Number(totalCustomersResult.data ?? 0)

  const metrics_box: DashboardData['metrics_box'] = {
    nhap_hang: nhapHangMonth,
    ban_hang: banHangMonth,
    customers_active: activeCustomerKeys.size,
    customers_total,
    sku_sold: soldSkuCodes.size,
    sku_total: skuTotalResult.count ?? 0,
    nhan_vien: nhanVienInMonth.size,
  }

  // -----------------------------------------------------------------------
  // 8. Pie charts (month-scoped)
  // -----------------------------------------------------------------------
  const pieNhapNganh = new Map<string, number>()
  const pieNhapNhom = new Map<string, number>()
  const pieNhapTH = new Map<string, number>()

  for (const row of monthDpurRows) {
    const val = row.trntyp === 'I' ? calcPurchaseValue(row) : -calcPurchaseValue(row)
    pieNhapNganh.set(row.category || 'Khac', (pieNhapNganh.get(row.category || 'Khac') ?? 0) + val)
    pieNhapNhom.set(row.product || 'Khac',   (pieNhapNhom.get(row.product || 'Khac')   ?? 0) + val)
    pieNhapTH.set(row.brand || 'Khac',       (pieNhapTH.get(row.brand || 'Khac')       ?? 0) + val)
  }

  const pieBanNganh = new Map<string, number>()
  const pieBanNhom = new Map<string, number>()
  const pieBanTH = new Map<string, number>()

  for (const row of monthDoorRows) {
    const val = calcRevenue(row)
    pieBanNganh.set(row.category || 'Khac', (pieBanNganh.get(row.category || 'Khac') ?? 0) + val)
    pieBanNhom.set(row.product || 'Khac',   (pieBanNhom.get(row.product || 'Khac')   ?? 0) + val)
    pieBanTH.set(row.brand || 'Khac',       (pieBanTH.get(row.brand || 'Khac')       ?? 0) + val)
  }

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
  // 9. KPI row (month-scoped, with YoY comparison)
  // -----------------------------------------------------------------------
  const slBan = monthDoorRows.filter(r => !isFreePromo(r)).reduce((s, r) => s + r.off_qty, 0)
  const slKm  = monthDoorRows.filter(r => isFreePromo(r)).reduce((s, r) => s + r.off_qty, 0)

  const orderTransactions = new Set(monthDoorRows.map(r => `${r.customer_key}|${r.off_date}`))
  const avgPerOrder = orderTransactions.size > 0 ? Math.round(banHangMonth / orderTransactions.size) : 0

  const prevYearBan = prevDoorRows.reduce((s, r) => s + calcRevenue(r), 0)
  let prevYearNhap = 0
  for (const row of prevDpurRows) {
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') prevYearNhap += val
    else if (row.trntyp === 'D') prevYearNhap -= val
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
  // 10. Staff list (month-scoped)
  // -----------------------------------------------------------------------
  const staffKeyToName = new Map<string, string>()
  for (const row of monthDoorRows) {
    if (!staffKeyToName.has(row.saleperson_key)) {
      staffKeyToName.set(row.saleperson_key, row.saleperson_name || row.saleperson_key)
    }
  }

  const staff_list: DashboardData['staff_list'] = []
  for (const [sid, sname] of staffKeyToName.entries()) {
    const myRows = monthDoorRows.filter(r => r.saleperson_key === sid)
    const totalSales = myRows.reduce((s, r) => s + calcRevenue(r), 0)
    const transactions = new Set(myRows.map(r => `${r.customer_key}|${r.off_date}`))
    const orderCount = transactions.size
    const customerCount = new Set(myRows.map(r => r.customer_key)).size

    const dailyMap = new Map<number, number>()
    for (const r of myRows) {
      const day = new Date(r.off_date).getDate()
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + calcRevenue(r))
    }

    const dailySparkline: number[] = []
    let daysOver1m = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const val = dailyMap.get(d) ?? 0
      dailySparkline.push(val)
      if (val > DAY_THRESHOLD) daysOver1m++
    }

    const byNhom: Record<string, number> = {}
    const byTH: Record<string, number> = {}
    for (const r of myRows) {
      const nhom = r.product || 'Khac'
      const brand = r.brand || 'Khac'
      byNhom[nhom] = (byNhom[nhom] ?? 0) + calcRevenue(r)
      byTH[brand]  = (byTH[brand]  ?? 0) + calcRevenue(r)
    }

    staff_list.push({
      staff_id: sid,
      staff_name: sname,
      total_sales: totalSales,
      order_count: orderCount,
      avg_per_order: orderCount > 0 ? Math.round(totalSales / orderCount) : 0,
      customer_count: customerCount,
      days_over_1m: daysOver1m,
      daily_sparkline: dailySparkline,
      by_nhom: byNhom,
      by_thuong_hieu: byTH,
    })
  }
  staff_list.sort((a, b) => b.total_sales - a.total_sales)

  // -----------------------------------------------------------------------
  // 11. Customer section (month-scoped)
  // -----------------------------------------------------------------------
  const typeSalesMap = new Map<string, number>()
  for (const row of monthDoorRows) {
    const type = row.type_name || 'Khac'
    typeSalesMap.set(type, (typeSalesMap.get(type) ?? 0) + calcRevenue(row))
  }
  const by_type_sales = Array.from(typeSalesMap.entries())
    .map(([type, ban_hang]) => ({ type, ban_hang }))
    .sort((a, b) => b.ban_hang - a.ban_hang)

  const typeCustomerMap = new Map<string, Set<string>>()
  for (const row of monthDoorRows) {
    const type = row.type_name || 'Khac'
    if (!typeCustomerMap.has(type)) typeCustomerMap.set(type, new Set())
    typeCustomerMap.get(type)!.add(row.customer_key)
  }
  const by_type_count = Array.from(typeCustomerMap.entries())
    .map(([type, keySet]) => ({ type, count: keySet.size }))
    .sort((a, b) => b.count - a.count)

  // Map pins from RPC (distinct customers with lat/long)
  const customerMonthlyRevenue = new Map<string, number>()
  for (const row of monthDoorRows) {
    customerMonthlyRevenue.set(row.customer_key, (customerMonthlyRevenue.get(row.customer_key) ?? 0) + calcRevenue(row))
  }

  const locationRows = (locationResult.data ?? []) as Array<{
    customer_key: string
    customer_name: string
    type_name: string
    lat: number
    long: number
  }>

  const map_pins: DashboardData['customer_section']['map_pins'] = locationRows.map(loc => {
    const value = customerMonthlyRevenue.get(loc.customer_key) ?? 0
    return {
      id: loc.customer_key,
      latitude: loc.lat,
      longitude: loc.long,
      label: loc.customer_name,
      popup: `${loc.customer_name}: ${value.toLocaleString('vi-VN')} VND`,
      customer_type: loc.type_name || 'Khac',
    }
  })

  const customer_section: DashboardData['customer_section'] = { by_type_sales, by_type_count, map_pins }

  // -----------------------------------------------------------------------
  // 12. Top 10 (month-scoped)
  // -----------------------------------------------------------------------
  const custTotals = new Map<string, { name: string; total: number }>()
  for (const row of monthDoorRows) {
    const existing = custTotals.get(row.customer_key)
    if (existing) existing.total += calcRevenue(row)
    else custTotals.set(row.customer_key, { name: row.customer_name, total: calcRevenue(row) })
  }
  const topCustomers = Array.from(custTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(c => ({ name: c.name, total_value: c.total }))

  const prodTotals = new Map<string, { name: string; total: number }>()
  for (const row of monthDoorRows) {
    const existing = prodTotals.get(row.sku_code)
    if (existing) existing.total += calcRevenue(row)
    else prodTotals.set(row.sku_code, { name: row.sku_name, total: calcRevenue(row) })
  }
  const topProducts = Array.from(prodTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(p => ({ name: p.name, total_value: p.total }))

  const top10: DashboardData['top10'] = { customers: topCustomers, products: topProducts }

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
