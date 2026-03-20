import { Suspense } from 'react'
import { getCheckUsersData } from '@/lib/admin/services/check-users'
import { CheckUsersClient } from './CheckUsersClient'

export default async function AdminCheckUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    province?: string
    user_type?: string
    page?: string
    page_size?: string
  }>
}) {
  const params = await searchParams
  const search = params.search || ''
  const province = params.province || ''
  const user_type = params.user_type || ''
  const page = parseInt(params.page || '1')
  const page_size = parseInt(params.page_size || '10')

  const data = await getCheckUsersData({ search, province, user_type, page, page_size })

  return (
    <Suspense fallback={<div className="text-gray-400">Dang tai...</div>}>
      <CheckUsersClient
        initialData={data}
        initialFilters={{ search, province, user_type, page, page_size }}
      />
    </Suspense>
  )
}
