import { createServiceClient } from '@/lib/supabase/server'
import type { CheckUsersFilters, CheckUsersData } from './check-users.types'

// Re-export types and constants for backward compatibility with server consumers
export type { CheckUsersFilters, CheckUsersData } from './check-users.types'
export { USER_TYPE_COLORS } from './check-users.types'

// Clinic type display labels
const CLINIC_TYPE_LABELS: Record<string, string> = {
  phong_kham: 'Phong kham',
  nha_thuoc: 'Nha thuoc',
  cua_hang: 'Cua hang',
  trai_nuoi: 'Trai nuoi',
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getCheckUsersData(
  filters: CheckUsersFilters
): Promise<CheckUsersData> {
  const db = createServiceClient()

  // 1. Fetch all clinics for joining (small dataset ~15 rows, cached across queries)
  const { data: clinicRows } = await db
    .from('clinics')
    .select('id, name, code, type, address')

  const clinicMap = new Map(
    (clinicRows ?? []).map(c => [c.id as string, c])
  )

  // 2. Map pins: fetch only geo-located non-admin profiles (server-side filter)
  const { data: geoProfiles } = await db
    .from('profiles')
    .select('id, full_name, user_type, clinic_id, lat, lng')
    .eq('is_admin', false)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  const map_pins = (geoProfiles ?? []).map(p => {
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

  // 3. Paginated users with server-side LIMIT/OFFSET and filters
  let userQuery = db
    .from('profiles')
    .select('id, full_name, email, district, province, clinic_id, lat, lng, created_at, user_type', { count: 'exact' })
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  if (filters.search) {
    userQuery = userQuery.ilike('full_name', `%${filters.search}%`)
  }
  if (filters.province) {
    userQuery = userQuery.eq('province', filters.province)
  }
  if (filters.user_type) {
    userQuery = userQuery.eq('user_type', filters.user_type)
  }

  const rangeStart = (filters.page - 1) * filters.page_size
  const rangeEnd = rangeStart + filters.page_size - 1
  userQuery = userQuery.range(rangeStart, rangeEnd)

  const { data: pagedProfiles, count: totalCount } = await userQuery
  const total = totalCount ?? 0

  const usersData = (pagedProfiles ?? []).map(p => {
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

  // 4. Monthly pivot from mv_monthly_queries
  //    Fetch non-admin profile names for pivot lookup
  const { data: allProfileNames } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('is_admin', false)

  const profileNameMap = new Map(
    (allProfileNames ?? []).map(p => [p.id as string, (p.full_name as string) || ''])
  )

  const { data: pivotRows } = await db
    .from('mv_monthly_queries')
    .select('user_id, year, month, query_count')

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
