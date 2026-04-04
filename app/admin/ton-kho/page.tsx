import { Suspense } from 'react'
import { TonKhoLoader } from './TonKhoLoader'
import { TonKhoSkeleton } from './TonKhoSkeleton'

export default async function AdminTonKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot_date?: string; npp?: string; brand?: string; search?: string }>
}) {
  const params = await searchParams
  const snapshot_date = params.snapshot_date || new Date().toISOString().slice(0, 10)
  const npp = params.npp || ''
  const brand = params.brand || ''
  const search = params.search || ''

  return (
    <Suspense fallback={<TonKhoSkeleton />}>
      <TonKhoLoader filters={{ snapshot_date, npp, brand, search }} />
    </Suspense>
  )
}
