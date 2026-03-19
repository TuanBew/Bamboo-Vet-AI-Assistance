import { Suspense } from 'react'
import { getNewActivityData } from '@/lib/admin/services/new-activity'
import { NewActivityClient } from './NewActivityClient'
import { NewActivitySkeleton } from './NewActivitySkeleton'

export default async function AdminNewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))

  const data = await getNewActivityData({ year, month })

  return (
    <Suspense fallback={<NewActivitySkeleton />}>
      <NewActivityClient initialData={data} initialFilters={{ year, month }} />
    </Suspense>
  )
}
