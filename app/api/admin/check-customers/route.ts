import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCheckCustomersData } from '@/lib/admin/services/check-customers'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const distributor_id = searchParams.get('distributor_id') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = parseInt(searchParams.get('page_size') || '10')

  try {
    const data = await getCheckCustomersData({ distributor_id, search, page, page_size })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Check customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
