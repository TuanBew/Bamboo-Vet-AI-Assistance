import { getTonKhoData } from '@/lib/admin/services/ton-kho'
import { TonKhoClient } from './TonKhoClient'

export async function TonKhoLoader({
  filters,
}: {
  filters: { snapshot_date: string; npp: string; brand: string; search: string }
}) {
  const data = await getTonKhoData(filters)
  return <TonKhoClient initialData={data} initialFilters={filters} />
}
