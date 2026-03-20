import { Suspense } from 'react'
import { getCheckClinicsData } from '@/lib/admin/services/check-clinics'
import { CheckClinicsClient } from './CheckClinicsClient'

export default async function AdminCheckClinicsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    metric?: string
    clinic_type?: string
    province?: string
    search?: string
    page?: string
    page_size?: string
  }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const metric = params.metric || 'query_count'
  const clinic_type = params.clinic_type || ''
  const province = params.province || ''
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const page_size = parseInt(params.page_size || '10')

  const data = await getCheckClinicsData({
    year,
    metric,
    clinic_type,
    province,
    search,
    page,
    page_size,
  })

  return (
    <Suspense fallback={<div className="text-gray-400 p-4">Dang tai...</div>}>
      <CheckClinicsClient
        initialData={data}
        initialFilters={{
          year,
          metric,
          clinic_type,
          province,
          search,
          page,
          page_size,
        }}
      />
    </Suspense>
  )
}
