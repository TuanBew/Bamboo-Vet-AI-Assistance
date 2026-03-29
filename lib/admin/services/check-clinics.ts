import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckClinicsFilters {
  year: number
  metric: string          // 'query_count' | 'session_count'
  clinic_type: string     // filter by clinics.type
  province: string        // filter by clinics.province
  search: string
  page: number
  page_size: number
}

export interface CheckClinicsData {
  clinics: {
    data: Array<{
      clinic_id: string
      facility_code: string     // clinics.code
      clinic_name: string       // clinics.name
      clinic_type: string       // clinics.type
      region: string            // derived from province
      zone: string              // derived from province
      province: string          // clinics.province
      monthly_data: Record<string, number>  // key "1"-"12" -> aggregated metric
    }>
    total: number
    page: number
    page_size: number
  }
}

export interface ClinicDetailData {
  clinic_name: string
  facility_code: string
  year: number
  month: number
  users: Array<{
    user_id: string
    staff_code: string       // profile id first 8 chars as code
    full_name: string
    daily_data: Array<{
      day: number
      query_count: number
      session_count: number
    }>
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRegionZone(province: string): { region: string; zone: string } {
  const north = ['Ha Noi', 'Hai Phong', 'Thai Nguyen']
  const central = ['Da Nang', 'Thua Thien Hue', 'Khanh Hoa']
  const south = ['TP. Ho Chi Minh', 'Can Tho', 'Dong Nai', 'Binh Duong']
  if (north.includes(province)) return { region: 'Mien Bac', zone: 'Dong Bang Song Hong' }
  if (central.includes(province)) return { region: 'Mien Trung', zone: 'Duyen Hai Mien Trung' }
  if (south.includes(province)) return { region: 'Mien Nam', zone: 'Dong Nam Bo' }
  return { region: 'Khac', zone: 'Khac' }
}

// ---------------------------------------------------------------------------
// Main service functions
// ---------------------------------------------------------------------------

export async function getCheckClinicsData(
  filters: CheckClinicsFilters
): Promise<CheckClinicsData> {
  const db = createServiceClient()

  // 1. Query clinics with server-side pagination via LIMIT/OFFSET
  let clinicQuery = db
    .from('clinics')
    .select('id, name, code, type, province', { count: 'exact' })
    .order('code')

  if (filters.search) {
    clinicQuery = clinicQuery.ilike('name', `%${filters.search}%`)
  }
  if (filters.clinic_type) {
    clinicQuery = clinicQuery.eq('type', filters.clinic_type)
  }
  if (filters.province) {
    clinicQuery = clinicQuery.eq('province', filters.province)
  }

  // Apply server-side pagination
  const rangeStart = (filters.page - 1) * filters.page_size
  const rangeEnd = rangeStart + filters.page_size - 1
  clinicQuery = clinicQuery.range(rangeStart, rangeEnd)

  const { data: clinicRows, count: clinicCount } = await clinicQuery

  const pagedClinics = clinicRows ?? []
  const clinicIds = pagedClinics.map(c => c.id as string)

  // 2. Only fetch profiles belonging to the current page's clinics (not all profiles)
  let profileData: Array<{ id: string; clinic_id: string }> = []
  if (clinicIds.length > 0) {
    const { data: profileRows } = await db
      .from('profiles')
      .select('id, clinic_id')
      .eq('is_admin', false)
      .in('clinic_id', clinicIds)

    profileData = (profileRows ?? []).map(r => ({
      id: r.id as string,
      clinic_id: r.clinic_id as string,
    }))
  }

  // Build clinic_id -> user_ids mapping
  const clinicUsersMap = new Map<string, string[]>()
  for (const p of profileData) {
    if (!clinicUsersMap.has(p.clinic_id)) {
      clinicUsersMap.set(p.clinic_id, [])
    }
    clinicUsersMap.get(p.clinic_id)!.push(p.id)
  }

  // 3. Only fetch monthly data for users in current page's clinics
  const relevantUserIds = profileData.map(p => p.id)
  let monthlyData: Array<{ user_id: string; month: number; query_count: number; session_count: number }> = []
  if (relevantUserIds.length > 0) {
    const { data: monthlyRows } = await db
      .from('mv_monthly_queries')
      .select('user_id, month, query_count, session_count')
      .eq('year', filters.year)
      .in('user_id', relevantUserIds)

    monthlyData = (monthlyRows ?? []).map(r => ({
      user_id: r.user_id as string,
      month: r.month as number,
      query_count: Number(r.query_count),
      session_count: Number(r.session_count),
    }))
  }

  // Build user_id -> month -> metric mapping
  const userMonthlyMap = new Map<string, Map<number, { query_count: number; session_count: number }>>()
  for (const row of monthlyData) {
    if (!userMonthlyMap.has(row.user_id)) {
      userMonthlyMap.set(row.user_id, new Map())
    }
    userMonthlyMap.get(row.user_id)!.set(row.month, {
      query_count: row.query_count,
      session_count: row.session_count,
    })
  }

  // 4. Aggregate: for each clinic, sum metric across its users
  const metricKey = filters.metric === 'session_count' ? 'session_count' : 'query_count'

  const clinicData = pagedClinics.map(c => {
    const clinicId = c.id as string
    const userIds = clinicUsersMap.get(clinicId) ?? []
    const monthly_data: Record<string, number> = {}

    for (let m = 1; m <= 12; m++) {
      let total = 0
      for (const uid of userIds) {
        const userMonths = userMonthlyMap.get(uid)
        if (userMonths) {
          const data = userMonths.get(m)
          if (data) {
            total += data[metricKey]
          }
        }
      }
      monthly_data[String(m)] = total
    }

    const province = (c.province as string) || ''
    const { region, zone } = getRegionZone(province)

    return {
      clinic_id: clinicId,
      facility_code: c.code as string,
      clinic_name: c.name as string,
      clinic_type: (c.type as string) || '',
      region,
      zone,
      province,
      monthly_data,
    }
  })

  return {
    clinics: {
      data: clinicData,
      total: clinicCount ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    },
  }
}

export async function getClinicDetail(
  facilityCode: string,
  year: number,
  month: number
): Promise<ClinicDetailData> {
  const db = createServiceClient()

  // 1. Get clinic by code
  const { data: clinic } = await db
    .from('clinics')
    .select('id, name, code')
    .eq('code', facilityCode)
    .single()

  const clinicName = (clinic?.name as string) || ''
  const clinicId = clinic?.id as string

  // 2. Get staff profiles at this clinic
  const { data: staffRows } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('clinic_id', clinicId)
    .eq('is_admin', false)
    .order('full_name')

  const staffList = staffRows ?? []
  const staffIds = staffList.map(s => s.id as string)

  // 3. Query mv_daily_queries for the specified year/month
  let dailyData: Array<{ user_id: string; day: number; query_count: number; session_count: number }> = []
  if (staffIds.length > 0) {
    const { data: dailyRows } = await db
      .from('mv_daily_queries')
      .select('user_id, day, query_count, session_count')
      .eq('year', year)
      .eq('month', month)
      .in('user_id', staffIds)

    dailyData = (dailyRows ?? []).map(r => ({
      user_id: r.user_id as string,
      day: r.day as number,
      query_count: Number(r.query_count),
      session_count: Number(r.session_count),
    }))
  }

  // Build user_id -> day -> data mapping
  const userDailyMap = new Map<string, Map<number, { query_count: number; session_count: number }>>()
  for (const row of dailyData) {
    if (!userDailyMap.has(row.user_id)) {
      userDailyMap.set(row.user_id, new Map())
    }
    userDailyMap.get(row.user_id)!.set(row.day, {
      query_count: row.query_count,
      session_count: row.session_count,
    })
  }

  // 4. For each staff, build daily_data array
  const daysInMonth = new Date(year, month, 0).getDate()

  const users = staffList.map(s => {
    const userId = s.id as string
    const dayMap = userDailyMap.get(userId) ?? new Map()

    const daily_data: Array<{ day: number; query_count: number; session_count: number }> = []
    for (let day = 1; day <= daysInMonth; day++) {
      const data = dayMap.get(day)
      daily_data.push({
        day,
        query_count: data?.query_count ?? 0,
        session_count: data?.session_count ?? 0,
      })
    }

    return {
      user_id: userId,
      staff_code: userId.substring(0, 8),
      full_name: (s.full_name as string) || '',
      daily_data,
    }
  })

  return {
    clinic_name: clinicName,
    facility_code: facilityCode,
    year,
    month,
    users,
  }
}
