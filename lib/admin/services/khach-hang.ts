import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KhachHangFilters {
  npp: string
}

export interface CustomerBreakdown {
  type_code: string
  type_name: string
  count: number
  pct: number
}

export interface PurchasingBreakdown {
  type_code: string
  type_name: string
  count: number
  pct_of_total: number
  pct_of_active: number
}

export interface CustomerGeoPoint {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  lat: number
  lng: number
  province: string
  address: string
  site_code: string
}

export interface KhachHangData {
  new_by_month: Array<{ month: string; count: number }>
  by_province: Array<{ name: string; count: number }>
  by_district: Array<{ name: string; count: number }>
  npp_options: Array<{ code: string; name: string }>

  all_customers: {
    kpis: {
      total: number
      active_count: number
      mapped_pct: number
      geo_pct: number
      type_count: number
    }
    breakdown: CustomerBreakdown[]
  }

  purchasing_customers: {
    kpis: {
      total_count: number
      active_count: number
      mapped_pct: number
      geo_pct: number
      type_count: number
    }
    breakdown: PurchasingBreakdown[]
  }

  geo_points: CustomerGeoPoint[]
}

// ---------------------------------------------------------------------------
// Main service function — all aggregations done in SQL (no full-table JS scan)
// ---------------------------------------------------------------------------

