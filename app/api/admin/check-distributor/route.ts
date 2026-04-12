import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCheckDistributorData } from '@/lib/admin/services/check-distributor'
import { jsonWithCache } from '@/lib/admin/cache-headers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const metric = searchParams.get('metric') || 'revenue'
  const system_type = searchParams.get('system_type') || ''
  const ship_from = searchParams.get('ship_from') || ''
  const category = searchParams.get('category') || ''
  const brand = searchParams.get('brand') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = parseInt(searchParams.get('page_size') || '10')

  try {
    const data = await getCheckDistributorData({
      year, metric, system_type, ship_from, category, brand, search, page, page_size,
    })
    return jsonWithCache(request, data)
  } catch (error) {
    console.error('Check distributor API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
