import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KhachHangFilters {
  npp: string // placeholder for future NPP filtering, currently unused
}

export interface CustomerBreakdown {
  type_code: string
  type_name: string
  count: number
  pct: number // percentage of total in this section
}

export interface PurchasingBreakdown extends CustomerBreakdown {
  pct_of_total: number  // % theo Tong KH (all customers)
  pct_of_active: number // % theo KH con hoat dong
}

export interface KhachHangData {
  new_by_month: Array<{ month: string; count: number }> // LineChart: "2024-01" format
  by_province: Array<{ name: string; count: number }>   // BarChart
  by_district: Array<{ name: string; count: number }>   // Horizontal BarChart

  all_customers: {
    kpis: {
      active_count: number   // Con hoat dong
      mapped_pct: number     // Da phan tuyen %
      geo_pct: number        // Da dinh vi %
      type_count: number     // So loai cua hieu (distinct types with count > 0)
    }
    breakdown: CustomerBreakdown[] // 8 rows, one per type
  }

  purchasing_customers: {
    kpis: {
      total_with_orders: number
      mapped_pct: number
      geo_pct: number
      type_count: number
    }
    breakdown: PurchasingBreakdown[]
  }

  high_value_stores: Array<{
    customer_code: string
    customer_name: string
    customer_type: string
    province: string
    total_value: number
  }>
}

// ---------------------------------------------------------------------------
// Customer type label mapping
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  TH: 'Tap hoa',
  GSO: 'Bach hoa',
  PHA: 'Nha thuoc',
  SPS: 'Me & Be',
  BTS: 'My pham',
  OTHER: 'Khac',
  PLT: 'Phu lieu toc',
  WMO: 'Cho',
}

