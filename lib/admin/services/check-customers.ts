import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckCustomersFilters {
  distributor_id: string  // ship_from_code or '' for all
  search: string
  page: number
  page_size: number
}

export interface CustomerRow {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  address: string
  town_name: string
  dist_province: string
  province_name: string
  lat: number | null
  long: number | null
  ship_from_code: string
  ship_from_name: string
}

export interface MapPin {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  lat: number
  long: number
}

export interface RevenuePivotRow {
  brand: string
  month: string
  revenue: number
}

export interface CheckCustomersData {
  map_pins: MapPin[]
  customers: {
    data: CustomerRow[]
    total: number
    page: number
    page_size: number
  }
  npp_options: Array<{ ship_from_code: string; ship_from_name: string }>
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  const db = createServiceClient()

  // Run map pins and customer list in parallel
  const [mapPinsResult, customersResult, nppResult] = await Promise.all([
    db.rpc('get_check_customers_map_pins', {
      p_ship_from_code: filters.distributor_id,
    }),
    db.rpc('get_check_customers_list', {
      p_ship_from_code: filters.distributor_id,
      p_search: filters.search,
      p_page: filters.page,
      p_page_size: filters.page_size,
    }),
    db.rpc('get_door_npp_options'),
  ])

  const mapPinsRaw = (mapPinsResult.data ?? []) as MapPin[]
  const customersPayload = customersResult.data as {
    total: number
    data: CustomerRow[]
  } | null

  const nppRaw = (nppResult.data ?? []) as Array<{
    ship_from_code: string
    ship_from_name: string
  }>

  return {
    map_pins: mapPinsRaw,
    customers: {
      data: customersPayload?.data ?? [],
      total: customersPayload?.total ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
    npp_options: nppRaw,
  }
}

// ---------------------------------------------------------------------------
// Per-customer revenue pivot
// ---------------------------------------------------------------------------

export async function getCustomerRevenue(
  customerKey: string
): Promise<RevenuePivotRow[]> {
  const db = createServiceClient()
  const { data } = await db.rpc('get_customer_revenue', {
    p_customer_key: customerKey,
  })
  return (data ?? []) as RevenuePivotRow[]
}
