import { Suspense } from 'react'
import { NhapHangLoader } from './NhapHangLoader'
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

  return (
    <Suspense fallback={<NhapHangSkeleton />}>
      <NhapHangLoader filters={{ npp, year, month }} />
    </Suspense>
  )
}
