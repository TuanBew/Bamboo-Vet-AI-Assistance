import { getTonKhoData } from '@/lib/admin/services/ton-kho'
import { TonKhoClient } from './TonKhoClient'

export default async function AdminTonKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot_date?: string; nhom?: string; search?: string }>
}) {
  const params = await searchParams
  const snapshot_date = params.snapshot_date || new Date().toISOString().slice(0, 10)
  const nhom = params.nhom || ''
  const search = params.search || ''

  const data = await getTonKhoData({ snapshot_date, nhom, search })

  return <TonKhoClient initialData={data} initialFilters={{ snapshot_date, nhom, search }} />
}
