import { createServiceClient } from '@/lib/supabase/server'
import { getDpurGeoLookup, type DpurGeoEntry } from './dpur-geo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckDistributorFilters {
  year: number
  metric: string      // 'revenue' | 'retail_revenue' (both use door off_amt)
  system_type: string // filter by door.v_chanel
  ship_from: string   // filter by specific ship_from_code
  category: string    // filter by door.category
  brand: string       // filter by door.brand
  search: string      // search by ship_from_name or ship_from_code
  page: number
  page_size: number
}

export interface CheckDistributorData {
  distributors: {
    data: Array<{
      distributor_id: string   // ship_from_code (from door)
      region: string           // from dpur geo lookup
      zone: string             // from dpur geo lookup
      province: string         // from dpur geo lookup
      distributor_code: string // ship_from_code
      distributor_name: string // ship_from_name
      monthly_data: Record<string, number>  // "1"–"12" → rounded VND
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
  distributor_id: string  // ship_from_code from door
  year: number
  month: number
  staff: Array<{
    staff_id: string    // saleperson_key
    staff_name: string  // saleperson_name
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

/** Match a door.ship_from_name to its geo info from dpur by keyword overlap */
function matchGeo(
  shipFromName: string,
  dpurSites: DpurGeoEntry[]
): DpurGeo {
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
// Main pivot: DB-side aggregation via RPC (avoids PostgREST row limit)
// ---------------------------------------------------------------------------

export async function getCheckDistributorData(
  filters: CheckDistributorFilters
): Promise<CheckDistributorData> {
  const db = createServiceClient()

  // 1. Run main pivot + filter options in parallel; geo lookup is cached separately
  const [[pivotResult, optionsResult], dpurSites] = await Promise.all([
    Promise.all([
      db.rpc('get_check_distributor_pivot', {
        p_year:        filters.year,
        p_system_type: filters.system_type,
        p_ship_from:   filters.ship_from,
        p_category:    filters.category,
        p_brand:       filters.brand,
        p_search:      filters.search,
        p_page:        filters.page,
        p_page_size:   filters.page_size,
      }),
      db.rpc('get_check_distributor_filter_options', {
        p_year: filters.year,
      }),
    ]),
    getDpurGeoLookup(),
  ])

  // 2. Parse pivot result
  const pivotPayload = pivotResult.data as {
    total: number
    data: Array<{
      distributor_code: string
      distributor_name: string
      m1: number; m2: number; m3: number; m4: number
      m5: number; m6: number; m7: number; m8: number
      m9: number; m10: number; m11: number; m12: number
    }>
  } | null

  // 3. Map pivot rows → distributor data with geo (dpurSites already deduplicated by cache)
  const distributorData = (pivotPayload?.data ?? []).map(row => {
    const geo = matchGeo(row.distributor_name, dpurSites)
    return {
      distributor_id:   row.distributor_code,
      region:           geo.region,
      zone:             geo.area,
      province:         geo.dist_province,
      distributor_code: row.distributor_code,
      distributor_name: row.distributor_name,
      monthly_data: {
        '1':  row.m1,  '2':  row.m2,  '3':  row.m3,
        '4':  row.m4,  '5':  row.m5,  '6':  row.m6,
        '7':  row.m7,  '8':  row.m8,  '9':  row.m9,
        '10': row.m10, '11': row.m11, '12': row.m12,
      },
    }
  })

  // 5. Parse filter options
  const opts = optionsResult.data as {
    categories: string[] | null
    brands: string[] | null
    system_types: string[] | null
    ship_froms: string[] | null
  } | null

  return {
    distributors: {
      data:      distributorData,
      total:     pivotPayload?.total ?? 0,
      page:      filters.page,
      page_size: filters.page_size,
    },
    filter_options: {
      categories:   opts?.categories   ?? [],
      brands:       opts?.brands       ?? [],
      system_types: opts?.system_types ?? [],
      ship_froms:   opts?.ship_froms   ?? [],
    },
  }
}

// ---------------------------------------------------------------------------
// Detail: DB-side aggregation via RPC
// ---------------------------------------------------------------------------

export async function getDistributorDetail(
  id: string,   // ship_from_code from door
  month: number,
  year: number
): Promise<DistributorDetailData> {
  const db = createServiceClient()

  const { data } = await db.rpc('get_check_distributor_detail', {
    p_ship_from_code: id,
    p_month:          month,
    p_year:           year,
  })

  const result = data as {
    distributor_name: string
    distributor_id: string
    year: number
    month: number
    staff: Array<{
      staff_id: string
      staff_name: string
      daily_data: Array<{ day: number; revenue: number; customer_count: number }>
    }>
  } | null

  if (!result) {
    return { distributor_name: id, distributor_id: id, year, month, staff: [] }
  }

  // The RPC returns only days with data — fill out the full month day array
  const lastDay = new Date(year, month, 0).getDate()
  const staff = (result.staff ?? []).map(s => {
    const dayMap = new Map(s.daily_data.map(d => [d.day, d]))
    return {
      staff_id:   s.staff_id,
      staff_name: s.staff_name,
      daily_data: Array.from({ length: lastDay }, (_, i) => {
        const day = i + 1
        const d = dayMap.get(day)
        return {
          day,
          revenue:        d?.revenue ?? 0,
          customer_count: d?.customer_count ?? 0,
        }
      }),
    }
  })

  return {
    distributor_name: result.distributor_name,
    distributor_id:   result.distributor_id,
    year:             result.year,
    month:            result.month,
    staff,
  }
}
