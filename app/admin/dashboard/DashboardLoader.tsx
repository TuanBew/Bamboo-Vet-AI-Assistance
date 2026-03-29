import { getDashboardData } from '@/lib/admin/services/dashboard'
import { DashboardClient } from './DashboardClient'

export async function DashboardLoader({
  filters,
}: {
  filters: { month: string; province: string; clinic_type: string }
}) {
  const data = await getDashboardData(filters)
  return (
    <DashboardClient
      initialData={data}
      initialFilters={filters}
    />
  )
}
