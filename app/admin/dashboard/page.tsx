import { Suspense } from 'react'
import { getDashboardData } from '@/lib/admin/services/dashboard'
import { DashboardClient } from './DashboardClient'
import { DashboardSkeleton } from './DashboardSkeleton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; province?: string; clinic_type?: string }>
}) {
  const params = await searchParams
  const month = params.month || new Date().toISOString().slice(0, 7)
  const province = params.province || ''
  const clinic_type = params.clinic_type || ''

  const data = await getDashboardData({ month, province, clinic_type })

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient
        initialData={data}
        initialFilters={{ month, province, clinic_type }}
      />
    </Suspense>
  )
}