const ALL_TYPES = ['TH', 'GSO', 'PHA', 'SPS', 'BTS', 'OTHER', 'PLT', 'WMO']

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getKhachHangData(
  filters: KhachHangFilters
): Promise<KhachHangData> {
  const db = createServiceClient()

  // 1. Fetch all customers
  const { data: customerRows } = await db.from('customers').select('*')
  const customers = customerRows ?? []

  // 2. Fetch all customer_purchases
  const { data: purchaseRows } = await db
    .from('customer_purchases')
    .select('customer_id, total_value')
  const purchases = purchaseRows ?? []

  const total = customers.length

  // 3. new_by_month: group customers by created_at month
  const monthMap = new Map<string, number>()
  for (const c of customers) {
    const date = new Date(c.created_at as string)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
  }
  const new_by_month = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 4. by_province: group customers by province, top 15
  const provinceMap = new Map<string, number>()
  for (const c of customers) {
    const province = (c.province as string) || 'Khong xac dinh'
    provinceMap.set(province, (provinceMap.get(province) ?? 0) + 1)
  }
  const by_province = Array.from(provinceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // 5. by_district: group customers by district, top 15
  const districtMap = new Map<string, number>()
  for (const c of customers) {
    const district = (c.district as string) || 'Khong xac dinh'
    districtMap.set(district, (districtMap.get(district) ?? 0) + 1)
  }
  const by_district = Array.from(districtMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // 6. all_customers KPIs
  const activeCount = customers.filter(c => c.is_active).length
  const mappedCount = customers.filter(c => c.is_mapped).length
  const geoCount = customers.filter(c => c.is_geo_located).length

  // Type breakdown for all customers
  const typeCountMap = new Map<string, number>()
  for (const c of customers) {
    const type = c.customer_type as string
    typeCountMap.set(type, (typeCountMap.get(type) ?? 0) + 1)
  }

  const distinctTypesWithCount = ALL_TYPES.filter(t => (typeCountMap.get(t) ?? 0) > 0).length

  const allBreakdown: CustomerBreakdown[] = ALL_TYPES.map(type => ({
    type_code: type,
    type_name: TYPE_LABELS[type] || type,
    count: typeCountMap.get(type) ?? 0,
    pct: total > 0
      ? Math.round(((typeCountMap.get(type) ?? 0) / total) * 1000) / 10
      : 0,
  }))

  // 7. purchasing_customers
  // Build set of customer IDs that have purchases
  const purchasingCustomerIds = new Set<string>()
  for (const p of purchases) {
    purchasingCustomerIds.add(p.customer_id as string)
  }

  // Total purchase records (not distinct customers) for KPI tile
  const totalPurchaseRecords = purchases.length

  // Filter customers that have at least 1 purchase
  const purchasingCustomers = customers.filter(c =>
    purchasingCustomerIds.has(c.id as string)
  )

  const purchasingActive = purchasingCustomers.filter(c => c.is_active).length
  const purchasingMapped = purchasingCustomers.filter(c => c.is_mapped).length
  const purchasingGeo = purchasingCustomers.filter(c => c.is_geo_located).length
  const purchasingTotal = purchasingCustomers.length

  const purchasingTypeMap = new Map<string, number>()
  for (const c of purchasingCustomers) {
    const type = c.customer_type as string
    purchasingTypeMap.set(type, (purchasingTypeMap.get(type) ?? 0) + 1)
  }

  const purchasingDistinctTypes = ALL_TYPES.filter(t => (purchasingTypeMap.get(t) ?? 0) > 0).length

  const purchasingBreakdown: PurchasingBreakdown[] = ALL_TYPES.map(type => ({
    type_code: type,
    type_name: TYPE_LABELS[type] || type,
    count: purchasingTypeMap.get(type) ?? 0,
    pct: purchasingTotal > 0
      ? Math.round(((purchasingTypeMap.get(type) ?? 0) / purchasingTotal) * 1000) / 10
      : 0,
    pct_of_total: total > 0
      ? Math.round(((purchasingTypeMap.get(type) ?? 0) / total) * 1000) / 10
      : 0,
    pct_of_active: activeCount > 0
      ? Math.round(((purchasingTypeMap.get(type) ?? 0) / activeCount) * 1000) / 10
      : 0,
  }))

  // 8. high_value_stores: group purchases by customer_id, SUM(total_value), filter > 300000
  const customerValueMap = new Map<string, number>()
  for (const p of purchases) {
    const custId = p.customer_id as string
    customerValueMap.set(custId, (customerValueMap.get(custId) ?? 0) + Number(p.total_value))
  }

  const customerLookup = new Map(customers.map(c => [c.id as string, c]))

  const high_value_stores = Array.from(customerValueMap.entries())
    .filter(([, value]) => value > 300000)
    .sort((a, b) => b[1] - a[1])
    .map(([custId, totalValue]) => {
      const c = customerLookup.get(custId)
      return {
        customer_code: (c?.customer_code as string) || '',
        customer_name: (c?.customer_name as string) || '',
        customer_type: (c?.customer_type as string) || '',
        province: (c?.province as string) || '',
        total_value: totalValue,
      }
    })

  return {
    new_by_month,
    by_province,
    by_district,
    all_customers: {
      kpis: {
        active_count: activeCount,
        mapped_pct: total > 0 ? Math.round((mappedCount / total) * 1000) / 10 : 0,
        geo_pct: total > 0 ? Math.round((geoCount / total) * 1000) / 10 : 0,
        type_count: distinctTypesWithCount,
      },
      breakdown: allBreakdown,
    },
    purchasing_customers: {
      kpis: {
        total_with_orders: totalPurchaseRecords,
        mapped_pct: purchasingTotal > 0
          ? Math.round((purchasingMapped / purchasingTotal) * 1000) / 10
          : 0,
        geo_pct: purchasingTotal > 0
          ? Math.round((purchasingGeo / purchasingTotal) * 1000) / 10
          : 0,
        type_count: purchasingDistinctTypes,
      },
      breakdown: purchasingBreakdown,
    },
    high_value_stores,
  }
}
