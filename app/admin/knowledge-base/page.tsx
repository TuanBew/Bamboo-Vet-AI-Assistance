import { getKnowledgeBaseData } from '@/lib/admin/services/knowledge-base'
import { KnowledgeBaseClient } from './KnowledgeBaseClient'

export default async function AdminKnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''

  const data = await getKnowledgeBaseData({ page, page_size: 10, search })

  return (
    <KnowledgeBaseClient
      initialData={data}
      initialFilters={{ page, search }}
    />
  )
}
