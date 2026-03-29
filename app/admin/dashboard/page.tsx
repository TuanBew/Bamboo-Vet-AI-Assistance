import { Suspense } from 'react'
import { DashboardLoader } from './DashboardLoader'
import { DashboardSkeleton } from './DashboardSkeleton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ npp?: string; month?: string; nganhHang?: string; thuongHieu?: string; kenh?: string }>
}) {
  const params = await searchParams
  const filters = {
    npp: params.npp || '',
    month: params.month || new Date().toISOString().slice(0, 7),
    nganhHang: params.nganhHang || '',
    thuongHieu: params.thuongHieu || '',
    kenh: params.kenh || 'le',   // default = Kenh le per spec
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader filters={filters} />
    </Suspense>
  )
}
