import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KhachHangFilters {
  npp: string
}

export interface CustomerBreakdown {
  type_code: string
  type_name: string
  count: number
  pct: number
}

export interface PurchasingBreakdown {
  type_code: string
  type_name: string
  count: number
  pct_of_total: number
  pct_of_active: number
}

export interface CustomerGeoPoint {
  customer_key: string
  customer_name: string
  cust_class_key: string
  cust_class_name: string
  lat: number
  lng: number
  province: string
  address: string
  site_code: string
}

export interface KhachHangData {
  new_by_month: Array<{ month: string; count: number }>
  by_province: Array<{ name: string; count: number }>
  by_district: Array<{ name: string; count: number }>
  npp_options: Array<{ code: string; name: string }>

  all_customers: {
    kpis: {
      total: number
      active_count: number
      mapped_pct: number
      geo_pct: number
      type_count: number
    }
    breakdown: CustomerBreakdown[]
  }

  purchasing_customers: {
    kpis: {
      total_count: number
      active_count: number
      mapped_pct: number
      geo_pct: number
      type_count: number
    }
    breakdown: PurchasingBreakdown[]
  }

  geo_points: CustomerGeoPoint[]
}

// ---------------------------------------------------------------------------
// Main service function — runs two RPC calls in parallel
// ---------------------------------------------------------------------------

async function _getKhachHangData(
  filters: KhachHangFilters
): Promise<KhachHangData> {
  const db = createServiceClient()

  const [summaryRes, geoRes] = await Promise.all([
    db.rpc('get_khach_hang_summary', { p_npp: filters.npp }),
    db.rpc('get_khach_hang_geo', { p_npp: filters.npp }),
  ])

  if (summaryRes.error) console.error('Khach hang summary RPC error:', summaryRes.error)
  if (geoRes.error) console.error('Khach hang geo RPC error:', geoRes.error)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (summaryRes.data as any) ?? {}
  const geoPoints: CustomerGeoPoint[] = Array.isArray(geoRes.data) ? geoRes.data : []

  return {
    new_by_month: s.new_by_month ?? [],
    by_province:  s.by_province ?? [],
    by_district:  s.by_district ?? [],
    npp_options:  s.npp_options ?? [],

    all_customers: {
      kpis: s.all_customers?.kpis ?? {
        total: 0, active_count: 0, mapped_pct: 0, geo_pct: 0, type_count: 0,
      },
      breakdown: s.all_customers?.breakdown ?? [],
    },

    purchasing_customers: {
      kpis: s.purchasing_customers?.kpis ?? {
        total_count: 0, active_count: 0, mapped_pct: 0, geo_pct: 0, type_count: 0,
      },
      breakdown: s.purchasing_customers?.breakdown ?? [],
    },

    geo_points: geoPoints,
  }
}

export const getKhachHangData = unstable_cache(
  _getKhachHangData,
  ['khach-hang'],
  { tags: ['khach-hang'], revalidate: 3600 }
)
