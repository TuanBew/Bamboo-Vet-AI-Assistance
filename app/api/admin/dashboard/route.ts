import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import {
  getDashboardData,
  getCachedDashboardFastData,
  getCachedDashboardSlowData,
} from '@/lib/admin/services/dashboard'
import { jsonWithCache } from '@/lib/admin/cache-headers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const npp = searchParams.get('npp') || ''
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const nganhHang = searchParams.get('nganhHang') || ''
  const thuongHieu = searchParams.get('thuongHieu') || ''
  const kenh = searchParams.get('kenh') || ''
  const layer = searchParams.get('layer') || 'all'

  const filters = { npp, month, nganhHang, thuongHieu, kenh }

  try {
    if (layer === 'fast') {
      const data = await getCachedDashboardFastData(filters)
      return jsonWithCache(request, data)
    }
    if (layer === 'slow') {
      const data = await getCachedDashboardSlowData(filters)
      return jsonWithCache(request, data)
    }
    // layer === 'all' or no layer param — backward compat
    const data = await getDashboardData(filters)
    return jsonWithCache(request, data)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
