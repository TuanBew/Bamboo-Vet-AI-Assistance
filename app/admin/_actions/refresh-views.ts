'use server'

import { revalidateTag } from 'next/cache'

// LEGACY SUPABASE: const svc = createServiceClient()
// LEGACY SUPABASE: await svc.rpc('refresh_admin_views')  — no materialized views in MySQL; live tables are always current

export async function refreshMaterializedViews() {
  // Invalidate all 1h TTL unstable_cache buckets so next request re-reads from MySQL.
  // NOTE: 'npp-options' and 'geo-data' intentionally NOT invalidated — 24h TTL is correct for these.
  revalidateTag('dashboard-fast')
  revalidateTag('dashboard-slow')
  revalidateTag('nhap-hang')
  revalidateTag('ton-kho')
  revalidateTag('khach-hang')
  revalidateTag('check-customers')
  revalidateTag('check-distributor')

  return { success: true as const }
}
