import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsersFilters {
  year: number      // e.g., 2026
  month: number     // 1-12
  province: string  // empty = all
  clinic_type: string // empty = all
}

export interface FacilityBreakdown {
  clinic_type: string
  label: string     // Vietnamese display name
  count: number
  percentage: number
}

export interface UsersData {
  monthly_new_users: Array<{ month: string; count: number }>  // "2024-01" format
  users_by_province: Array<{ name: string; count: number }>
  users_by_district: Array<{ name: string; count: number }>
  all_users: {
    kpis: {
      total_active: number
      verified_email: number
      geo_located: number
      facility_type_count: number
    }
    facility_breakdown: FacilityBreakdown[]
  }
  users_with_queries: {
    kpis: {
      total_active: number
      verified_email: number
      geo_located: number
      facility_type_count: number
    }
    facility_breakdown: (FacilityBreakdown & { pct_of_total: number; pct_of_active: number })[]
  }
  heavy_users: Array<{
    user_id: string
    full_name: string
    clinic_name: string
    clinic_type: string
    query_count: number
  }>
  filter_options: {
    provinces: string[]
    clinic_types: string[]
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLINIC_TYPE_LABELS: Record<string, string> = {
  phong_kham: 'Phong kham',
  nha_thuoc: 'Nha thuoc',
  thu_y: 'Thu y',
  my_pham: 'My pham',
  khac: 'Khac',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Profile = {
  id: string
  full_name: string | null
  clinic_name: string | null
  clinic_type: string | null
  province: string | null
  district: string | null
  latitude: number | null
  longitude: number | null
  is_admin: boolean
  created_at: string
  email: string | null
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const existing = map.get(key)
    if (existing) {
      existing.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}

function buildFacilityBreakdown(profiles: Profile[]): FacilityBreakdown[] {
  const grouped = groupBy(profiles, (p) => p.clinic_type || 'khac')
  const total = profiles.length
  return Array.from(grouped.entries())
    .map(([clinicType, items]) => ({
      clinic_type: clinicType,
      label: CLINIC_TYPE_LABELS[clinicType] || clinicType,
      count: items.length,
      percentage: total > 0 ? (items.length / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getUsersData(filters: UsersFilters): Promise<UsersData> {
  const supabase = createServiceClient()

  // a. Fetch all non-admin profiles (small dataset ~82 rows)
  let profileQuery = supabase.from('profiles').select('*').eq('is_admin', false)
  if (filters.province) profileQuery = profileQuery.eq('province', filters.province)
  if (filters.clinic_type) profileQuery = profileQuery.eq('clinic_type', filters.clinic_type)
  const { data: filteredProfiles } = await profileQuery
  const profiles: Profile[] = (filteredProfiles ?? []) as Profile[]

  // Fetch ALL profiles (unfiltered) for filter_options
  const { data: allProfilesRaw } = await supabase
    .from('profiles')
    .select('id, province, clinic_type')
    .eq('is_admin', false)
  const allProfiles = allProfilesRaw ?? []

  // b. monthly_new_users: Group profiles by created_at month
  const monthlyMap = new Map<string, number>()
  for (const p of profiles) {
    if (!p.created_at) continue
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
  }

  // Fill gaps from earliest to current month
  const monthKeys = Array.from(monthlyMap.keys()).sort()
  const monthly_new_users: Array<{ month: string; count: number }> = []
  if (monthKeys.length > 0) {
    const [startYear, startMonth] = monthKeys[0].split('-').map(Number)
    const now = new Date()
    const endYear = now.getFullYear()
    const endMonth = now.getMonth() + 1
    let y = startYear
    let m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      monthly_new_users.push({ month: key, count: monthlyMap.get(key) ?? 0 })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }

  // c. users_by_province
  const provinceMap = new Map<string, number>()
  for (const p of profiles) {
    const name = p.province || 'Khac'
    provinceMap.set(name, (provinceMap.get(name) ?? 0) + 1)
  }
  const users_by_province = Array.from(provinceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // d. users_by_district
  const districtMap = new Map<string, number>()
  for (const p of profiles) {
    const name = p.district || 'Khac'
    districtMap.set(name, (districtMap.get(name) ?? 0) + 1)
  }
  const users_by_district = Array.from(districtMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // e. all_users KPIs
  let verified_email = profiles.length // fallback
  try {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (authData?.users && authData.users.length > 0) {
      const profileIds = new Set(profiles.map((p) => p.id))
      verified_email = authData.users.filter(
        (u) => profileIds.has(u.id) && u.email_confirmed_at != null
      ).length
    }
  } catch {
    // auth.admin.listUsers may fail with anon key in certain contexts; use fallback
  }

  const geo_located = profiles.filter(
    (p) => p.latitude != null && p.longitude != null
  ).length
  const facility_type_count = new Set(
    profiles.map((p) => p.clinic_type).filter(Boolean)
  ).size

  const all_users_kpis = {
    total_active: profiles.length,
    verified_email,
    geo_located,
    facility_type_count,
  }

  // f. all_users facility_breakdown
  const all_facility_breakdown = buildFacilityBreakdown(profiles)

  // g. users_with_queries
  const { data: monthlyQueries } = await supabase
    .from('mv_monthly_queries')
    .select('user_id, query_count, session_count')
    .eq('year', filters.year)
    .eq('month', filters.month)

  const mqData = monthlyQueries ?? []
  const queryUserIds = new Set(mqData.map((r: { user_id: string }) => r.user_id))
  const profilesWithQueries = profiles.filter((p) => queryUserIds.has(p.id))

  const uwq_verified = profilesWithQueries.length // same fallback pattern
  const uwq_geo = profilesWithQueries.filter(
    (p) => p.latitude != null && p.longitude != null
  ).length
  const uwq_facility_count = new Set(
    profilesWithQueries.map((p) => p.clinic_type).filter(Boolean)
  ).size

  const users_with_queries_kpis = {
    total_active: profilesWithQueries.length,
    verified_email: uwq_verified,
    geo_located: uwq_geo,
    facility_type_count: uwq_facility_count,
  }

  const uwq_breakdown = buildFacilityBreakdown(profilesWithQueries)
  const totalAll = profiles.length
  const totalActive = profilesWithQueries.length

  const users_with_queries_facility = uwq_breakdown.map((row) => ({
    ...row,
    pct_of_total: totalAll > 0 ? (row.count / totalAll) * 100 : 0,
    pct_of_active: totalActive > 0 ? (row.count / totalActive) * 100 : 0,
  }))

  // h. heavy_users: >10 queries/month
  const userQueryCounts = new Map<string, number>()
  for (const row of mqData) {
    const uid = row.user_id as string
    userQueryCounts.set(uid, (userQueryCounts.get(uid) ?? 0) + Number(row.query_count))
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const heavy_users = Array.from(userQueryCounts.entries())
    .filter(([, count]) => count > 10)
    .sort((a, b) => b[1] - a[1])
    .map(([userId, queryCount]) => {
      const profile = profileMap.get(userId)
      return {
        user_id: userId,
        full_name: profile?.full_name ?? 'Unknown',
        clinic_name: profile?.clinic_name ?? 'Unknown',
        clinic_type: profile?.clinic_type ?? '',
        query_count: queryCount,
      }
    })

  // i. filter_options (from ALL profiles, unfiltered)
  const provincesSet = new Set<string>()
  const clinicTypesSet = new Set<string>()
  for (const p of allProfiles) {
    if (p.province) provincesSet.add(p.province as string)
    if (p.clinic_type) clinicTypesSet.add(p.clinic_type as string)
  }

  return {
    monthly_new_users,
    users_by_province,
    users_by_district,
    all_users: {
      kpis: all_users_kpis,
      facility_breakdown: all_facility_breakdown,
    },
    users_with_queries: {
      kpis: users_with_queries_kpis,
      facility_breakdown: users_with_queries_facility,
    },
    heavy_users,
    filter_options: {
      provinces: Array.from(provincesSet).sort(),
      clinic_types: Array.from(clinicTypesSet).sort(),
    },
  }
}
