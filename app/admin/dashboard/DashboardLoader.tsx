import { getCachedDashboardFastData, type DashboardFilters } from '@/lib/admin/services/dashboard'
import { DashboardClient } from './DashboardClient'

export async function DashboardLoader({
  filters,
}: {
  filters: DashboardFilters
}) {
  const data = await getCachedDashboardFastData(filters)
  return <DashboardClient initialData={data} initialFilters={filters} />
}
