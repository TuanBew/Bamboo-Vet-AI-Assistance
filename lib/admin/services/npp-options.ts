import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

async function _getNppOptions(): Promise<Array<{ site_code: string; site_name: string }>> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('dpur')
    .select('site_code, site_name')
    .order('site_name')
    .limit(1000)

  if (error || !data) return []

  // Deduplicate by site_code — keep first occurrence (alphabetically first by site_name due to .order())
  const seen = new Map<string, { site_code: string; site_name: string }>()
  for (const row of data) {
    const code = (row.site_code as string)?.trim()
    if (code && !seen.has(code)) {
      seen.set(code, {
        site_code: code,
        site_name: (row.site_name as string)?.trim() || code,
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
