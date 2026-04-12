// lib/admin/services/dpur-geo.ts
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export interface DpurGeoEntry {
  site_name: string
  region: string
  area: string
  dist_province: string
}

async function _getDpurGeoLookup(): Promise<DpurGeoEntry[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('dpur')
    .select('site_name, region, area, dist_province')

  if (error || !data) return []

  // Deduplicate by site_name (trim whitespace)
  const seen = new Set<string>()
  const result: DpurGeoEntry[] = []
  for (const r of data) {
    const name = (r.site_name as string)?.trim() || ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push({
      site_name:     name,
      region:        (r.region as string)        || '',
      area:          (r.area as string)          || '',
      dist_province: (r.dist_province as string) || '',
    })
  }
  return result
}

export const getDpurGeoLookup = unstable_cache(
  _getDpurGeoLookup,
  ['geo-data'],
  { tags: ['geo-data'], revalidate: 86400 }
)
