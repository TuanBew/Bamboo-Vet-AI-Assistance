import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getClinicDetail } from '@/lib/admin/services/check-clinics'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facilityCode: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { facilityCode } = await params
  const { searchParams } = new URL(request.url)
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  try {
    const data = await getClinicDetail(facilityCode, year, month)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Clinic detail API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
