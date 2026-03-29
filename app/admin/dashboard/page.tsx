import { Suspense } from 'react'
import { DashboardLoader } from './DashboardLoader'
import { DashboardSkeleton } from './DashboardSkeleton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; npp?: string; nganhHang?: string; thuongHieu?: string; kenh?: string }>
}) {
  const params = await searchParams
  const month = params.month || new Date().toISOString().slice(0, 7)
  const npp = params.npp || ''
  const nganhHang = params.nganhHang || ''
  const thuongHieu = params.thuongHieu || ''
  const kenh = params.kenh || 'le'

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader filters={{ month, npp, nganhHang, thuongHieu, kenh }} />
    </Suspense>
  )
}
