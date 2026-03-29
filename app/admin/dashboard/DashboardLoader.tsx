import { getDashboardData, type DashboardFilters } from '@/lib/admin/services/dashboard'
import { DashboardClient } from './DashboardClient'

export async function DashboardLoader({
  filters,
}: {
  filters: DashboardFilters
}) {
  const data = await getDashboardData(filters)
  return <DashboardClient initialData={data} initialFilters={filters} />
}
