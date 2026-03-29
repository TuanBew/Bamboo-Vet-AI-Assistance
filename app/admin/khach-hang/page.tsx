import { Suspense } from 'react'
import { KhachHangLoader } from './KhachHangLoader'
import { KhachHangSkeleton } from './KhachHangSkeleton'

export default async function AdminKhachHangPage({
  searchParams,
}: {
  searchParams: Promise<{ npp?: string }>
}) {
  const params = await searchParams
  const npp = params.npp || ''

  return (
    <Suspense fallback={<KhachHangSkeleton />}>
      <KhachHangLoader filters={{ npp }} />
    </Suspense>
  )
}
