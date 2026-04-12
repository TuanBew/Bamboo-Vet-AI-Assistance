'use server'

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export async function refreshMaterializedViews() {
  const svc = createServiceClient()
  const { error } = await svc.rpc('refresh_admin_views')

  if (error) {
    return { success: false as const, error: error.message }
  }

  // Invalidate all 1h TTL page-level caches now that materialized views are fresh.
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
