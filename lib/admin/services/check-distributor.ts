import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'
import { getDpurGeoLookup, type DpurGeoEntry } from './dpur-geo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckDistributorFilters {
  year: number
  metric: string
  system_type: string
  ship_from: string
  category: string
  brand: string
  search: string
  page: number
  page_size: number
}

export interface CheckDistributorData {
  distributors: {
    data: Array<{
      distributor_id: string
      region: string
      zone: string
      province: string
      distributor_code: string
      distributor_name: string
      monthly_data: Record<string, number>
    }>
    total: number
    page: number
    page_size: number
  }
  filter_options: {
    system_types: string[]
    ship_froms: string[]
    categories: string[]
    brands: string[]
  }
}

export interface DistributorDetailData {
  distributor_name: string
  distributor_id: string
  year: number
  month: number
  staff: Array<{
    staff_id: string
    staff_name: string
    daily_data: Array<{
      day: number
      revenue: number
      customer_count: number
    }>
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DpurGeo {
  region: string
  area: string
  dist_province: string
}

function matchGeo(shipFromName: string, dpurSites: DpurGeoEntry[]): DpurGeo {
  const nameLower = shipFromName.toLowerCase()
  let bestScore = 0
  let best: DpurGeo = { region: '', area: '', dist_province: '' }

  for (const site of dpurSites) {
    const words = site.site_name.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const score = words.filter(w => nameLower.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      best = { region: site.region, area: site.area, dist_province: site.dist_province }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Main pivot function
// ---------------------------------------------------------------------------

async function _getCheckDistributorData(
  filters: CheckDistributorFilters
): Promise<CheckDistributorData> {
  // LEGACY SUPABASE: db.rpc('get_check_distributor_pivot', {...}) + db.rpc('get_check_distributor_filter_options', {...})

  const pivotConditions = ['YEAR(OffDate) = ?']
  const pivotParams: unknown[] = [filters.year]
  if (filters.system_type) { pivotConditions.push('V_Chanel = ?');     pivotParams.push(filters.system_type) }
  if (filters.ship_from)   { pivotConditions.push('ShipFromCode = ?'); pivotParams.push(filters.ship_from) }
  if (filters.category)    { pivotConditions.push('Category = ?');     pivotParams.push(filters.category) }
  if (filters.brand)       { pivotConditions.push('Brand = ?');        pivotParams.push(filters.brand) }
  if (filters.search) {
    pivotConditions.push('(ShipFromCode LIKE ? OR ShipFromName LIKE ?)')
    pivotParams.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  const whereClause = 'WHERE ' + pivotConditions.join(' AND ')

  interface PivotRow {
    distributor_code: string; distributor_name: string
    m1: number; m2: number; m3: number; m4: number
    m5: number; m6: number; m7: number; m8: number
    m9: number; m10: number; m11: number; m12: number
  }
  interface CountRow { total: number }
  interface OptRow { val: string }

  const pivotSql = `
    SELECT
      ShipFromCode AS distributor_code,
      ShipFromName AS distributor_name,
      SUM(CASE WHEN MONTH(OffDate) = 1  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m1,
      SUM(CASE WHEN MONTH(OffDate) = 2  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m2,
      SUM(CASE WHEN MONTH(OffDate) = 3  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m3,
      SUM(CASE WHEN MONTH(OffDate) = 4  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m4,
      SUM(CASE WHEN MONTH(OffDate) = 5  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m5,
      SUM(CASE WHEN MONTH(OffDate) = 6  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m6,
      SUM(CASE WHEN MONTH(OffDate) = 7  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m7,
      SUM(CASE WHEN MONTH(OffDate) = 8  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m8,
      SUM(CASE WHEN MONTH(OffDate) = 9  THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m9,
      SUM(CASE WHEN MONTH(OffDate) = 10 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m10,
      SUM(CASE WHEN MONTH(OffDate) = 11 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m11,
      SUM(CASE WHEN MONTH(OffDate) = 12 THEN OffAmt + OffTaxAmt - IFNULL(OffDsc, 0) ELSE 0 END) AS m12
    FROM \`_door\`
    ${whereClause}
    GROUP BY ShipFromCode, ShipFromName
    ORDER BY ShipFromName
    LIMIT ?, ?
  `
  const countSql = `SELECT COUNT(DISTINCT ShipFromCode) AS total FROM \`_door\` ${whereClause}`

  const yearWhere = 'WHERE YEAR(OffDate) = ?'
  const optYear = [filters.year]

  const [[pivotRows, countRows, sysTypeRows, shipFromRows, catRows, brandRows], dpurSites] = await Promise.all([
    Promise.all([
      query<PivotRow>(pivotSql, [...pivotParams, (filters.page - 1) * filters.page_size, filters.page_size]),
      query<CountRow>(countSql, pivotParams),
      query<OptRow>(`SELECT DISTINCT V_Chanel AS val FROM \`_door\` ${yearWhere} AND V_Chanel IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT ShipFromCode AS val FROM \`_door\` ${yearWhere} AND ShipFromCode IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT Category AS val FROM \`_door\` ${yearWhere} AND Category IS NOT NULL ORDER BY val`, optYear),
      query<OptRow>(`SELECT DISTINCT Brand AS val FROM \`_door\` ${yearWhere} AND Brand IS NOT NULL ORDER BY val`, optYear),
    ]),
    getDpurGeoLookup(),
  ])

  const distributorData = pivotRows.map(row => {
    const geo = matchGeo(row.distributor_name, dpurSites)
    return {
      distributor_id:   row.distributor_code,
      region:           geo.region,
      zone:             geo.area,
      province:         geo.dist_province,
      distributor_code: row.distributor_code,
      distributor_name: row.distributor_name,
      monthly_data: {
        '1': row.m1, '2': row.m2, '3': row.m3, '4': row.m4,
        '5': row.m5, '6': row.m6, '7': row.m7, '8': row.m8,
        '9': row.m9, '10': row.m10, '11': row.m11, '12': row.m12,
      },
    }
  })

  return {
    distributors: {
      data:      distributorData,
      total:     Number(countRows[0]?.total ?? 0),
      page:      filters.page,
      page_size: filters.page_size,
    },
    filter_options: {
      system_types: sysTypeRows.map(r => r.val),
      ship_froms:   shipFromRows.map(r => r.val),
      categories:   catRows.map(r => r.val),
      brands:       brandRows.map(r => r.val),
    },
  }
}

export const getCheckDistributorData = unstable_cache(
  _getCheckDistributorData,
  ['check-distributor'],
  { tags: ['check-distributor'], revalidate: 3600 }
)

// ---------------------------------------------------------------------------
// Detail: staff daily breakdown
// ---------------------------------------------------------------------------

export async function getDistributorDetail(
  id: string,
  month: number,
  year: number
): Promise<DistributorDetailData> {
  // LEGACY SUPABASE: db.rpc('get_check_distributor_detail', {...})
  interface DetailRow {
    staff_id: string; staff_name: string; day: number
    revenue: number; customer_count: number
  }
  interface NameRow { distributor_name: string }

  const [detailRows, nameRows] = await Promise.all([
    query<DetailRow>(`
      SELECT
        SalepersonKey  AS staff_id,
        SalepersonName AS staff_name,
        DAY(OffDate)   AS day,
        SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS revenue,
        COUNT(DISTINCT CustomerKey) AS customer_count
      FROM \`_door\`
      WHERE ShipFromCode = ? AND YEAR(OffDate) = ? AND MONTH(OffDate) = ?
      GROUP BY SalepersonKey, SalepersonName, DAY(OffDate)
      ORDER BY SalepersonKey, DAY(OffDate)
    `, [id, year, month]),
    query<NameRow>(
      'SELECT MAX(ShipFromName) AS distributor_name FROM `_door` WHERE ShipFromCode = ? LIMIT 1',
      [id]
    ),
  ])

  const distributor_name = nameRows[0]?.distributor_name || id
  const lastDay = new Date(year, month, 0).getDate()

  const staffMap = new Map<string, { name: string; days: Map<number, { revenue: number; customer_count: number }> }>()
  for (const r of detailRows) {
    if (!staffMap.has(r.staff_id)) {
      staffMap.set(r.staff_id, { name: r.staff_name, days: new Map() })
    }
    staffMap.get(r.staff_id)!.days.set(Number(r.day), {
      revenue: Number(r.revenue ?? 0),
      customer_count: Number(r.customer_count ?? 0),
    })
  }

  const staff = Array.from(staffMap.entries()).map(([sid, s]) => ({
    staff_id:   sid,
    staff_name: s.name,
    daily_data: Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1
      const day = s.days.get(d)
      return { day: d, revenue: day?.revenue ?? 0, customer_count: day?.customer_count ?? 0 }
    }),
  }))

  return { distributor_name, distributor_id: id, year, month, staff }
}
