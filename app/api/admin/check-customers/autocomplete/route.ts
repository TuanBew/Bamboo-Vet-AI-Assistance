import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getCustomerAutocomplete } from '@/lib/admin/services/check-customers'

export async function GET(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const field = searchParams.get('field') as 'customer_key' | 'customer_name' | null
  const query = searchParams.get('query') || ''

  if (!field || !query.trim()) return NextResponse.json([])

  try {
    const suggestions = await getCustomerAutocomplete(field, query)
    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Autocomplete API error:', error)
    return NextResponse.json([])
  }
}
