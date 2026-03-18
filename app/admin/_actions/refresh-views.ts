'use server'

import { createServiceClient } from '@/lib/supabase/server'

export async function refreshMaterializedViews() {
  const svc = createServiceClient()
  const { error } = await svc.rpc('refresh_admin_views')

  if (error) {
    return { success: false as const, error: error.message }
  }

  return { success: true as const }
}
