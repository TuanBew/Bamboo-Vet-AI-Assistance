import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getTonKhoData } from '@/lib/admin/services/ton-kho'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const snapshot_date = searchParams.get('snapshot_date') || new Date().toISOString().slice(0, 10)
  const npp = searchParams.get('npp') || ''
  const brand = searchParams.get('brand') || ''
  const search = searchParams.get('search') || ''

  try {
    const data = await getTonKhoData({ snapshot_date, npp, brand, search })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Ton kho API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
