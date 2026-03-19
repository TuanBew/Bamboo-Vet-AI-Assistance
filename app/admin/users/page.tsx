import { getUsersData } from '@/lib/admin/services/users'
import { UsersClient } from './UsersClient'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    month?: string
    province?: string
    clinic_type?: string
  }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1
  const province = params.province || ''
  const clinic_type = params.clinic_type || ''

  const data = await getUsersData({ year, month, province, clinic_type })

  return (
    <UsersClient
      initialData={data}
      initialFilters={{ year, month, province, clinic_type }}
    />
  )
}
