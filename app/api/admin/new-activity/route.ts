import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getNewActivityData } from '@/lib/admin/services/new-activity'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

  try {
    const data = await getNewActivityData({ year, month })
    return NextResponse.json(data)
  } catch (error) {
    console.error('New Activity API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
