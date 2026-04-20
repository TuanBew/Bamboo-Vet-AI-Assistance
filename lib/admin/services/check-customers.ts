import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckCustomersFilters {
  distributor_id: string  // ship_from_code or '' for all
  search: string
  page: number
  page_size: number
  customer_key_filter: string
  customer_name_filter: string
  province: string        // province_name
  town: string            // town_name (labeled Phường/Xã)
  cust_class_key: string
  has_geo: string         // 'yes' | 'no' | ''
}

export interface CustClassOption {
  cust_class_key: string
  cust_class_name: string
}

export interface LocationHierarchy {
  provinces: string[]
  towns: Array<{ province_name: string; town_name: string }>
}

export interface CustomerRow {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  address: string
  town_name: string
  dist_province: string
  province_name: string
  lat: number | null
  long: number | null
  ship_from_code: string
  ship_from_name: string
}

export interface MapPin {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  lat: number
  long: number
}

export interface RevenuePivotRow {
  brand: string
  month: string
  revenue: number
}

export interface CheckCustomersData {
  map_pins: MapPin[]
  customers: {
    data: CustomerRow[]
    total: number
    page: number
    page_size: number
  }
  npp_options: Array<{ ship_from_code: string; ship_from_name: string }>
  cust_class_options: CustClassOption[]
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface DoorCustomerRow {
  customer_key: string
  customer_name: string
  cust_class_key: string | null
  cust_class_name: string | null
  address: string | null
  town_name: string | null
  dist_province: string | null
  province_name: string | null
  lat: number | null
  long: number | null
  ship_from_code: string | null
  ship_from_name: string | null
}

interface CountRow { total: number }
interface NppRow { ship_from_code: string; ship_from_name: string }
interface ClassRow { cust_class_key: string; cust_class_name: string }

// ---------------------------------------------------------------------------
// Shared WHERE builder
// ---------------------------------------------------------------------------

function buildCustomerWhere(filters: CheckCustomersFilters): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = ['1=1']
  const params: unknown[] = []

