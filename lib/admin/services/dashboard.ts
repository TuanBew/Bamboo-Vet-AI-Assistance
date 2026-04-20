import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'
import { computeMovingAverageForecast } from '@/lib/admin/forecast'

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
    kenh_list: string[]
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
      customer_type_code: string
    }>
  }
  top10: {
    customers: Array<{ name: string; total_value: number }>
    products: Array<{ name: string; total_value: number }>
  }
}

// Fast data: everything computable from RPCs + bounded month-scoped row fetches
export interface DashboardFastData {
  npp_list: DashboardData['npp_list']
  filter_options: DashboardData['filter_options']
  yearly_series: DashboardData['yearly_series']
  monthly_series: DashboardData['monthly_series']
  kpi_row: DashboardData['kpi_row']
  metrics_box: DashboardData['metrics_box']
  daily_series: DashboardData['daily_series']
  pie_nhap: DashboardData['pie_nhap']
  pie_ban: DashboardData['pie_ban']
}

// Slow data: everything requiring raw row fetches + heavy JS aggregation
export interface DashboardSlowData {
  staff_list: DashboardData['staff_list']
  customer_section: DashboardData['customer_section']
  top10: DashboardData['top10']
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
  cust_class_key: string | null
  cust_class_name: string | null   // actual customer class: ĐẠI LÝ THÚ Y, CÔNG TY, TRẠI, etc.
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
// WHERE clause builders
// ---------------------------------------------------------------------------

function doorOptionalFilters(f: DashboardFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (f.npp)        { clauses.push('ShipFromCode = ?'); params.push(f.npp) }
  if (f.nganhHang)  { clauses.push('Category = ?');     params.push(f.nganhHang) }
  if (f.thuongHieu) { clauses.push('Brand = ?');        params.push(f.thuongHieu) }
  if (f.kenh)       { clauses.push('V_Chanel = ?');     params.push(f.kenh) }
  return { clauses, params }
}

function dpurOptionalFilters(f: DashboardFilters): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (f.npp)        { clauses.push('SiteCode = ?');  params.push(f.npp) }
  if (f.nganhHang)  { clauses.push('Category = ?');  params.push(f.nganhHang) }
  if (f.thuongHieu) { clauses.push('Brand = ?');     params.push(f.thuongHieu) }
  return { clauses, params }
}

