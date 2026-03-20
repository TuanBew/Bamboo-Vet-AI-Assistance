import { getKhachHangData } from '@/lib/admin/services/khach-hang'
import { KhachHangClient } from './KhachHangClient'

export default async function AdminKhachHangPage({
  searchParams,
}: {
  searchParams: Promise<{ npp?: string }>
}) {
  const params = await searchParams
  const npp = params.npp || ''
  const data = await getKhachHangData({ npp })
  return <KhachHangClient initialData={data} initialFilters={{ npp }} />
}
