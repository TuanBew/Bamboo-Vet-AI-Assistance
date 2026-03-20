import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCheckUsersData } from '@/lib/admin/services/check-users'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const province = searchParams.get('province') || ''
  const user_type = searchParams.get('user_type') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = parseInt(searchParams.get('page_size') || '10')

  try {
    const data = await getCheckUsersData({ search, province, user_type, page, page_size })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Check users API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
