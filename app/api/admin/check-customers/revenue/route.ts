import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCustomerRevenue } from '@/lib/admin/services/check-customers'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const customer_key = searchParams.get('customer_key') || ''

  if (!customer_key) {
    return NextResponse.json({ error: 'customer_key is required' }, { status: 400 })
  }

  try {
    const rows = await getCustomerRevenue(customer_key)
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Customer revenue API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
