import { unstable_cache } from 'next/cache'
import { query } from '@/lib/mysql/client'

interface DpurRow {
  site_code: string
  site_name: string
}

async function _getNppOptions(): Promise<Array<{ site_code: string; site_name: string }>> {
  // LEGACY SUPABASE: const db = createServiceClient()
  // LEGACY SUPABASE: const { data } = await db.from('dpur').select('site_code,site_name').order('site_name').limit(1000)
  const rows = await query<DpurRow>(
    'SELECT SiteCode AS site_code, SiteName AS site_name FROM `_dpur` ORDER BY SiteName LIMIT 1000',
    []
  )

  const seen = new Map<string, { site_code: string; site_name: string }>()
  for (const row of rows) {
    const code = row.site_code?.trim()
    if (code && !seen.has(code)) {
      seen.set(code, {
        site_code: code,
        site_name: row.site_name?.trim() || code,
      })
    }
  }
  return [...seen.values()]
}

export const getNppOptions = unstable_cache(
  _getNppOptions,
  ['npp-options'],
  { tags: ['npp-options'], revalidate: 86400 }
)
