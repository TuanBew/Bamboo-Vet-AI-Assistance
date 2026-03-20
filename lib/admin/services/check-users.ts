import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
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

// Clinic type display labels
const CLINIC_TYPE_LABELS: Record<string, string> = {
  phong_kham: 'Phong kham',
  nha_thuoc: 'Nha thuoc',
  cua_hang: 'Cua hang',
  trai_nuoi: 'Trai nuoi',
}

// User type color coding for map pins
export const USER_TYPE_COLORS: Record<string, string> = {
  nhan_vien: '#3b82f6',  // blue
  quan_ly: '#22c55e',    // green
  bac_si: '#ef4444',     // red
  duoc_si: '#f97316',    // orange
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getCheckUsersData(
  filters: CheckUsersFilters
): Promise<CheckUsersData> {
  const db = createServiceClient()

  // 1. Fetch all non-admin profiles (small dataset ~80 rows)
  const { data: profileRows } = await db
    .from('profiles')
    .select('*')
    .eq('is_admin', false)

  // 2. Fetch all clinics for joining
  const { data: clinicRows } = await db
    .from('clinics')
    .select('id, name, code, type, address')

  const clinicMap = new Map(
    (clinicRows ?? []).map(c => [c.id as string, c])
  )

  const allProfiles = profileRows ?? []

  // 3. Map pins: only geo-located profiles
  const map_pins = allProfiles
    .filter(p => p.lat != null && p.lng != null)
    .map(p => {
      const clinic = clinicMap.get(p.clinic_id as string)
      return {
        user_id: p.id as string,
        full_name: (p.full_name as string) || '',
        user_type: (p.user_type as string) || '',
        clinic_type: CLINIC_TYPE_LABELS[(clinic?.type as string) || ''] || (clinic?.type as string) || '',
        latitude: Number(p.lat),
        longitude: Number(p.lng),
      }
    })

  // 4. Paginated users with search/filter (in JS since we need profile+clinic join)
  let filteredProfiles = allProfiles

  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredProfiles = filteredProfiles.filter(p =>
      ((p.full_name as string) || '').toLowerCase().includes(searchLower)
    )
  }

  if (filters.province) {
    filteredProfiles = filteredProfiles.filter(p => p.province === filters.province)
  }

  if (filters.user_type) {
    filteredProfiles = filteredProfiles.filter(p => p.user_type === filters.user_type)
  }

  const total = filteredProfiles.length
  const rangeStart = (filters.page - 1) * filters.page_size
  const pagedProfiles = filteredProfiles.slice(rangeStart, rangeStart + filters.page_size)

  const usersData = pagedProfiles.map(p => {
    const clinic = clinicMap.get(p.clinic_id as string)
    return {
      user_id: p.id as string,
      user_code: (p.id as string).substring(0, 8),
      full_name: (p.full_name as string) || '',
      email: (p.email as string) || '',
      address: (clinic?.address as string) || '',
      district: (p.district as string) || '',
      province: (p.province as string) || '',
      clinic_type: CLINIC_TYPE_LABELS[(clinic?.type as string) || ''] || (clinic?.type as string) || '',
      clinic_image: null as string | null,
      created_at: p.created_at as string,
      is_geo_located: p.lat != null && p.lng != null,
      latitude: p.lat ? Number(p.lat) : null,
      longitude: p.lng ? Number(p.lng) : null,
    }
  })

  // 5. Monthly pivot from mv_monthly_queries
  const { data: pivotRows } = await db
    .from('mv_monthly_queries')
    .select('user_id, year, month, query_count')

  // Build profile name lookup (non-admin only)
  const profileNameMap = new Map(
    allProfiles.map(p => [p.id as string, (p.full_name as string) || ''])
  )

  // Group by user_id
  const userMonthMap = new Map<string, Record<string, number>>()
  for (const row of pivotRows ?? []) {
    const userId = row.user_id as string
    if (!profileNameMap.has(userId)) continue // skip admin users
    const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`
    if (!userMonthMap.has(userId)) {
      userMonthMap.set(userId, {})
    }
    userMonthMap.get(userId)![monthKey] = Number(row.query_count)
  }

  const monthly_pivot = Array.from(userMonthMap.entries())
    .map(([userId, months]) => ({
      user_id: userId,
      full_name: profileNameMap.get(userId) || '',
      months,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return {
    map_pins,
    users: {
      data: usersData,
      total,
      page: filters.page,
      page_size: filters.page_size,
    },
    monthly_pivot,
  }
}
