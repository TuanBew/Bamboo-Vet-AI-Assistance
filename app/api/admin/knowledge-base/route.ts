import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getKnowledgeBaseData } from '@/lib/admin/services/knowledge-base'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page')) || 1
  const page_size = Number(searchParams.get('page_size')) || 10
  const search = searchParams.get('search') || ''
  const doc_type = searchParams.get('doc_type') || ''
  const category = searchParams.get('category') || ''

  try {
    const data = await getKnowledgeBaseData({
      page,
      page_size,
      search,
      doc_type: doc_type || undefined,
      category: category || undefined,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Knowledge Base API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
