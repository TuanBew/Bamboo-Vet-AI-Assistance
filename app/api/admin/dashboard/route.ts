import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getDashboardData } from '@/lib/admin/services/dashboard'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const npp = searchParams.get('npp') || ''
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const nganhHang = searchParams.get('nganhHang') || ''
  const thuongHieu = searchParams.get('thuongHieu') || ''
  const kenh = searchParams.get('kenh') || ''

  try {
    const data = await getDashboardData({ npp, month, nganhHang, thuongHieu, kenh })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
