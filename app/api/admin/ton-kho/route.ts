import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getTonKhoData } from '@/lib/admin/services/ton-kho'
import { jsonWithCache } from '@/lib/admin/cache-headers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const snapshot_date = searchParams.get('snapshot_date') || new Date().toISOString().slice(0, 10)
  const npp = searchParams.get('npp') || ''
  const brand = searchParams.get('brand') || ''
  const search = searchParams.get('search') || ''

  try {
    const data = await getTonKhoData({ snapshot_date, npp, brand, search })
    return jsonWithCache(request, data)
  } catch (error) {
    console.error('Ton kho API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
