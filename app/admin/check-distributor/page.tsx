import { Suspense } from 'react'
import { getCheckDistributorData } from '@/lib/admin/services/check-distributor'
import { CheckDistributorClient } from './CheckDistributorClient'

export default async function AdminCheckDistributorPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    metric?: string
    system_type?: string
    ship_from?: string
    category?: string
    brand?: string
    search?: string
    page?: string
    page_size?: string
  }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const metric = params.metric || 'revenue'
  const system_type = params.system_type || ''
  const ship_from = params.ship_from || ''
  const category = params.category || ''
  const brand = params.brand || ''
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const page_size = parseInt(params.page_size || '10')

  const data = await getCheckDistributorData({
    year,
    metric,
    system_type,
    ship_from,
    category,
    brand,
    search,
    page,
    page_size,
  })

  return (
    <Suspense fallback={<div className="text-gray-400 p-4">Dang tai...</div>}>
      <CheckDistributorClient
        initialData={data}
        initialFilters={{
          year,
          metric,
          system_type,
          ship_from,
          category,
          brand,
          search,
          page,
          page_size,
        }}
      />
    </Suspense>
  )
}
