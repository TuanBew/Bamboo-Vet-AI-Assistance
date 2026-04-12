import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getNhapHangData } from '@/lib/admin/services/nhap-hang'
import { jsonWithCache } from '@/lib/admin/cache-headers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const npp = searchParams.get('npp') || ''
  const now = new Date()
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))

  try {
    const data = await getNhapHangData({ npp, year, month })
    return jsonWithCache(request, data)
  } catch (error) {
    console.error('Nhap hang API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
