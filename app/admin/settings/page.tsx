import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { RefreshButton } from './refresh-button'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Cai dat</h1>
        <p className="text-gray-400">Khong tim thay nguoi dung</p>
      </div>
    )
  }

  // Supabase Auth + profiles table stay unchanged (auth is not migrated to MySQL)
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // LEGACY SUPABASE: svc.from('mv_dashboard_kpis').select('refreshed_at').single()
  // MySQL migration uses live tables — no materialized views to refresh
  const refreshedAt = 'MySQL migration active'

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Cai dat</h1>

      {/* Admin Profile Card */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Thong tin Admin</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-24">Ten:</span>
            <span className="text-white">{profile?.full_name ?? 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-24">Email:</span>
            <span className="text-white">{profile?.email ?? user.email ?? 'N/A'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-24">Vai tro:</span>
            {profile?.is_admin ? (
              <Badge variant="default" className="bg-teal-600 hover:bg-teal-700">
                Admin
              </Badge>
            ) : (
              <Badge variant="secondary">User</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Refresh Data Card */}
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Lam moi du lieu</h2>
        <p className="text-gray-400 mb-4">
          Du lieu duoc lam moi lan cuoi: {refreshedAt}
        </p>
        <RefreshButton />
      </div>
    </div>
  )
}
