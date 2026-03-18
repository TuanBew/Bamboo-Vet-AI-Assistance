import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  is_admin: boolean
  clinic_name: string | null
  clinic_type: string | null
  facility_code: string | null
  staff_code: string | null
  province: string | null
  district: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  avatar_url: string | null
  created_at: string
}

type AdminContext = {
  user: { id: string; email?: string }
  profile: Profile
}

/**
 * Server utility for protecting /api/admin/* routes.
 *
 * Usage in every API route handler:
 *   const auth = await requireAdmin()
 *   if (auth instanceof NextResponse) return auth
 *   const { user, profile } = auth
 *
 * Returns { user, profile } for valid admin, or NextResponse(403) for unauthorized.
 * Uses createClient() for session verification (getUser verifies with auth server)
 * and createServiceClient() for profile lookup (bypasses RLS).
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: profile, error } = await svc
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile || !profile.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user: { id: user.id, email: user.email }, profile: profile as Profile }
}