function whereAnd(base: string[], extra: string[]): string {
  return 'WHERE ' + [...base, ...extra].join(' AND ')
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData> {
  // LEGACY SUPABASE: createServiceClient() + chained query builder + 9 db.rpc() calls

  const { year, month } = parseMonth(filters.month)
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${lastDayOfMonth(year, month)}`
  const daysInMonth = lastDayOfMonth(year, month)
  const prevYear = year - 1
  const prevStartOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-01`
  const prevEndOfMonth = `${prevYear}-${String(month).padStart(2, '0')}-${lastDayOfMonth(prevYear, month)}`

  const doorOpt  = doorOptionalFilters(filters)
  const dpurOpt  = dpurOptionalFilters(filters)

  // -----------------------------------------------------------------------
  // 1. Build all queries
  // -----------------------------------------------------------------------

  // Yearly aggregates
  const doorYearlySql = `
    SELECT YEAR(OffDate) AS yr,
           SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang
    FROM \`_door\`
    ${doorOpt.clauses.length ? whereAnd([], doorOpt.clauses) : ''}
    GROUP BY YEAR(OffDate) ORDER BY yr
  `
  const dpurYearlySql = `
    SELECT YEAR(PurDate) AS yr,
           SUM(CASE WHEN Trntyp = 'I' THEN PRAmt + PRTaxAmt ELSE -(PRAmt + PRTaxAmt) END) AS nhap_hang
    FROM \`_dpur\`
    ${dpurOpt.clauses.length ? whereAnd([], dpurOpt.clauses) : ''}
    GROUP BY YEAR(PurDate) ORDER BY yr
  `

  // Monthly aggregates
  const doorMonthlySql = `
    SELECT YEAR(OffDate) AS yr, MONTH(OffDate) AS mo,
           SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang
    FROM \`_door\`
    ${doorOpt.clauses.length ? whereAnd([], doorOpt.clauses) : ''}
    GROUP BY YEAR(OffDate), MONTH(OffDate) ORDER BY yr, mo
  `
  const dpurMonthlySql = `
    SELECT YEAR(PurDate) AS yr, MONTH(PurDate) AS mo,
           SUM(CASE WHEN Trntyp = 'I' THEN PRAmt + PRTaxAmt ELSE -(PRAmt + PRTaxAmt) END) AS nhap_hang
    FROM \`_dpur\`
    ${dpurOpt.clauses.length ? whereAnd([], dpurOpt.clauses) : ''}
    GROUP BY YEAR(PurDate), MONTH(PurDate) ORDER BY yr, mo
  `

  // Month-scoped door rows
  const monthDoorSql = `
    SELECT
      SalepersonKey  AS saleperson_key,  SalepersonName AS saleperson_name,
      CustomerKey    AS customer_key,    CustomerName   AS customer_name,
      CustClassKey   AS cust_class_key,  CustClassName  AS cust_class_name,
      SKUCode        AS sku_code,        SKUName        AS sku_name,
      Category       AS category,        Brand          AS brand,
      Product        AS product,         OffDate        AS off_date,
      OffQty         AS off_qty,         OffAmt         AS off_amt,
      OffDsc         AS off_dsc,         OffTaxAmt      AS off_tax_amt,
      Lat            AS lat,             \`Long\`        AS \`long\`
    FROM \`_door\`
    ${whereAnd(['OffDate >= ?', 'OffDate <= ?'], doorOpt.clauses)}
  `
  const monthDpurSql = `
    SELECT
      PurDate   AS pur_date,   PRQty    AS pr_qty,
      PRAmt     AS pr_amt,     PRTaxAmt AS pr_tax_amt,
      Trntyp    AS trntyp,     SKUCode  AS sku_code,
      SKUName   AS sku_name,   Category AS category,
      Brand     AS brand,      Product  AS product
    FROM \`_dpur\`
    ${whereAnd(['PurDate >= ?', 'PurDate <= ?'], dpurOpt.clauses)}
  `

  // Prev-year minimal rows
  const prevDoorSql = `
    SELECT OffDate AS off_date, OffQty AS off_qty, OffAmt AS off_amt,
           OffDsc AS off_dsc, OffTaxAmt AS off_tax_amt
    FROM \`_door\`
    ${whereAnd(['OffDate >= ?', 'OffDate <= ?'], doorOpt.clauses)}
  `
  const prevDpurSql = `
    SELECT PurDate AS pur_date, PRAmt AS pr_amt, PRTaxAmt AS pr_tax_amt, Trntyp AS trntyp
    FROM \`_dpur\`
    ${whereAnd(['PurDate >= ?', 'PurDate <= ?'], dpurOpt.clauses)}
  `

  // -----------------------------------------------------------------------
  // 2. Run all queries in parallel
  // -----------------------------------------------------------------------
  interface YrRow      { yr: number; ban_hang?: number; nhap_hang?: number }
  interface YrMoRow    { yr: number; mo: number; ban_hang?: number; nhap_hang?: number }
  interface NppRow     { ship_from_code: string; ship_from_name: string }
  interface OptRow     { val: string }
  interface SkuRow     { total: number }
  interface CustRow    { total: number }
  interface PrevDoorRow { off_date: string; off_qty: number; off_amt: number; off_dsc: number | null; off_tax_amt: number }
  interface PrevDpurRow { pur_date: string; pr_amt: number; pr_tax_amt: number; trntyp: string }

  const [
    nppRows,
    catRows,
    brandRows,
    channelRows,
    doorYearlyRows,
    doorMonthlyRows,
    dpurYearlyRows,
    dpurMonthlyRows,
    monthDoorRows,
    monthDpurRows,
    prevDoorRows,
    prevDpurRows,
    skuTotalRows,
    totalCustRows,
  ] = await Promise.all([
    // LEGACY SUPABASE: db.rpc('dashboard_npp_list')
    query<NppRow>('SELECT DISTINCT ShipFromCode AS ship_from_code, ShipFromName AS ship_from_name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ship_from_name', []),
    // LEGACY SUPABASE: db.rpc('dashboard_categories')
    query<OptRow>('SELECT DISTINCT Category AS val FROM `_door` WHERE Category IS NOT NULL ORDER BY val', []),
    // LEGACY SUPABASE: db.rpc('dashboard_brands')
    query<OptRow>('SELECT DISTINCT Brand AS val FROM `_door` WHERE Brand IS NOT NULL ORDER BY val', []),
    // LEGACY SUPABASE: db.rpc('dashboard_channels')
    query<OptRow>('SELECT DISTINCT V_Chanel AS val FROM `_door` WHERE V_Chanel IS NOT NULL ORDER BY val', []),
    // LEGACY SUPABASE: db.rpc('dashboard_door_yearly', {...})
    query<YrRow>(doorYearlySql, doorOpt.params),
    // LEGACY SUPABASE: db.rpc('dashboard_door_monthly', {...})
    query<YrMoRow>(doorMonthlySql, doorOpt.params),
    // LEGACY SUPABASE: db.rpc('dashboard_dpur_yearly', {...})
    query<YrRow>(dpurYearlySql, dpurOpt.params),
    // LEGACY SUPABASE: db.rpc('dashboard_dpur_monthly', {...})
    query<YrMoRow>(dpurMonthlySql, dpurOpt.params),
    // LEGACY SUPABASE: db.from('door').select(...).gte().lte() + filters
    query<DoorRow>(monthDoorSql, [startOfMonth, endOfMonth, ...doorOpt.params]),
    // LEGACY SUPABASE: db.from('dpur').select(...).gte().lte() + filters
    query<DpurRow>(monthDpurSql, [startOfMonth, endOfMonth, ...dpurOpt.params]),
    // LEGACY SUPABASE: db.from('door').select('off_date,...').gte().lte() + filters (prev year)
    query<PrevDoorRow>(prevDoorSql, [prevStartOfMonth, prevEndOfMonth, ...doorOpt.params]),
    // LEGACY SUPABASE: db.from('dpur').select('pur_date,...').gte().lte() + filters (prev year)
    query<PrevDpurRow>(prevDpurSql, [prevStartOfMonth, prevEndOfMonth, ...dpurOpt.params]),
    // LEGACY SUPABASE: db.from('product').select('sku_code', { count: 'exact', head: true })
    query<SkuRow>('SELECT COUNT(DISTINCT SKUCode) AS total FROM `_product`', []),
    // LEGACY SUPABASE: db.rpc('dashboard_total_customer_count', {...})
    query<CustRow>(`SELECT COUNT(DISTINCT CustomerKey) AS total FROM \`_door\` ${doorOpt.clauses.length ? whereAnd([], doorOpt.clauses) : ''}`, doorOpt.params),
  ])

  // -----------------------------------------------------------------------
  // 2. Process filter options
  // -----------------------------------------------------------------------
  const nppMap = new Map<string, string>()
  for (const row of nppRows) {
    nppMap.set(row.ship_from_code, row.ship_from_name || row.ship_from_code)
  }
  const npp_list = Array.from(nppMap.entries()).map(([id, name]) => ({ id, name }))

  const nganh_hang = catRows.map(r => r.val)
  const thuong_hieu = brandRows.map(r => r.val)
  const kenh_list = channelRows.map(r => r.val)
  const filter_options = { nganh_hang, thuong_hieu, kenh_list }

  // -----------------------------------------------------------------------
  // 3. Yearly series from aggregate query results
  // -----------------------------------------------------------------------
  const yearlyBanMap = new Map<number, number>()
  for (const row of doorYearlyRows) {
    if (row.yr) yearlyBanMap.set(Number(row.yr), Number(row.ban_hang ?? 0))
  }

  const yearlyNhapMap = new Map<number, number>()
  for (const row of dpurYearlyRows) {
    if (row.yr) yearlyNhapMap.set(Number(row.yr), Number(row.nhap_hang ?? 0))
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
  // 4. Monthly series + forecast from aggregate query results
  // -----------------------------------------------------------------------
  const monthlyBanMap = new Map<string, number>()
  for (const row of doorMonthlyRows) {
    if (row.yr && row.mo) {
      monthlyBanMap.set(`${row.yr}-${row.mo}`, Number(row.ban_hang ?? 0))
    }
  }

  const monthlyNhapMap = new Map<string, number>()
  for (const row of dpurMonthlyRows) {
    if (row.yr && row.mo) {
      monthlyNhapMap.set(`${row.yr}-${row.mo}`, Number(row.nhap_hang ?? 0))
    }
  }

  const allMonthKeys = new Set([...monthlyBanMap.keys(), ...monthlyNhapMap.keys()])
  const monthlyArr = Array.from(allMonthKeys)
    .map(k => {
      const [y, m] = k.split('-').map(Number)
      return { year: y, month: m, ban_hang: monthlyBanMap.get(k) ?? 0, nhap_hang: monthlyNhapMap.get(k) ?? 0 }
    })
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  const banForecast = computeMovingAverageForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, value: d.ban_hang }))
  )
  const nhapForecast = computeMovingAverageForecast(
    monthlyArr.map(d => ({ year: d.year, month: d.month, value: d.nhap_hang }))
  )

  const monthlySeriesMap = new Map<string, { year: number; month: number; ban_hang: number; nhap_hang: number; is_forecast: boolean }>()
  for (const fp of banForecast) {
    const key = `${fp.year}-${fp.month}`
    monthlySeriesMap.set(key, { year: fp.year, month: fp.month, ban_hang: fp.value, nhap_hang: 0, is_forecast: fp.is_forecast })
  }
  for (const fp of nhapForecast) {
    const key = `${fp.year}-${fp.month}`
    const existing = monthlySeriesMap.get(key)
    if (existing) {
      existing.nhap_hang = fp.value
      if (fp.is_forecast) existing.is_forecast = true
    } else {
      monthlySeriesMap.set(key, { year: fp.year, month: fp.month, ban_hang: 0, nhap_hang: fp.value, is_forecast: fp.is_forecast })
    }
  }
  const monthly_series = Array.from(monthlySeriesMap.values())
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))

  // -----------------------------------------------------------------------
  // 5. Normalise row numbers from MySQL (returned as strings/decimals)
  // -----------------------------------------------------------------------
  const normDoor: DoorRow[] = monthDoorRows.map(r => ({
    ...r,
    off_qty:     Number(r.off_qty     ?? 0),
    off_amt:     Number(r.off_amt     ?? 0),
    off_dsc:     r.off_dsc != null ? Number(r.off_dsc) : null,
    off_tax_amt: Number(r.off_tax_amt ?? 0),
    lat:  r.lat  != null ? Number(r.lat)  : null,
    long: r.long != null ? Number(r.long) : null,
  }))

  const normDpur: DpurRow[] = monthDpurRows.map(r => ({
    ...r,
    pr_qty:     Number(r.pr_qty     ?? 0),
    pr_amt:     Number(r.pr_amt     ?? 0),
    pr_tax_amt: Number(r.pr_tax_amt ?? 0),
  }))

  const normPrevDoor = prevDoorRows.map(r => ({
    ...r,
    off_qty:     Number(r.off_qty     ?? 0),
    off_amt:     Number(r.off_amt     ?? 0),
    off_dsc:     r.off_dsc != null ? Number(r.off_dsc) : null,
    off_tax_amt: Number(r.off_tax_amt ?? 0),
  }))

  const normPrevDpur = prevDpurRows.map(r => ({
    ...r,
    pr_amt:     Number(r.pr_amt     ?? 0),
    pr_tax_amt: Number(r.pr_tax_amt ?? 0),
  }))

  // -----------------------------------------------------------------------
  // 6. Daily series for selected month
  // -----------------------------------------------------------------------
  const dailyBanMap = new Map<number, number>()
  for (const row of normDoor) {
    const day = new Date(row.off_date).getDate()
    dailyBanMap.set(day, (dailyBanMap.get(day) ?? 0) + calcRevenue(row))
  }

  const dailyNhapMap = new Map<number, number>()
  for (const row of normDpur) {
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
  const banHangMonth = normDoor.reduce((s, r) => s + calcRevenue(r), 0)

  let nhapHangMonth = 0
  for (const row of normDpur) {
    const val = calcPurchaseValue(row)
    if (row.trntyp === 'I') nhapHangMonth += val
    else if (row.trntyp === 'D') nhapHangMonth -= val
  }

  const activeCustomerKeys = new Set(normDoor.map(r => r.customer_key))
  const soldSkuCodes = new Set(normDoor.map(r => r.sku_code))
  const nhanVienInMonth = new Set(normDoor.map(r => r.saleperson_key))
  const customers_total = Number(totalCustRows[0]?.total ?? 0)

  const metrics_box: DashboardData['metrics_box'] = {
    nhap_hang: nhapHangMonth,
    ban_hang: banHangMonth,
    customers_active: activeCustomerKeys.size,
    customers_total,
    sku_sold: soldSkuCodes.size,
    sku_total: Number(skuTotalRows[0]?.total ?? 0),
    nhan_vien: nhanVienInMonth.size,
  }

  // -----------------------------------------------------------------------
  // 8. Pie charts (month-scoped)
  // -----------------------------------------------------------------------
  const pieNhapNganh = new Map<string, number>()
  const pieNhapNhom = new Map<string, number>()
  const pieNhapTH = new Map<string, number>()

  for (const row of normDpur) {
    const val = row.trntyp === 'I' ? calcPurchaseValue(row) : -calcPurchaseValue(row)
    pieNhapNganh.set(row.category || 'Khac', (pieNhapNganh.get(row.category || 'Khac') ?? 0) + val)
    pieNhapNhom.set(row.product || 'Khac',   (pieNhapNhom.get(row.product || 'Khac')   ?? 0) + val)
    pieNhapTH.set(row.brand || 'Khac',       (pieNhapTH.get(row.brand || 'Khac')       ?? 0) + val)
  }

  const pieBanNganh = new Map<string, number>()
  const pieBanNhom = new Map<string, number>()
  const pieBanTH = new Map<string, number>()

  for (const row of normDoor) {
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
  const slBan = normDoor.filter(r => !isFreePromo(r)).reduce((s, r) => s + r.off_qty, 0)
  const slKm  = normDoor.filter(r => isFreePromo(r)).reduce((s, r) => s + r.off_qty, 0)

  const orderTransactions = new Set(normDoor.map(r => `${r.customer_key}|${r.off_date}`))
  const avgPerOrder = orderTransactions.size > 0 ? Math.round(banHangMonth / orderTransactions.size) : 0

  const prevYearBan = normPrevDoor.reduce((s, r) => s + calcRevenue(r), 0)
  let prevYearNhap = 0
  for (const row of normPrevDpur) {
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
  for (const row of normDoor) {
    if (!staffKeyToName.has(row.saleperson_key)) {
      staffKeyToName.set(row.saleperson_key, row.saleperson_name || row.saleperson_key)
    }
  }

  const staff_list: DashboardData['staff_list'] = []
  for (const [sid, sname] of staffKeyToName.entries()) {
    const myRows = normDoor.filter(r => r.saleperson_key === sid)
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
  // 11. Customer section — uses cust_class_name (real store types)
  //     Map pins computed directly from normDoor (no separate RPC needed)
  // -----------------------------------------------------------------------
  const typeSalesMap = new Map<string, number>()
  for (const row of normDoor) {
    const type = row.cust_class_name || 'Khác'
    typeSalesMap.set(type, (typeSalesMap.get(type) ?? 0) + calcRevenue(row))
  }
  const by_type_sales = Array.from(typeSalesMap.entries())
    .map(([type, ban_hang]) => ({ type, ban_hang }))
    .sort((a, b) => b.ban_hang - a.ban_hang)

  const typeCustomerMap = new Map<string, Set<string>>()
  for (const row of normDoor) {
    const type = row.cust_class_name || 'Khác'
    if (!typeCustomerMap.has(type)) typeCustomerMap.set(type, new Set())
    typeCustomerMap.get(type)!.add(row.customer_key)
  }
  const by_type_count = Array.from(typeCustomerMap.entries())
    .map(([type, keySet]) => ({ type, count: keySet.size }))
    .sort((a, b) => b.count - a.count)

  const customerInfoMap = new Map<string, { name: string; type: string; typeCode: string; lat: number; long: number; revenue: number }>()
  for (const row of normDoor) {
    if (row.lat && row.long) {
      const existing = customerInfoMap.get(row.customer_key)
      const rawKey = row.cust_class_key
      const typeCode = !rawKey || rawKey.toUpperCase() === 'OTHER' ? 'OTHER' : rawKey
      customerInfoMap.set(row.customer_key, {
        name: row.customer_name,
        type: row.cust_class_name || 'Khác',
        typeCode,
        lat: row.lat,
        long: row.long,
        revenue: (existing?.revenue ?? 0) + calcRevenue(row),
      })
    }
  }

  const map_pins: DashboardData['customer_section']['map_pins'] = Array.from(customerInfoMap.entries()).map(
    ([key, info]) => ({
      id: key,
      latitude: info.lat,
      longitude: info.long,
      label: info.name,
      popup: `${info.name}: ${info.revenue.toLocaleString('vi-VN')} VND`,
      customer_type: info.type,
      customer_type_code: info.typeCode,
    })
  )

  const customer_section: DashboardData['customer_section'] = { by_type_sales, by_type_count, map_pins }

  // -----------------------------------------------------------------------
  // 12. Top 10 (month-scoped)
  // -----------------------------------------------------------------------
  const custTotals = new Map<string, { name: string; total: number }>()
  for (const row of normDoor) {
    const existing = custTotals.get(row.customer_key)
    if (existing) existing.total += calcRevenue(row)
    else custTotals.set(row.customer_key, { name: row.customer_name, total: calcRevenue(row) })
  }
  const topCustomers = Array.from(custTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(c => ({ name: c.name, total_value: c.total }))

  const prodTotals = new Map<string, { name: string; total: number }>()
  for (const row of normDoor) {
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

// ---------------------------------------------------------------------------
// Fast data: aggregate queries + bounded month-scoped row fetches
// (everything except heavy JS aggregation over large row sets)
// ---------------------------------------------------------------------------

async function getDashboardFastData(
  filters: DashboardFilters
): Promise<DashboardFastData> {
  const full = await getDashboardData(filters)
  return {
    npp_list: full.npp_list,
    filter_options: full.filter_options,
    yearly_series: full.yearly_series,
    monthly_series: full.monthly_series,
    kpi_row: full.kpi_row,
    metrics_box: full.metrics_box,
    daily_series: full.daily_series,
    pie_nhap: full.pie_nhap,
    pie_ban: full.pie_ban,
  }
}

// ---------------------------------------------------------------------------
// Slow data: heavy JS aggregation over large row sets
// ---------------------------------------------------------------------------

async function getDashboardSlowData(
  filters: DashboardFilters
): Promise<DashboardSlowData> {
  const full = await getDashboardData(filters)
  return {
    staff_list: full.staff_list,
    customer_section: full.customer_section,
    top10: full.top10,
  }
}

// ---------------------------------------------------------------------------
// Cached exports
// ---------------------------------------------------------------------------

export const getCachedDashboardFastData = unstable_cache(
  getDashboardFastData,
  ['dashboard-fast'],
  { tags: ['dashboard-fast'], revalidate: 3600 }
)

export const getCachedDashboardSlowData = unstable_cache(
  getDashboardSlowData,
  ['dashboard-slow'],
  { tags: ['dashboard-slow'], revalidate: 3600 }
)
