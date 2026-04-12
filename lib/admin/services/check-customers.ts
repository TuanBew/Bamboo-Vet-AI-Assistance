import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckCustomersFilters {
  distributor_id: string  // ship_from_code or '' for all
  search: string
  page: number
  page_size: number
  customer_key_filter: string
  customer_name_filter: string
  province: string        // province_name
  town: string            // town_name (labeled Phường/Xã)
  cust_class_key: string
  has_geo: string         // 'yes' | 'no' | ''
}

export interface CustClassOption {
  cust_class_key: string
  cust_class_name: string
}

export interface LocationHierarchy {
  provinces: string[]
  towns: Array<{ province_name: string; town_name: string }>
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
  cust_class_options: CustClassOption[]
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getCheckCustomersData(
  filters: CheckCustomersFilters
): Promise<CheckCustomersData> {
  const db = createServiceClient()

  const [mapPinsResult, customersResult, nppResult, classResult] = await Promise.all([
    db.rpc('get_check_customers_map_pins', {
      p_ship_from_code: filters.distributor_id,
    }),
    db.rpc('get_check_customers_list', {
      p_ship_from_code: filters.distributor_id,
      p_search: filters.search,
      p_page: filters.page,
      p_page_size: filters.page_size,
      p_customer_key_filter: filters.customer_key_filter,
      p_customer_name_filter: filters.customer_name_filter,
      p_province: filters.province,
      p_town: filters.town,
      p_cust_class_key: filters.cust_class_key,
      p_has_geo: filters.has_geo,
    }),
    db.rpc('get_door_npp_options'),
    db.rpc('get_check_customers_class_options'),
  ])

  const mapPinsRaw = (mapPinsResult.data ?? []) as MapPin[]
  const customersPayload = customersResult.data as {
    total: number
    data: CustomerRow[]
  } | null
  const nppRaw = (nppResult.data ?? []) as Array<{ ship_from_code: string; ship_from_name: string }>
  const classRaw = (classResult.data ?? []) as CustClassOption[]

  return {
    map_pins: mapPinsRaw,
    customers: {
      data: customersPayload?.data ?? [],
      total: customersPayload?.total ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
    npp_options: nppRaw,
    cust_class_options: classRaw,
  }
}

export const getCheckCustomersData = unstable_cache(
  _getCheckCustomersData,
  ['check-customers'],
  { tags: ['check-customers'], revalidate: 3600 }
)

// ---------------------------------------------------------------------------
// Location hierarchy for cascade dropdowns
// ---------------------------------------------------------------------------

export async function getCustomerLocations(): Promise<LocationHierarchy> {
  const db = createServiceClient()
  const { data } = await db.rpc('get_check_customers_locations')
  return (data ?? { provinces: [], towns: [] }) as LocationHierarchy
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions for Mã KH / Tên KH
// ---------------------------------------------------------------------------

export async function getCustomerAutocomplete(
  field: 'customer_key' | 'customer_name',
  query: string,
  limit = 10
): Promise<string[]> {
  const db = createServiceClient()
  const { data } = await db.rpc('get_check_customers_autocomplete', {
    p_field: field,
    p_query: query,
    p_limit: limit,
  })
  return (data ?? []) as string[]
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