  if (filters.distributor_id) {
    conditions.push('ShipFromCode = ?')
    params.push(filters.distributor_id)
  }
  if (filters.search) {
    conditions.push('(CustomerKey LIKE ? OR CustomerName LIKE ?)')
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  if (filters.customer_key_filter) {
    conditions.push('CustomerKey LIKE ?')
    params.push(`%${filters.customer_key_filter}%`)
  }
  if (filters.customer_name_filter) {
    conditions.push('CustomerName LIKE ?')
    params.push(`%${filters.customer_name_filter}%`)
  }
  if (filters.province) {
    conditions.push('ProvinceName = ?')
    params.push(filters.province)
  }
  if (filters.town) {
    conditions.push('TownName = ?')
    params.push(filters.town)
  }
  if (filters.cust_class_key) {
    conditions.push('CustClassKey = ?')
    params.push(filters.cust_class_key)
  }
  if (filters.has_geo === 'yes') {
    conditions.push('Lat IS NOT NULL AND `Long` IS NOT NULL')
  } else if (filters.has_geo === 'no') {
    conditions.push('(Lat IS NULL OR `Long` IS NULL)')
  }

  return { conditions, params }
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  // LEGACY SUPABASE: db.rpc('get_check_customers_map_pins', {...})
  // LEGACY SUPABASE: db.rpc('get_check_customers_list', {...})
  // LEGACY SUPABASE: db.rpc('get_door_npp_options')
  // LEGACY SUPABASE: db.rpc('get_check_customers_class_options')

  const { conditions, params } = buildCustomerWhere(filters)
  const whereClause = 'WHERE ' + conditions.join(' AND ')

  const customerSql = `
    SELECT
      CustomerKey       AS customer_key,
      MAX(CustomerName) AS customer_name,
      MAX(CustClassKey) AS cust_class_key,
      MAX(CustClassName) AS cust_class_name,
      MAX(Address)      AS address,
      MAX(TownName)     AS town_name,
      MAX(DistProvince) AS dist_province,
      MAX(ProvinceName) AS province_name,
      MAX(Lat)          AS lat,
      MAX(\`Long\`)     AS long,
      MAX(ShipFromCode) AS ship_from_code,
      MAX(ShipFromName) AS ship_from_name
    FROM \`_door\`
    ${whereClause}
    GROUP BY CustomerKey
    ORDER BY customer_name
    LIMIT ?, ?
  `
  const countSql = `
    SELECT COUNT(DISTINCT CustomerKey) AS total
    FROM \`_door\`
    ${whereClause}
  `
  const mapPinSql = `
    SELECT
      CustomerKey        AS customer_key,
      MAX(CustomerName)  AS customer_name,
      MAX(CustClassKey)  AS cust_class_key,
      MAX(CustClassName) AS cust_class_name,
      MAX(Lat)           AS lat,
      MAX(\`Long\`)      AS long
    FROM \`_door\`
    WHERE Lat IS NOT NULL AND \`Long\` IS NOT NULL
    ${filters.distributor_id ? 'AND ShipFromCode = ?' : ''}
    GROUP BY CustomerKey
  `

  const [customerRows, countRows, mapPinRows, nppRows, classRows] = await Promise.all([
    query<DoorCustomerRow>(customerSql, [...params, (filters.page - 1) * filters.page_size, filters.page_size]),
    query<CountRow>(countSql, params),
    query<{ customer_key: string; customer_name: string; cust_class_key: string | null; cust_class_name: string | null; lat: number; long: number }>(
      mapPinSql,
      filters.distributor_id ? [filters.distributor_id] : []
    ),
    query<NppRow>(
      'SELECT DISTINCT ShipFromCode AS ship_from_code, ShipFromName AS ship_from_name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ship_from_name',
      []
    ),
    query<ClassRow>(
      'SELECT DISTINCT CustClassKey AS cust_class_key, CustClassName AS cust_class_name FROM `_door` WHERE CustClassKey IS NOT NULL ORDER BY cust_class_name',
      []
    ),
  ])

  const customers: CustomerRow[] = customerRows.map(r => ({
    customer_key:   r.customer_key,
    customer_name:  r.customer_name,
    cust_class_key: r.cust_class_key  || '',
    cust_class_name: r.cust_class_name || '',
    address:        r.address         || '',
    town_name:      r.town_name       || '',
    dist_province:  r.dist_province   || '',
    province_name:  r.province_name   || '',
    lat:  r.lat  != null ? Number(r.lat)  : null,
    long: r.long != null ? Number(r.long) : null,
    ship_from_code: r.ship_from_code  || '',
    ship_from_name: r.ship_from_name  || '',
  }))

  const map_pins: MapPin[] = mapPinRows.map(r => ({
    customer_key:    r.customer_key,
    customer_name:   r.customer_name,
    cust_class_key:  r.cust_class_key  || '',
    cust_class_name: r.cust_class_name || '',
    lat:  Number(r.lat),
    long: Number(r.long),
  }))

  const nppSeen = new Map<string, string>()
  for (const r of nppRows) {
    if (r.ship_from_code && !nppSeen.has(r.ship_from_code)) {
      nppSeen.set(r.ship_from_code, r.ship_from_name || r.ship_from_code)
    }
  }
  const npp_options = Array.from(nppSeen.entries()).map(([ship_from_code, ship_from_name]) => ({ ship_from_code, ship_from_name }))

  const classSeen = new Map<string, string>()
  for (const r of classRows) {
    if (r.cust_class_key && !classSeen.has(r.cust_class_key)) {
      classSeen.set(r.cust_class_key, r.cust_class_name || r.cust_class_key)
    }
  }
  const cust_class_options: CustClassOption[] = Array.from(classSeen.entries()).map(([cust_class_key, cust_class_name]) => ({ cust_class_key, cust_class_name }))

  return {
    map_pins,
    customers: {
      data:      customers,
      total:     Number(countRows[0]?.total ?? 0),
      page:      filters.page,
      page_size: filters.page_size,
    },
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

  interface LocationRow {
    province_name: string | null
    town_name: string | null
  }

  const rows = await query<LocationRow>(
    'SELECT DISTINCT ProvinceName AS province_name, TownName AS town_name FROM `_door` WHERE ProvinceName IS NOT NULL ORDER BY province_name, town_name',
    []
  )

  const provinceSet = new Set<string>()
  const towns: Array<{ province_name: string; town_name: string }> = []

  for (const r of rows) {
    const p = r.province_name!
    provinceSet.add(p)
    if (r.town_name) {
      towns.push({ province_name: p, town_name: r.town_name })
    }
  }

  return {
    provinces: Array.from(provinceSet),
    towns,
  }
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions for Mã KH / Tên KH
// ---------------------------------------------------------------------------

export async function getCustomerAutocomplete(
  field: 'customer_key' | 'customer_name',
  searchQuery: string,
  limit = 10
): Promise<string[]> {
  // LEGACY SUPABASE: db.rpc('get_check_customers_autocomplete', { p_field, p_query, p_limit })

  interface AutoRow { val: string }

  const col = field === 'customer_key' ? 'CustomerKey' : 'CustomerName'
  const rows = await query<AutoRow>(
    `SELECT DISTINCT ${col} AS val FROM \`_door\` WHERE ${col} LIKE ? AND ${col} IS NOT NULL ORDER BY ${col} LIMIT ?`,
    [`%${searchQuery}%`, limit]
  )
  return rows.map(r => r.val)
}

// ---------------------------------------------------------------------------
// Per-customer revenue pivot
// ---------------------------------------------------------------------------

export async function getCustomerRevenue(
  customerKey: string
): Promise<RevenuePivotRow[]> {
  // LEGACY SUPABASE: db.rpc('get_customer_revenue', { p_customer_key })

  interface RevenueRow {
    brand: string | null
    month: string
    revenue: number
  }

  const rows = await query<RevenueRow>(`
    SELECT
      Brand AS brand,
      DATE_FORMAT(OffDate, '%Y-%m') AS month,
      SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS revenue
    FROM \`_door\`
    WHERE CustomerKey = ?
    GROUP BY Brand, DATE_FORMAT(OffDate, '%Y-%m')
    ORDER BY month, brand
  `, [customerKey])

  return rows.map(r => ({
    brand:   r.brand || 'Khác',
    month:   r.month,
    revenue: Number(r.revenue ?? 0),
  }))
}
