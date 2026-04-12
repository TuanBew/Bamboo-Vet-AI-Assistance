import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCustomerLocations } from '@/lib/admin/services/check-customers'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const data = await getCustomerLocations()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Locations API error:', error)
    return NextResponse.json({ provinces: [], towns: [] })
  }
}
