import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckCustomersFilters {
  distributor_id: string  // supplier_id or '' for all
  search: string
  page: number
  page_size: number
}

export interface CheckCustomersData {
  map_pins: Array<{
    customer_id: string
    customer_name: string
    customer_type: string
    latitude: number
    longitude: number
  }>
  customers: {
    data: Array<{
      customer_id: string
      customer_code: string
      customer_name: string
      address: string
      street: string
      ward: string
      district: string
      province: string
      customer_type: string
      image_url: string | null
      created_at: string
      is_geo_located: boolean
      latitude: number | null
      longitude: number | null
    }>
    total: number
    page: number
    page_size: number
  }
  revenue_pivot: Array<{
    brand: string
    months: Record<string, number>
  }>
  display_programs: Array<{
    program_name: string
    staff_name: string
    time_period: string
    registration_image_url: string | null
    execution_image_url: string | null
  }>
}

// Customer type display labels
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  TH: 'Tạp hóa',
  GSO: 'Bách hóa',
  PHA: 'Nhà thuốc',
  SPS: 'Mẹ & Bé',
  BTS: 'Mỹ phẩm',
  OTHER: 'Khác',
  PLT: 'Phụ liệu tóc',
  WMO: 'Chợ',
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  const db = createServiceClient()

  // 1. Map pins: all geo-located customers
  const { data: pinRows } = await db
    .from('customers')
    .select('id, customer_name, customer_type, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  const map_pins = (pinRows ?? []).map(r => ({
    customer_id: r.id as string,
    customer_name: r.customer_name as string,
    customer_type: r.customer_type as string,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }))

  // 2. Paginated customers
  let customerQuery = db
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.search) {
    customerQuery = customerQuery.ilike('customer_name', `%${filters.search}%`)
  }

  const rangeStart = (filters.page - 1) * filters.page_size
  const rangeEnd = rangeStart + filters.page_size - 1
  customerQuery = customerQuery.range(rangeStart, rangeEnd)

  const { data: customerRows, count: customerCount } = await customerQuery

  const customersData = (customerRows ?? []).map(r => ({
    customer_id: r.id as string,
    customer_code: r.customer_code as string,
    customer_name: r.customer_name as string,
    address: (r.address as string) || '',
    street: (r.street as string) || '',
    ward: (r.ward as string) || '',
    district: (r.district as string) || '',
    province: (r.province as string) || '',
    customer_type: CUSTOMER_TYPE_LABELS[r.customer_type as string] || (r.customer_type as string),
    image_url: r.image_url as string | null,
    created_at: r.created_at as string,
    is_geo_located: r.is_geo_located as boolean,
    latitude: r.latitude ? Number(r.latitude) : null,
    longitude: r.longitude ? Number(r.longitude) : null,
  }))

  // 3. Revenue pivot: brand x month from customer_purchases + products
  const { data: purchaseRows } = await db
    .from('customer_purchases')
    .select('product_id, purchase_date, total_value')

  const { data: productRows } = await db
    .from('products')
    .select('id, manufacturer')

  const productBrandMap = new Map(
    (productRows ?? []).map(p => [p.id as string, (p.manufacturer as string) || 'Khác'])
  )

  // Group by brand and month
  const brandMonthMap = new Map<string, Map<string, number>>()
  for (const row of purchaseRows ?? []) {
    const brand = productBrandMap.get(row.product_id as string) || 'Khác'
    const monthKey = (row.purchase_date as string).substring(0, 7) // YYYY-MM
    const value = Number(row.total_value)

    if (!brandMonthMap.has(brand)) {
      brandMonthMap.set(brand, new Map())
    }
    const monthMap = brandMonthMap.get(brand)!
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + value)
  }

  const revenue_pivot = Array.from(brandMonthMap.entries())
    .map(([brand, months]) => ({
      brand,
      months: Object.fromEntries(months),
    }))
    .sort((a, b) => a.brand.localeCompare(b.brand))

  // 4. Display programs
  const { data: displayRows } = await db
    .from('display_programs')
    .select('program_name, staff_name, time_period, registration_image_url, execution_image_url')

  const display_programs = (displayRows ?? []).map(r => ({
    program_name: r.program_name as string,
    staff_name: r.staff_name as string,
    time_period: r.time_period as string,
    registration_image_url: r.registration_image_url as string | null,
    execution_image_url: r.execution_image_url as string | null,
  }))

  return {
    map_pins,
    customers: {
      data: customersData,
      total: customerCount ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
    revenue_pivot,
    display_programs,
  }
}
