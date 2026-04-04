import { Suspense } from 'react'
import { getCheckCustomersData } from '@/lib/admin/services/check-customers'
import { CheckCustomersClient } from './CheckCustomersClient'

export default async function AdminCheckCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    distributor_id?: string
    search?: string
    page?: string
    page_size?: string
  }>
}) {
  const params = await searchParams
  const distributor_id = params.distributor_id || ''
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const page_size = parseInt(params.page_size || '10')

  const data = await getCheckCustomersData({ distributor_id, search, page, page_size })

  return (
    <Suspense fallback={<div className="text-gray-400">Đang tải...</div>}>
      <CheckCustomersClient
        initialData={data}
        initialFilters={{ distributor_id, search, page, page_size }}
      />
    </Suspense>
  )
}
