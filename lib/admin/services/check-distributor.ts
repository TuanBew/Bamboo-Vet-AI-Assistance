import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckDistributorFilters {
  year: number
  metric: string          // 'revenue' | 'retail_revenue'
  system_type: string     // filter placeholder
  ship_from: string       // filter placeholder
  category: string        // filter placeholder
  brand: string           // filter placeholder
  search: string
  page: number
  page_size: number
}

export interface CheckDistributorData {
  distributors: {
    data: Array<{
      distributor_id: string
      region: string
      zone: string
      province: string
      distributor_code: string
      distributor_name: string
      monthly_data: Record<string, number>  // "1"-"12" -> revenue
    }>
    total: number
    page: number
    page_size: number
  }
  filter_options: {
    system_types: string[]
    ship_froms: string[]
    categories: string[]
    brands: string[]
  }
}

export interface DistributorDetailData {
  distributor_name: string
  distributor_id: string
  year: number
  month: number
  staff: Array<{
    staff_id: string
    staff_name: string
    daily_data: Array<{
      day: number
      revenue: number
      customer_count: number
    }>
  }>
}

// ---------------------------------------------------------------------------
// Deterministic hash for mock daily data
// ---------------------------------------------------------------------------

function deterministicValue(seed: string, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  // Map to 0..max using sin-based approach for smooth distribution
  return Math.abs(Math.round(Math.sin(h) * max))
}

// ---------------------------------------------------------------------------
// Main service functions
// ---------------------------------------------------------------------------

export async function getCheckDistributorData(
  filters: CheckDistributorFilters
): Promise<CheckDistributorData> {
  const db = createServiceClient()

  // 1. Fetch suppliers (distributors) with pagination
  let supplierQuery = db
    .from('suppliers')
    .select('id, supplier_code, supplier_name, province, region, zone', { count: 'exact' })
    .order('supplier_code')

  if (filters.search) {
    supplierQuery = supplierQuery.ilike('supplier_name', `%${filters.search}%`)
  }

  const rangeStart = (filters.page - 1) * filters.page_size
  const rangeEnd = rangeStart + filters.page_size - 1
  supplierQuery = supplierQuery.range(rangeStart, rangeEnd)

  const { data: supplierRows, count: supplierCount } = await supplierQuery

  const suppliers = supplierRows ?? []
  const supplierIds = suppliers.map(s => s.id as string)

  // 2. Fetch all purchase orders for the given year in one query
  const yearStart = `${filters.year}-01-01`
  const yearEnd = `${filters.year}-12-31`

  let orderData: Array<{ supplier_id: string; order_date: string; total_amount: number }> = []
  if (supplierIds.length > 0) {
    const { data: orderRows } = await db
      .from('purchase_orders')
      .select('supplier_id, order_date, total_amount')
      .gte('order_date', yearStart)
      .lte('order_date', yearEnd)
      .in('supplier_id', supplierIds)

    orderData = (orderRows ?? []).map(r => ({
      supplier_id: r.supplier_id as string,
      order_date: r.order_date as string,
      total_amount: Number(r.total_amount),
    }))
  }

  // 3. Group by supplier_id and month in JS
  const supplierMonthlyMap = new Map<string, Map<string, number>>()
  for (const order of orderData) {
    const month = String(new Date(order.order_date).getMonth() + 1)
    if (!supplierMonthlyMap.has(order.supplier_id)) {
      supplierMonthlyMap.set(order.supplier_id, new Map())
    }
    const monthMap = supplierMonthlyMap.get(order.supplier_id)!
    monthMap.set(month, (monthMap.get(month) ?? 0) + order.total_amount)
  }

  // 4. Build distributor data
  const distributorData = suppliers.map(s => {
    const id = s.id as string
    const monthMap = supplierMonthlyMap.get(id) ?? new Map()
    const monthly_data: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) {
      monthly_data[String(m)] = monthMap.get(String(m)) ?? 0
    }

    return {
      distributor_id: id,
      region: (s.region as string) || '',
      zone: (s.zone as string) || '',
      province: (s.province as string) || '',
      distributor_code: s.supplier_code as string,
      distributor_name: s.supplier_name as string,
      monthly_data,
    }
  })

  // 5. Filter options
  const { data: productRows } = await db
    .from('products')
    .select('classification, manufacturer')

  const categories = [...new Set((productRows ?? []).map(p => p.classification as string).filter(Boolean))]
  const brands = [...new Set((productRows ?? []).map(p => p.manufacturer as string).filter(Boolean))]

  return {
    distributors: {
      data: distributorData,
      total: supplierCount ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
    filter_options: {
      system_types: ['All Systemtype'],
      ship_froms: ['All Shipfrom'],
      categories: ['All Category', ...categories.sort()],
      brands: ['All Brands', ...brands.sort()],
    },
  }
}

export async function getDistributorDetail(
  id: string,
  month: number,
  year: number
): Promise<DistributorDetailData> {
  const db = createServiceClient()

  // 1. Get supplier info
  const { data: supplier } = await db
    .from('suppliers')
    .select('id, supplier_name')
    .eq('id', id)
    .single()

  const distributor_name = (supplier?.supplier_name as string) || ''

  // 2. Get staff for this supplier
  const { data: staffRows } = await db
    .from('distributor_staff')
    .select('id, staff_code, staff_name')
    .eq('supplier_id', id)
    .order('staff_code')

  const staffList = staffRows ?? []

  // 3. Generate deterministic daily data for each staff member
  // Since there's no real staff->order link, use deterministic hash
  const daysInMonth = new Date(year, month, 0).getDate()

  const staff = staffList.map(s => {
    const staffId = s.staff_code as string
    const staffName = s.staff_name as string

    const daily_data: Array<{ day: number; revenue: number; customer_count: number }> = []
    for (let day = 1; day <= daysInMonth; day++) {
      const seed = `${id}-${staffId}-${year}-${month}-${day}`
      const revenue = deterministicValue(seed + '-rev', 5000000)
      const customer_count = deterministicValue(seed + '-cust', 8)

      // ~20% chance of zero activity day
      const activitySeed = deterministicValue(seed + '-act', 100)
      if (activitySeed < 20) {
        daily_data.push({ day, revenue: 0, customer_count: 0 })
      } else {
        daily_data.push({ day, revenue, customer_count })
      }
    }

    return {
      staff_id: staffId,
      staff_name: staffName,
      daily_data,
    }
  })

  return {
    distributor_name,
    distributor_id: id,
    year,
    month,
    staff,
  }
}
