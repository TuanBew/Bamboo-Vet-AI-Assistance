import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getKhachHangData } from '@/lib/admin/services/khach-hang'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const npp = searchParams.get('npp') || ''

  try {
    const data = await getKhachHangData({ npp })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Khach hang API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
