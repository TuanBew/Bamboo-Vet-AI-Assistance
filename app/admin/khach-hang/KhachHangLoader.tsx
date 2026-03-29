import { getKhachHangData } from '@/lib/admin/services/khach-hang'
import { KhachHangClient } from './KhachHangClient'

export async function KhachHangLoader({
  filters,
}: {
  filters: { npp: string }
}) {
  const data = await getKhachHangData(filters)
  return <KhachHangClient initialData={data} initialFilters={filters} />
}
