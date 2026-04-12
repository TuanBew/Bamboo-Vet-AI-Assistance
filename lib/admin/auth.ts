import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Server utility for protecting /api/admin/* routes.
 *
 * Usage in every API route handler:
 *   const user = await requireAdmin()
 *   if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 *
 * Returns the verified Supabase User when the caller is an admin, or null otherwise.
 *
 * Security rationale:
 * - getUser() performs server-side JWT verification against the Supabase auth server.
 * - app_metadata is set server-side only; Supabase enforces this — clients cannot modify it.
 * - Reading is_admin from a verified JWT token is equivalent security to reading from the DB,
 *   with zero additional network round-trips.
 */
export async function requireAdmin(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const isAdmin = user.app_metadata?.is_admin === true

  if (!isAdmin) {
    return null
  }

  return user
}
