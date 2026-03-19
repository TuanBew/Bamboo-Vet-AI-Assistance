import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBFilters {
  page: number        // 1-based page number
  page_size: number   // default 10
  search: string      // search term for doc_name/doc_code
  doc_type?: string   // optional filter
  category?: string   // optional filter
}

export interface KBData {
  kpis: {
    total_documents: number
    total_chunks: number
    unique_ratio: number
  }
  charts: {
    chunks_by_drug_group: Array<{ name: string; count: number }>
    chunks_by_category: Array<{ name: string; count: number }>
    doc_type_breakdown: Array<{ name: string; count: number }>
    source_breakdown: Array<{ name: string; count: number }>
    docs_by_drug_group: Array<{ name: string; count: number }>
    docs_by_category: Array<{ name: string; count: number }>
  }
  documents: {
    data: Array<{
      doc_code: string
      doc_name: string
      chunk_count: number
      created_at: string
      doc_type: string
      status: string
      relevance_score: number
    }>
    total: number
    page: number
    page_size: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(
  items: T[],
  key: keyof T,
  sumKey?: keyof T
): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = String(item[key] ?? 'Khac')
    const v = sumKey ? Number(item[sumKey]) : 1
    map.set(k, (map.get(k) || 0) + v)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getKnowledgeBaseData(
  filters: KBFilters
): Promise<KBData> {
  const supabase = createServiceClient()

  // 1. Fetch ALL docs for KPI + chart aggregation (small dataset ~120 docs)
  const { data: allDocs } = await supabase
    .from('kb_documents')
    .select('*')

  const docs = allDocs ?? []

  // 2. Compute KPIs
  const total_documents = docs.length
  const total_chunks = docs.reduce((sum, d) => sum + Number(d.chunk_count ?? 0), 0)
  const uniqueDrugGroups = new Set(docs.map(d => String(d.drug_group ?? '')).filter(Boolean))
  const totalDrugGroupCategories = uniqueDrugGroups.size
  const unique_ratio = total_documents > 0
    ? Math.round((totalDrugGroupCategories / total_documents) * 100) / 100
    : 0

  // 3. Compute chart data via JS grouping
  const charts = {
    chunks_by_drug_group: groupBy(docs, 'drug_group' as keyof typeof docs[0], 'chunk_count' as keyof typeof docs[0]),
    chunks_by_category: groupBy(docs, 'category' as keyof typeof docs[0], 'chunk_count' as keyof typeof docs[0]),
    doc_type_breakdown: groupBy(docs, 'doc_type' as keyof typeof docs[0]),
    source_breakdown: groupBy(docs, 'source' as keyof typeof docs[0]),
    docs_by_drug_group: groupBy(docs, 'drug_group' as keyof typeof docs[0]),
    docs_by_category: groupBy(docs, 'category' as keyof typeof docs[0]),
  }

  // 4. Fetch paginated documents with search + filters
  let query = supabase
    .from('kb_documents')
    .select('doc_code, doc_name, chunk_count, created_at, doc_type, status, relevance_score, drug_group, category, source', { count: 'exact' })
    .order('relevance_score', { ascending: false })
    .range(
      (filters.page - 1) * filters.page_size,
      filters.page * filters.page_size - 1
    )

  if (filters.search) {
    query = query.or(`doc_name.ilike.%${filters.search}%,doc_code.ilike.%${filters.search}%`)
  }
  if (filters.doc_type) {
    query = query.eq('doc_type', filters.doc_type)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  const { data: paginatedDocs, count } = await query

  return {
    kpis: {
      total_documents,
      total_chunks,
      unique_ratio,
    },
    charts,
    documents: {
      data: (paginatedDocs ?? []).map(d => ({
        doc_code: d.doc_code ?? '',
        doc_name: d.doc_name ?? '',
        chunk_count: Number(d.chunk_count ?? 0),
        created_at: d.created_at ?? '',
        doc_type: d.doc_type ?? '',
        status: d.status ?? '',
        relevance_score: Number(d.relevance_score ?? 0),
      })),
      total: count ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
  }
}
