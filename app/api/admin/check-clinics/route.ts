import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCheckClinicsData } from '@/lib/admin/services/check-clinics'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const metric = searchParams.get('metric') || 'query_count'
  const clinic_type = searchParams.get('clinic_type') || ''
  const province = searchParams.get('province') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = parseInt(searchParams.get('page_size') || '10')

  try {
    const data = await getCheckClinicsData({ year, metric, clinic_type, province, search, page, page_size })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Check clinics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
