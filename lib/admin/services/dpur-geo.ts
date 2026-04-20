import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

export interface DpurGeoEntry {
  site_name: string
  region: string
  area: string
  dist_province: string
}

interface DpurGeoRow {
  site_name: string
  region: string
  area: string
  dist_province: string
}

async function _getDpurGeoLookup(): Promise<DpurGeoEntry[]> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.from('dpur').select('site_name,region,area,dist_province')
  const rows = await query<DpurGeoRow>(
    'SELECT SiteName AS site_name, Region AS region, Area AS area, DistProvince AS dist_province FROM `_dpur`',
    []
  )

  const seen = new Set<string>()
  const result: DpurGeoEntry[] = []
  for (const r of rows) {
    const name = r.site_name?.trim() || ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push({
      site_name:     name,
      region:        r.region        || '',
      area:          r.area          || '',
      dist_province: r.dist_province || '',
    })
  }
  return result
}

export const getDpurGeoLookup = unstable_cache(
  _getDpurGeoLookup,
  ['geo-data'],
  { tags: ['geo-data'], revalidate: 86400 }
)
