// ---------------------------------------------------------------------------
// Types & constants for check-users — safe to import from client components
// ---------------------------------------------------------------------------

export interface CheckUsersFilters {
  search: string
  province: string
  user_type: string
  page: number
  page_size: number
}

export interface CheckUsersData {
  map_pins: Array<{
    user_id: string
    full_name: string
    user_type: string
    clinic_type: string
    latitude: number
    longitude: number
  }>
  users: {
    data: Array<{
      user_id: string
      user_code: string
      full_name: string
      email: string
      address: string
      district: string
      province: string
      clinic_type: string
      clinic_image: string | null
      created_at: string
      is_geo_located: boolean
      latitude: number | null
      longitude: number | null
    }>
    total: number
    page: number
    page_size: number
  }
  monthly_pivot: Array<{
    user_id: string
    full_name: string
    months: Record<string, number>
  }>
}

// User type color coding for map pins
export const USER_TYPE_COLORS: Record<string, string> = {
  nhan_vien: '#3b82f6',  // blue
  quan_ly: '#22c55e',    // green
  bac_si: '#ef4444',     // red
  duoc_si: '#f97316',    // orange
}
