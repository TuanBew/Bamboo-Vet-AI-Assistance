import { Suspense } from 'react'
import { getNhapHangData } from '@/lib/admin/services/nhap-hang'
import { NhapHangClient } from './NhapHangClient'
import { NhapHangSkeleton } from './NhapHangSkeleton'

export default async function AdminNhapHangPage({
  searchParams,
}: {
  searchParams: Promise<{ npp?: string; year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const npp = params.npp || ''
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))

  const data = await getNhapHangData({ npp, year, month })

  return (
    <Suspense fallback={<NhapHangSkeleton />}>
      <NhapHangClient initialData={data} initialFilters={{ npp, year, month }} />
    </Suspense>
  )
}
