import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCheckCustomersData } from '@/lib/admin/services/check-customers'
import { jsonWithCache } from '@/lib/admin/cache-headers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const distributor_id = searchParams.get('distributor_id') || ''
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = parseInt(searchParams.get('page_size') || '10')
  const customer_key_filter = searchParams.get('customer_key_filter') || ''
  const customer_name_filter = searchParams.get('customer_name_filter') || ''
  const province = searchParams.get('province') || ''
  const town = searchParams.get('town') || ''
  const cust_class_key = searchParams.get('cust_class_key') || ''
  const has_geo = searchParams.get('has_geo') || ''

  try {
    const data = await getCheckCustomersData({
      distributor_id,
      search,
      page,
      page_size,
      customer_key_filter,
      customer_name_filter,
      province,
      town,
      cust_class_key,
      has_geo,
    })
    return jsonWithCache(request, data)
  } catch (error) {
    console.error('Check customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
