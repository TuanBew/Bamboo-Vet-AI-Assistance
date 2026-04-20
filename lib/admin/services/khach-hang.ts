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
// Row types
// ---------------------------------------------------------------------------

interface CustomerRow {
  customer_key: string
  customer_name: string
  cust_class_key: string | null
  cust_class_name: string | null
  lat: number | null
  lng: number | null
  province_name: string | null
  dist_province: string | null
  address: string | null
  ship_from_code: string | null
  first_date: string
  last_date: string
}

interface NppRow { code: string; name: string }

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getKhachHangData(filters: KhachHangFilters): Promise<KhachHangData> {
  // LEGACY SUPABASE: db.rpc('get_khach_hang_summary') + db.rpc('get_khach_hang_geo')

  const nppFilter = filters.npp ? ' AND ShipFromCode = ?' : ''
  const nppParam  = filters.npp ? [filters.npp] : []

  const [customerRows, nppRows] = await Promise.all([
    query<CustomerRow>(`
      SELECT
        CustomerKey         AS customer_key,
        MAX(CustomerName)   AS customer_name,
        MAX(CustClassKey)   AS cust_class_key,
        MAX(CustClassName)  AS cust_class_name,
        MAX(Lat)            AS lat,
        MAX(\`Long\`)       AS lng,
        MAX(ProvinceName)   AS province_name,
        MAX(DistProvince)   AS dist_province,
        MAX(Address)        AS address,
        MAX(ShipFromCode)   AS ship_from_code,
        MIN(OffDate)        AS first_date,
        MAX(OffDate)        AS last_date
      FROM \`_door\`
      WHERE 1=1 ${nppFilter}
      GROUP BY CustomerKey
    `, nppParam),
    query<NppRow>(
      'SELECT DISTINCT ShipFromCode AS code, ShipFromName AS name FROM `_door` WHERE ShipFromCode IS NOT NULL ORDER BY ShipFromName',
      []
    ),
  ])

  const total = customerRows.length
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  const activeRows = customerRows.filter(r => r.last_date >= cutoff)
  const mappedRows = customerRows.filter(r => r.cust_class_key && r.cust_class_key.toUpperCase() !== 'OTHER')
  const geoRows    = customerRows.filter(r => r.lat && r.lng)

  // new_by_month: first purchase month per customer
  const monthCountMap = new Map<string, number>()
  for (const r of customerRows) {
    const mo = r.first_date.slice(0, 7)
    monthCountMap.set(mo, (monthCountMap.get(mo) ?? 0) + 1)
  }
  const new_by_month = Array.from(monthCountMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // by_province
  const provinceCounts = new Map<string, number>()
  for (const r of customerRows) {
    const p = r.province_name || 'Khác'
    provinceCounts.set(p, (provinceCounts.get(p) ?? 0) + 1)
  }
  const by_province = Array.from(provinceCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // by_district
  const districtCounts = new Map<string, number>()
  for (const r of customerRows) {
    const d = r.dist_province || 'Khác'
    districtCounts.set(d, (districtCounts.get(d) ?? 0) + 1)
  }
  const by_district = Array.from(districtCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // all_customers breakdown by type
  const typeMap = new Map<string, { code: string; name: string; count: number }>()
  for (const r of customerRows) {
    const code = r.cust_class_key || 'OTHER'
    const name = r.cust_class_name || 'Khác'
    const cur = typeMap.get(code)
    if (cur) cur.count++
    else typeMap.set(code, { code, name, count: 1 })
  }
  const allBreakdown: CustomerBreakdown[] = Array.from(typeMap.values()).map(t => ({
    type_code: t.code,
    type_name: t.name,
    count: t.count,
    pct: total > 0 ? Math.round((t.count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  // purchasing_customers breakdown (active = purchased in last 12 months)
  const activeTotal = activeRows.length
  const activeTypeMap = new Map<string, { code: string; name: string; count: number }>()
  for (const r of activeRows) {
    const code = r.cust_class_key || 'OTHER'
    const name = r.cust_class_name || 'Khác'
    const cur = activeTypeMap.get(code)
    if (cur) cur.count++
    else activeTypeMap.set(code, { code, name, count: 1 })
  }
  const purchasingBreakdown: PurchasingBreakdown[] = Array.from(activeTypeMap.values()).map(t => ({
    type_code: t.code,
    type_name: t.name,
    count: t.count,
    pct_of_total:  total       > 0 ? Math.round((t.count / total)       * 100) : 0,
    pct_of_active: activeTotal > 0 ? Math.round((t.count / activeTotal) * 100) : 0,
  })).sort((a, b) => b.count - a.count)

  // geo_points
  const geo_points: CustomerGeoPoint[] = geoRows.map(r => ({
    customer_key:    r.customer_key,
    customer_name:   r.customer_name,
    cust_class_key:  r.cust_class_key || 'OTHER',
    cust_class_name: r.cust_class_name || 'Khác',
    lat:      Number(r.lat),
    lng:      Number(r.lng),
    province: r.province_name || '',
    address:  r.address || '',
    site_code: r.ship_from_code || '',
  }))

  // npp_options dedup
  const nppSeen = new Map<string, string>()
  for (const r of nppRows) {
    if (r.code && !nppSeen.has(r.code)) nppSeen.set(r.code, r.name || r.code)
  }
  const npp_options = Array.from(nppSeen.entries()).map(([code, name]) => ({ code, name }))

  const activeMappedRows = activeRows.filter(r => r.cust_class_key && r.cust_class_key.toUpperCase() !== 'OTHER')
  const activeGeoRows    = activeRows.filter(r => r.lat && r.lng)

  return {
    new_by_month,
    by_province,
    by_district,
    npp_options,
    all_customers: {
      kpis: {
        total,
        active_count: activeRows.length,
        mapped_pct:   total > 0 ? Math.round((mappedRows.length / total) * 100) : 0,
        geo_pct:      total > 0 ? Math.round((geoRows.length   / total) * 100) : 0,
        type_count:   typeMap.size,
      },
      breakdown: allBreakdown,
    },
    purchasing_customers: {
      kpis: {
        total_count:  activeTotal,
        active_count: activeTotal,
        mapped_pct:   activeTotal > 0 ? Math.round((activeMappedRows.length / activeTotal) * 100) : 0,
        geo_pct:      activeTotal > 0 ? Math.round((activeGeoRows.length    / activeTotal) * 100) : 0,
        type_count:   activeTypeMap.size,
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
