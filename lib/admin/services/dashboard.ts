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

/** Revenue formula: off_amt + off_tax_amt - off_dsc, only for non-promo rows */
function calcRevenue(row: { off_amt: number; off_tax_amt: number; off_dsc: number }): number {
  return row.off_amt + row.off_tax_amt - row.off_dsc
}

/** Purchase value formula: pr_amt + pr_tax_amt */
function calcPurchaseValue(row: { pr_amt: number; pr_tax_amt: number }): number {
  return row.pr_amt + row.pr_tax_amt
}

/** Returns true if row is a promotion (should NOT count in revenue) */
function isPromo(programId: string | null | undefined): boolean {
  return programId !== null && programId !== undefined && programId !== ''
}

const toNameValue = (map: Map<string, number>) =>
  Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

// ---------------------------------------------------------------------------
// Door row type (sales)
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
  off_dsc: number
  off_tax_amt: number
  program_id: string | null
  lat: number | null
  long: number | null
  year: number
}

// ---------------------------------------------------------------------------
// Dpur row type (purchases)
// ---------------------------------------------------------------------------
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
  site_code: string
  year: number
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

  // -----------------------------------------------------------------------
  // 1. Filter Options: NPP list, nganh_hang, thuong_hieu, kenh
  // -----------------------------------------------------------------------
  const [nppResult, nganhResult, thuongHieuResult] = await Promise.all([
    db.from('door').select('ship_from_code, ship_from_name').not('ship_from_code', 'is', null),
    db.from('door').select('category').not('category', 'is', null),
    db.from('door').select('brand').not('brand', 'is', null),
  ])

  // NPP list — deduplicated by ship_from_code
  const nppMap = new Map<string, string>()
  for (const row of (nppResult.data ?? []) as Array<{ ship_from_code: string; ship_from_name: string }>) {
    if (row.ship_from_code && !nppMap.has(row.ship_from_code)) {
      nppMap.set(row.ship_from_code, row.ship_from_name || row.ship_from_code)
    }
  }
  const npp_list = Array.from(nppMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // nganh_hang list
  const nganhSet = new Set<string>()
  for (const row of (nganhResult.data ?? []) as Array<{ category: string }>) {
    if (row.category) nganhSet.add(row.category)
  }
  const nganh_hang = Array.from(nganhSet).sort()

  // thuong_hieu list
  const thuongHieuSet = new Set<string>()
  for (const row of (thuongHieuResult.data ?? []) as Array<{ brand: string }>) {
    if (row.brand) thuongHieuSet.add(row.brand)
  }
  const thuong_hieu = Array.from(thuongHieuSet).sort()

  const filter_options = { nganh_hang, thuong_hieu }

  // -----------------------------------------------------------------------
  // 2. Fetch ALL door rows (for yearly/monthly series, not month-scoped)
  //    Apply npp / nganhHang / thuongHieu / kenh filters via Supabase
  // -----------------------------------------------------------------------

  // Fetch ALL door rows (all time, for yearly/monthly series)
  let doorQuery = db.from('door').select(
    'saleperson_key,saleperson_name,customer_key,customer_name,type_name,sku_code,sku_name,category,brand,product,off_date,off_qty,off_amt,off_dsc,off_tax_amt,program_id,lat,long,year'
  )
  if (filters.npp)        doorQuery = doorQuery.eq('ship_from_code', filters.npp)
  if (filters.nganhHang)  doorQuery = doorQuery.eq('category', filters.nganhHang)
  if (filters.thuongHieu) doorQuery = doorQuery.eq('brand', filters.thuongHieu)
  if (filters.kenh)       doorQuery = doorQuery.eq('v_chanel', filters.kenh)

  const { data: allDoorData } = await doorQuery
  const allDoorRows = (allDoorData ?? []) as DoorRow[]

  // Fetch ALL dpur rows (all time, for yearly/monthly series)
  let dpurQuery = db.from('dpur').select(
    'pur_date,pr_qty,pr_amt,pr_tax_amt,trntyp,sku_code,sku_name,category,brand,product,site_code,year'
  )
  if (filters.npp)        dpurQuery = dpurQuery.eq('site_code', filters.npp)
  if (filters.nganhHang)  dpurQuery = dpurQuery.eq('category', filters.nganhHang)
  if (filters.thuongHieu) dpurQuery = dpurQuery.eq('brand', filters.thuongHieu)

  const { data: allDpurData } = await dpurQuery
  const allDpurRows = (allDpurData ?? []) as DpurRow[]

  // Month-scoped subsets
  const monthDoorRows = allDoorRows.filter(r => r.off_date >= startOfMonth && r.off_date <= endOfMonth)
  const monthDpurRows = allDpurRows.filter(r => r.pur_date >= startOfMonth && r.pur_date <= endOfMonth)

  // Previous year month subsets
  const prevDoorRows = allDoorRows.filter(r => r.off_date >= prevStartOfMonth && r.off_date <= prevEndOfMonth)
  const prevDpurRows = allDpurRows.filter(r => r.pur_date >= prevStartOfMonth && r.pur_date <= prevEndOfMonth)

  // -----------------------------------------------------------------------
  // 3. Total SKU count from product table
  // -----------------------------------------------------------------------
  const { count: skuTotalCount } = await db
    .from('product')
    .select('sku_code', { count: 'exact', head: true })
  const sku_total = skuTotalCount ?? 0

  // -----------------------------------------------------------------------
  // 4. Yearly series (NOT month-scoped)
  // -----------------------------------------------------------------------
  const yearlyBanMap = new Map<number, number>()
  const yearlyNhapMap = new Map<number, number>()

  for (const row of allDoorRows) {
    if (isPromo(row.program_id)) continue
    const y = row.year || new Date(row.off_date).getFullYear()
    yearlyBanMap.set(y, (yearlyBanMap.get(y) ?? 0) + calcRevenue(row))
  }
  for (const row of allDpurRows) {
    const y = row.year || new Date(row.pur_date).getFullYear()
    const val = calcPurchaseValue(row)
    const current = yearlyNhapMap.get(y) ?? 0
    if (row.trntyp === 'I') {
      yearlyNhapMap.set(y, current + val)
    } else if (row.trntyp === 'D') {
      yearlyNhapMap.set(y, current - val)
    }
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
  // 5. Monthly series + forecast (NOT month-scoped)
  // -----------------------------------------------------------------------
  const monthlyBanMap = new Map<string, number>()
  const monthlyNhapMap = new Map<string, number>()

  for (const row of allDoorRows) {
    if (isPromo(row.program_id)) continue
    const d = new Date(row.off_date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    monthlyBanMap.set(key, (monthlyBanMap.get(key) ?? 0) + calcRevenue(row))
  }
  for (const row of allDpurRows) {
    const d = new Date(row.pur_date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const current = monthlyNhapMap.get(key) ?? 0
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') {
      monthlyNhapMap.set(key, current + val)
    } else if (row.trntyp === 'D') {
      monthlyNhapMap.set(key, current - val)
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
  // 6. Daily series for selected month
  // -----------------------------------------------------------------------
  const dailyBanMap = new Map<number, number>()
  const dailyNhapMap = new Map<number, number>()

  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    const day = new Date(row.off_date).getDate()
    dailyBanMap.set(day, (dailyBanMap.get(day) ?? 0) + calcRevenue(row))
  }
  for (const row of monthDpurRows) {
    const day = new Date(row.pur_date).getDate()
    const current = dailyNhapMap.get(day) ?? 0
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') {
      dailyNhapMap.set(day, current + val)
    } else if (row.trntyp === 'D') {
      dailyNhapMap.set(day, current - val)
    }
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
  // 7. Metrics box (month-scoped)
  // -----------------------------------------------------------------------
  const banHangMonth = monthDoorRows
    .filter(r => !isPromo(r.program_id))
    .reduce((s, r) => s + calcRevenue(r), 0)

  let nhapHangMonth = 0
  for (const row of monthDpurRows) {
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') nhapHangMonth += val
    else if (row.trntyp === 'D') nhapHangMonth -= val
  }

  const activeCustomerKeys = new Set(
    monthDoorRows
      .filter(r => !isPromo(r.program_id))
      .map(r => r.customer_key)
  )
  const totalCustomerKeys = new Set(allDoorRows.map(r => r.customer_key))

  const soldSkuCodes = new Set(
    monthDoorRows.filter(r => !isPromo(r.program_id)).map(r => r.sku_code)
  )

  // Distinct saleperson_key in the selected month
  const nhanVienInMonth = new Set(
    monthDoorRows.filter(r => !isPromo(r.program_id)).map(r => r.saleperson_key)
  )

  const metrics_box: DashboardData['metrics_box'] = {
    nhap_hang: nhapHangMonth,
    ban_hang: banHangMonth,
    customers_active: activeCustomerKeys.size,
    customers_total: totalCustomerKeys.size,
    sku_sold: soldSkuCodes.size,
    sku_total: sku_total,
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
    const nganh = row.category || 'Khac'
    const nhom = row.product || 'Khac'
    const th = row.brand || 'Khac'
    pieNhapNganh.set(nganh, (pieNhapNganh.get(nganh) ?? 0) + val)
    pieNhapNhom.set(nhom, (pieNhapNhom.get(nhom) ?? 0) + val)
    pieNhapTH.set(th, (pieNhapTH.get(th) ?? 0) + val)
  }

  const pieBanNganh = new Map<string, number>()
  const pieBanNhom = new Map<string, number>()
  const pieBanTH = new Map<string, number>()

  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    const val = calcRevenue(row)
    const nganh = row.category || 'Khac'
    const nhom = row.product || 'Khac'
    const th = row.brand || 'Khac'
    pieBanNganh.set(nganh, (pieBanNganh.get(nganh) ?? 0) + val)
    pieBanNhom.set(nhom, (pieBanNhom.get(nhom) ?? 0) + val)
    pieBanTH.set(th, (pieBanTH.get(th) ?? 0) + val)
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
  const slBan = monthDoorRows
    .filter(r => !isPromo(r.program_id))
    .reduce((s, r) => s + r.off_qty, 0)

  // Promotional quantity sold (where program_id is set)
  const slKm = monthDoorRows
    .filter(r => isPromo(r.program_id))
    .reduce((s, r) => s + r.off_qty, 0)

  // Distinct (customer_key, off_date) combos as proxy for order count
  const orderTransactions = new Set(
    monthDoorRows
      .filter(r => !isPromo(r.program_id))
      .map(r => `${r.customer_key}|${r.off_date}`)
  )
  const avgPerOrder = orderTransactions.size > 0
    ? Math.round(banHangMonth / orderTransactions.size)
    : 0

  // Previous year same month revenue
  const prevYearBan = prevDoorRows
    .filter(r => !isPromo(r.program_id))
    .reduce((s, r) => s + calcRevenue(r), 0)

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
  // 10. Staff list (month-scoped, grouped by saleperson_key)
  // -----------------------------------------------------------------------
  // Collect all unique sales people in the month
  const staffKeyToName = new Map<string, string>()
  for (const row of monthDoorRows) {
    if (!staffKeyToName.has(row.saleperson_key)) {
      staffKeyToName.set(row.saleperson_key, row.saleperson_name || row.saleperson_key)
    }
  }

  const staff_list: DashboardData['staff_list'] = []
  for (const [sid, sname] of staffKeyToName.entries()) {
    const myRows = monthDoorRows.filter(r => r.saleperson_key === sid && !isPromo(r.program_id))

    const totalSales = myRows.reduce((s, r) => s + calcRevenue(r), 0)
    const transactions = new Set(myRows.map(r => `${r.customer_key}|${r.off_date}`))
    const orderCount = transactions.size
    const customerCount = new Set(myRows.map(r => r.customer_key)).size

    // Daily sparkline
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

    // by_nhom (product group) and by_thuong_hieu (brand)
    const byNhom: Record<string, number> = {}
    const byTH: Record<string, number> = {}
    for (const r of myRows) {
      const nhom = r.product || 'Khac'
      const th = r.brand || 'Khac'
      byNhom[nhom] = (byNhom[nhom] ?? 0) + calcRevenue(r)
      byTH[th] = (byTH[th] ?? 0) + calcRevenue(r)
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

  // Sort staff by total sales descending
  staff_list.sort((a, b) => b.total_sales - a.total_sales)

  // -----------------------------------------------------------------------
  // 11. Customer section (month-scoped)
  // -----------------------------------------------------------------------
  // Revenue by type_name (store type)
  const typeSalesMap = new Map<string, number>()
  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    const type = row.type_name || 'Khac'
    typeSalesMap.set(type, (typeSalesMap.get(type) ?? 0) + calcRevenue(row))
  }
  const by_type_sales = Array.from(typeSalesMap.entries())
    .map(([type, ban_hang]) => ({ type, ban_hang }))
    .sort((a, b) => b.ban_hang - a.ban_hang)

  // Customer count by type_name (all-time, unique customers)
  const typeCustomerMap = new Map<string, Set<string>>()
  for (const row of allDoorRows) {
    const type = row.type_name || 'Khac'
    if (!typeCustomerMap.has(type)) typeCustomerMap.set(type, new Set())
    typeCustomerMap.get(type)!.add(row.customer_key)
  }
  const by_type_count = Array.from(typeCustomerMap.entries())
    .map(([type, keySet]) => ({ type, count: keySet.size }))
    .sort((a, b) => b.count - a.count)

  // Map pins: customers with lat/long, value = revenue in selected month
  const customerMonthlyTotals = new Map<string, { name: string; value: number; type: string; lat: number; long: number }>()
  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    if (row.lat == null || row.long == null) continue
    const key = row.customer_key
    const existing = customerMonthlyTotals.get(key)
    if (existing) {
      existing.value += calcRevenue(row)
    } else {
      customerMonthlyTotals.set(key, {
        name: row.customer_name,
        value: calcRevenue(row),
        type: row.type_name || 'Khac',
        lat: Number(row.lat),
        long: Number(row.long),
      })
    }
  }

  // Also add customers with lat/long who have no sales this month (value = 0)
  const seenCustomersInAllDoor = new Map<string, { name: string; type: string; lat: number; long: number }>()
  for (const row of allDoorRows) {
    if (row.lat == null || row.long == null) continue
    if (!seenCustomersInAllDoor.has(row.customer_key)) {
      seenCustomersInAllDoor.set(row.customer_key, {
        name: row.customer_name,
        type: row.type_name || 'Khac',
        lat: Number(row.lat),
        long: Number(row.long),
      })
    }
  }

  const map_pins: DashboardData['customer_section']['map_pins'] = []
  for (const [key, info] of seenCustomersInAllDoor.entries()) {
    const monthInfo = customerMonthlyTotals.get(key)
    const value = monthInfo?.value ?? 0
    map_pins.push({
      id: key,
      latitude: info.lat,
      longitude: info.long,
      label: info.name,
      popup: `${info.name}: ${value.toLocaleString('vi-VN')} VND`,
      customer_type: info.type,
    })
  }

  const customer_section: DashboardData['customer_section'] = {
    by_type_sales,
    by_type_count,
    map_pins,
  }

  // -----------------------------------------------------------------------
  // 12. Top 10 (month-scoped)
  // -----------------------------------------------------------------------
  // Top 10 customers by revenue
  const custTotals = new Map<string, { name: string; total: number }>()
  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    const existing = custTotals.get(row.customer_key)
    if (existing) {
      existing.total += calcRevenue(row)
    } else {
      custTotals.set(row.customer_key, { name: row.customer_name, total: calcRevenue(row) })
    }
  }
  const topCustomers = Array.from(custTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(c => ({ name: c.name, total_value: c.total }))

  // Top 10 products (sku) by revenue
  const prodTotals = new Map<string, { name: string; total: number }>()
  for (const row of monthDoorRows) {
    if (isPromo(row.program_id)) continue
    const existing = prodTotals.get(row.sku_code)
    if (existing) {
      existing.total += calcRevenue(row)
    } else {
      prodTotals.set(row.sku_code, { name: row.sku_name, total: calcRevenue(row) })
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
