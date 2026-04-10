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

  const initialFilters = {
    distributor_id,
    search,
    page,
    page_size,
    customer_key_filter: '',
    customer_name_filter: '',
    province: '',
    town: '',
    cust_class_key: '',
    has_geo: '',
  }

  const data = await getCheckCustomersData(initialFilters)

  return (
    <Suspense fallback={<div className="text-gray-400">Đang tải...</div>}>
      <CheckCustomersClient
        initialData={data}
        initialFilters={initialFilters}
      />
    </Suspense>
  )
}
