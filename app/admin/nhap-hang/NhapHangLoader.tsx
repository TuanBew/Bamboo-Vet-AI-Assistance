import { getNhapHangData } from '@/lib/admin/services/nhap-hang'
import { NhapHangClient } from './NhapHangClient'

export async function NhapHangLoader({
  filters,
}: {
  filters: { npp: string; year: number; month: number }
}) {
  const data = await getNhapHangData(filters)
  return (
    <NhapHangClient initialData={data} initialFilters={filters} />
  )
}