async function _getKhachHangData(filters: KhachHangFilters): Promise<KhachHangData> {
  // LEGACY SUPABASE: db.rpc('get_khach_hang_summary') + db.rpc('get_khach_hang_geo')

  const nppWhere = filters.npp ? 'WHERE ShipFromCode = ?' : ''
  const nppParam = filters.npp ? [filters.npp] : []

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  // Limit to last 3 years to avoid full-scan of entire _door history
  const threeYearsAgo = new Date()
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
  const scanFrom = threeYearsAgo.toISOString().slice(0, 10)

  // Subquery: one row per customer, limited to 3-year window
  const custSubSql = filters.npp
    ? `SELECT CustomerKey, MAX(CustClassKey) AS ck, MAX(CustClassName) AS cn,
              MAX(Lat) AS lat, MAX(\`Long\`) AS lng,
              MIN(OffDate) AS first_date, MAX(OffDate) AS last_date
       FROM \`_door\` WHERE OffDate >= ? AND ShipFromCode = ? GROUP BY CustomerKey`
    : `SELECT CustomerKey, MAX(CustClassKey) AS ck, MAX(CustClassName) AS cn,
              MAX(Lat) AS lat, MAX(\`Long\`) AS lng,
              MIN(OffDate) AS first_date, MAX(OffDate) AS last_date
       FROM \`_door\` WHERE OffDate >= ? GROUP BY CustomerKey`

  // Params for custSubSql: always starts with scanFrom, then optionally npp
  const custSubParam = filters.npp ? [scanFrom, filters.npp] : [scanFrom]

  interface KpiRow {
    total: number
    active_count: number
    geo_count: number
    mapped_count: number
  }
  interface MonthRow { month: string; count: number }
  interface NameCountRow { name: string; count: number }
  interface TypeBreakRow { type_code: string | null; type_name: string | null; count: number }
  interface ActiveTypeRow { type_code: string | null; type_name: string | null; active_count: number; total_count: number; geo_count: number; mapped_count: number }
  interface GeoRow { customer_key: string; customer_name: string; cust_class_key: string | null; cust_class_name: string | null; lat: number; lng: number; province_name: string | null; address: string | null; ship_from_code: string | null }
  interface NppRow { code: string; name: string }

  const [kpiRows, monthRows, provinceRows, districtRows, typeRows, activeTypeRows, geoRows, nppRows] = await Promise.all([
    // KPIs: total, active (last 12m), geo, mapped — all in one pass over the subquery
    query<KpiRow>(`
      SELECT COUNT(*) AS total,
             SUM(last_date >= ?) AS active_count,
             SUM(lat IS NOT NULL AND lng IS NOT NULL) AS geo_count,
             SUM(ck IS NOT NULL AND ck != 'OTHER') AS mapped_count
      FROM (${custSubSql}) c
    `, [cutoff, ...custSubParam]),

    // New customers per month (by first purchase month)
    query<MonthRow>(`
      SELECT DATE_FORMAT(first_date, '%Y-%m') AS month, COUNT(*) AS count
      FROM (${custSubSql}) c
      GROUP BY month ORDER BY month
    `, custSubParam),

    // By province (3-year window)
    query<NameCountRow>(`
      SELECT ProvinceName AS name, COUNT(DISTINCT CustomerKey) AS count
      FROM \`_door\`
      WHERE OffDate >= ? AND ProvinceName IS NOT NULL ${filters.npp ? 'AND ShipFromCode = ?' : ''}
      GROUP BY ProvinceName ORDER BY count DESC
    `, [scanFrom, ...nppParam]),

    // By district (3-year window)
    query<NameCountRow>(`
      SELECT DistProvince AS name, COUNT(DISTINCT CustomerKey) AS count
      FROM \`_door\`
      WHERE OffDate >= ? AND DistProvince IS NOT NULL ${filters.npp ? 'AND ShipFromCode = ?' : ''}
      GROUP BY DistProvince ORDER BY count DESC
    `, [scanFrom, ...nppParam]),

    // All-customers breakdown by type
    query<TypeBreakRow>(`
      SELECT ck AS type_code, cn AS type_name, COUNT(*) AS count
      FROM (${custSubSql}) c
      GROUP BY ck, cn ORDER BY count DESC
    `, custSubParam),

    // Active-customers: type breakdown + geo/mapped counts per type
    query<ActiveTypeRow>(`
      SELECT ck AS type_code, cn AS type_name,
             COUNT(*) AS active_count,
             COUNT(*) AS total_count,
             SUM(lat IS NOT NULL AND lng IS NOT NULL) AS geo_count,
             SUM(ck IS NOT NULL AND ck != 'OTHER') AS mapped_count
      FROM (${custSubSql}) c
      WHERE last_date >= ?
      GROUP BY ck, cn ORDER BY active_count DESC
    `, [...custSubParam, cutoff]),

    // Geo points — only customers with lat/lng (much smaller set)
    query<GeoRow>(`
      SELECT CustomerKey AS customer_key, MAX(CustomerName) AS customer_name,
             MAX(CustClassKey) AS cust_class_key, MAX(CustClassName) AS cust_class_name,
             MAX(Lat) AS lat, MAX(\`Long\`) AS lng,
             MAX(ProvinceName) AS province_name, MAX(Address) AS address,
             MAX(ShipFromCode) AS ship_from_code
      FROM \`_door\`
      WHERE OffDate >= ? AND Lat IS NOT NULL AND \`Long\` IS NOT NULL ${filters.npp ? 'AND ShipFromCode = ?' : ''}
      GROUP BY CustomerKey
    `, [scanFrom, ...nppParam]),

    // NPP options
    query<NppRow>(
      'SELECT DISTINCT ShipFromCode AS code, ShipFromName AS name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY name',
      []
    ),
  ])

  const kpi = kpiRows[0]
  const total        = Number(kpi?.total        ?? 0)
  const activeCount  = Number(kpi?.active_count ?? 0)
  const geoCount     = Number(kpi?.geo_count    ?? 0)
  const mappedCount  = Number(kpi?.mapped_count ?? 0)

  const new_by_month = monthRows.map(r => ({ month: r.month, count: Number(r.count) }))

  const by_province = provinceRows.map(r => ({ name: r.name || 'Khác', count: Number(r.count) }))
  const by_district = districtRows.map(r => ({ name: r.name || 'Khác', count: Number(r.count) }))

  // all_customers breakdown
  const allBreakdown: CustomerBreakdown[] = typeRows.map(r => ({
    type_code: r.type_code || 'OTHER',
    type_name: r.type_name || 'Khác',
    count: Number(r.count),
    pct: total > 0 ? Math.round((Number(r.count) / total) * 100) : 0,
  }))
  const typeCount = new Set(typeRows.map(r => r.type_code || 'OTHER')).size

  // purchasing_customers breakdown (active in last 12 months)
  const activeTotalCount = activeTypeRows.reduce((s, r) => s + Number(r.active_count), 0)
  const activeMapped = activeTypeRows.reduce((s, r) => s + Number(r.mapped_count), 0)
  const activeGeo    = activeTypeRows.reduce((s, r) => s + Number(r.geo_count), 0)
  const activeTypeCount = activeTypeRows.length

  const purchasingBreakdown: PurchasingBreakdown[] = activeTypeRows.map(r => ({
    type_code: r.type_code || 'OTHER',
    type_name: r.type_name || 'Khác',
    count: Number(r.active_count),
    pct_of_total:  total            > 0 ? Math.round((Number(r.active_count) / total)            * 100) : 0,
    pct_of_active: activeTotalCount > 0 ? Math.round((Number(r.active_count) / activeTotalCount) * 100) : 0,
  }))

  const geo_points: CustomerGeoPoint[] = geoRows.map(r => ({
    customer_key:    r.customer_key,
    customer_name:   r.customer_name,
    cust_class_key:  r.cust_class_key  || 'OTHER',
    cust_class_name: r.cust_class_name || 'Khác',
    lat:      Number(r.lat),
    lng:      Number(r.lng),
    province: r.province_name || '',
    address:  r.address       || '',
    site_code: r.ship_from_code || '',
  }))

  const nppSeen = new Map<string, string>()
  for (const r of nppRows) {
    if (r.code && !nppSeen.has(r.code)) nppSeen.set(r.code, r.name || r.code)
  }
  const npp_options = Array.from(nppSeen.entries()).map(([code, name]) => ({ code, name }))

  return {
    new_by_month,
    by_province,
    by_district,
    npp_options,
    all_customers: {
      kpis: {
        total,
        active_count:  activeCount,
        mapped_pct:    total > 0 ? Math.round((mappedCount / total) * 100) : 0,
        geo_pct:       total > 0 ? Math.round((geoCount   / total) * 100) : 0,
        type_count:    typeCount,
      },
      breakdown: allBreakdown,
    },
    purchasing_customers: {
      kpis: {
        total_count:   activeTotalCount,
        active_count:  activeTotalCount,
        mapped_pct:    activeTotalCount > 0 ? Math.round((activeMapped / activeTotalCount) * 100) : 0,
        geo_pct:       activeTotalCount > 0 ? Math.round((activeGeo    / activeTotalCount) * 100) : 0,
        type_count:    activeTypeCount,
      },
      breakdown: purchasingBreakdown,
    },
    geo_points,
  }
}

export const getKhachHangData = unstable_cache(
  _getKhachHangData,
  ['khach-hang'],
  { tags: ['khach-hang'], revalidate: 3600 }
)
