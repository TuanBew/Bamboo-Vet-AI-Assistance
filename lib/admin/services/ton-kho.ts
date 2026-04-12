import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TonKhoFilters {
  snapshot_date: string   // YYYY-MM-DD, default today
  npp: string             // site_code filter, empty = all
  brand: string           // brand filter, empty = all
  search: string          // product name/code search
}

export interface TonKhoData {
  filter_options: {
    npps: Array<{ code: string; name: string }>
    brands: string[]
  }
  kpis: {
    total_value: number
    total_qty: number
    sku_in_stock: number
    total_sku: number
  }
  value_by_nhom: Array<{ name: string; value: number }>
  value_by_brand: Array<{ name: string; value: number }>
  value_by_category: Array<{ name: string; value: number }>
  qty_by_nhom: Array<{ name: string; value: number }>
  qty_by_brand: Array<{ name: string; value: number }>
  qty_by_category: Array<{ name: string; value: number }>
  products: Array<{
    sku_code: string
    sku_name: string
    qty: number
    product: string      // nganh hang
    brand: string        // thuong hieu
    unit_price: number   // last_cost from product table
    total_value: number
  }>
}

// ---------------------------------------------------------------------------
// RPC response types
// ---------------------------------------------------------------------------

interface TonKhoRpcResult {
  total_value: number
  total_qty: number
  sku_in_stock: number
  total_sku: number
  value_by_nhom: Array<{ name: string; value: number }> | null
  value_by_brand: Array<{ name: string; value: number }> | null
  value_by_category: Array<{ name: string; value: number }> | null
  qty_by_nhom: Array<{ name: string; value: number }> | null
  qty_by_brand: Array<{ name: string; value: number }> | null
  qty_by_category: Array<{ name: string; value: number }> | null
  products: Array<{
    sku_code: string
    sku_name: string
    qty: number
    product: string
    brand: string
    unit_price: number
    total_value: number
  }> | null
}

interface FilterOptionsRpcResult {
  npps: Array<{ code: string; name: string }> | null
  brands: string[] | null
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

async function _getTonKhoData(
  filters: TonKhoFilters
): Promise<TonKhoData> {
  const db = createServiceClient()

  // Run both RPC calls in parallel — efficient server-side aggregation
  const [filterRes, dataRes] = await Promise.all([
    db.rpc('get_ton_kho_filter_options'),
    db.rpc('get_ton_kho_data', {
      p_snapshot_date: filters.snapshot_date,
      p_npp: filters.npp,
      p_brand: filters.brand,
      p_search: filters.search,
    }),
  ])

  if (filterRes.error) {
    console.error('Ton kho filter options RPC error:', filterRes.error)
  }
  if (dataRes.error) {
    console.error('Ton kho data RPC error:', dataRes.error)
  }

  const filterOpts = (filterRes.data ?? {}) as FilterOptionsRpcResult
  const rpc = (dataRes.data ?? {}) as TonKhoRpcResult

  return {
    filter_options: {
      npps: filterOpts.npps ?? [],
      brands: filterOpts.brands ?? [],
    },
    kpis: {
      total_value: Number(rpc.total_value ?? 0),
      total_qty: Number(rpc.total_qty ?? 0),
      sku_in_stock: Number(rpc.sku_in_stock ?? 0),
      total_sku: Number(rpc.total_sku ?? 0),
    },
    value_by_nhom: rpc.value_by_nhom ?? [],
    value_by_brand: rpc.value_by_brand ?? [],
    value_by_category: rpc.value_by_category ?? [],
    qty_by_nhom: rpc.qty_by_nhom ?? [],
    qty_by_brand: rpc.qty_by_brand ?? [],
    qty_by_category: rpc.qty_by_category ?? [],
    products: rpc.products ?? [],
  }
}

export const getTonKhoData = unstable_cache(
  _getTonKhoData,
  ['ton-kho'],
  { tags: ['ton-kho'], revalidate: 3600 }
)
