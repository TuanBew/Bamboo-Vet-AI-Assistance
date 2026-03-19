import { createServiceClient } from '@/lib/supabase/server'
import { computeForecast, type ForecastPoint } from '@/lib/admin/forecast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  month: string // "2026-03" format
  province: string // empty string = all
  clinic_type: string // empty string = all
}

export interface DashboardData {
  kpis: {
    total_queries: number
    total_sessions: number
    total_users: number
    total_documents: number
    total_staff: number
    refreshed_at: string
  }
  monthly_series: ForecastPoint[]
  category_stats: {
    drug_groups: Array<{ name: string; count: number }>
    animal_types: Array<{ name: string; count: number }>
    query_types: Array<{ name: string; count: number }>
  }
  daily_volume: Array<{ day: number; query_count: number }>
  top_users: Array<{
    user_id: string
    full_name: string
    clinic_name: string
    clinic_type: string
    total_queries: number
    total_sessions: number
    avg_queries: number
    days_active: number
    monthly_sparkline: number[]
    drug_group_breakdown: Record<string, number>
    query_type_breakdown: Record<string, number>
  }>
  clinic_map: Array<{
    user_id: string
    clinic_name: string
    clinic_type: string
    province: string
    latitude: number
    longitude: number
    total_queries: number
  }>
  top_clinics: Array<{ clinic_name: string; total_queries: number }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number)
  return { year: y, month: m }
}

/**
 * Build a list of user IDs whose profiles match the active province / clinic_type filters.
 * Returns null when no filters are set (= all users).
 */
async function getFilteredUserIds(
  db: ReturnType<typeof createServiceClient>,
  province: string,
  clinicType: string
): Promise<string[] | null> {
  if (!province && !clinicType) return null

  let query = db.from('profiles').select('id').eq('is_admin', false)
  if (province) query = query.eq('province', province)
  if (clinicType) query = query.eq('clinic_type', clinicType)

  const { data } = await query
  return data ? data.map((r: { id: string }) => r.id) : []
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData> {
  const db = createServiceClient()
  const { year, month } = parseMonth(filters.month)
  const filteredUserIds = await getFilteredUserIds(db, filters.province, filters.clinic_type)

  // 1. KPIs — always platform-wide (unfiltered)
  const kpis = await fetchKpis(db)

  // 2. Monthly series — with optional user filter, + forecast
  const monthlySeries = await fetchMonthlySeries(db, filteredUserIds)

  // 3. Category stats — filtered by month + optional province/clinic_type
  const categoryStats = await fetchCategoryStats(db, year, month, filters.province || undefined, filters.clinic_type || undefined)

  // 4. Daily volume — for selected month
  const dailyVolume = await fetchDailyVolume(db, year, month, filteredUserIds)

  // 5. Top users (top 20)
  const topUsers = await fetchTopUsers(db, filteredUserIds)

  // 6. Clinic map — all clinics with coordinates
  const clinicMap = await fetchClinicMap(db)

  // 7. Top clinics (top 10)
  const topClinics = clinicMap
    .sort((a, b) => b.total_queries - a.total_queries)
    .slice(0, 10)
    .map(c => ({ clinic_name: c.clinic_name, total_queries: c.total_queries }))

  return {
    kpis,
    monthly_series: monthlySeries,
    category_stats: categoryStats,
    daily_volume: dailyVolume,
    top_users: topUsers,
    clinic_map: clinicMap,
    top_clinics: topClinics,
  }
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

async function fetchKpis(db: ReturnType<typeof createServiceClient>) {
  const { data, error } = await db
    .from('mv_dashboard_kpis')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) {
    return {
      total_queries: 0,
      total_sessions: 0,
      total_users: 0,
      total_documents: 0,
      total_staff: 0,
      refreshed_at: new Date().toISOString(),
    }
  }

  return {
    total_queries: Number(data.total_queries),
    total_sessions: Number(data.total_sessions),
    total_users: Number(data.total_users),
    total_documents: Number(data.total_documents),
    total_staff: Number(data.total_staff),
    refreshed_at: data.refreshed_at ?? new Date().toISOString(),
  }
}

async function fetchMonthlySeries(
  db: ReturnType<typeof createServiceClient>,
  filteredUserIds: string[] | null
): Promise<ForecastPoint[]> {
  let query = db
    .from('mv_monthly_queries')
    .select('year, month, query_count, session_count, user_id')

  if (filteredUserIds !== null) {
    query = query.in('user_id', filteredUserIds)
  }

  const { data } = await query

  if (!data || data.length === 0) return []

  // Aggregate across users per year/month
  const grouped = new Map<string, { year: number; month: number; query_count: number; session_count: number }>()
  for (const row of data) {
    const key = `${row.year}-${row.month}`
    const existing = grouped.get(key)
    if (existing) {
      existing.query_count += Number(row.query_count)
      existing.session_count += Number(row.session_count)
    } else {
      grouped.set(key, {
        year: Number(row.year),
        month: Number(row.month),
        query_count: Number(row.query_count),
        session_count: Number(row.session_count),
      })
    }
  }

  const aggregated = Array.from(grouped.values()).sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  )

  return computeForecast(aggregated)
}

async function fetchCategoryStats(
  db: ReturnType<typeof createServiceClient>,
  year: number,
  month: number,
  province?: string,
  clinicType?: string
) {
  let query = db
    .from('mv_category_stats')
    .select('drug_category, animal_type, query_type, count')
    .eq('year', year)
    .eq('month', month)

  if (province) {
    query = query.eq('province', province)
  }
  if (clinicType) {
    query = query.eq('clinic_type', clinicType)
  }

  const { data } = await query

  const drugGroups = new Map<string, number>()
  const animalTypes = new Map<string, number>()
  const queryTypes = new Map<string, number>()

  for (const row of data ?? []) {
    const count = Number(row.count)
    const dg = row.drug_category || 'Khác'
    const at = row.animal_type || 'Khác'
    const qt = row.query_type || 'Khác'

    drugGroups.set(dg, (drugGroups.get(dg) ?? 0) + count)
    animalTypes.set(at, (animalTypes.get(at) ?? 0) + count)
    queryTypes.set(qt, (queryTypes.get(qt) ?? 0) + count)
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  return {
    drug_groups: toSorted(drugGroups),
    animal_types: toSorted(animalTypes),
    query_types: toSorted(queryTypes),
  }
}

async function fetchDailyVolume(
  db: ReturnType<typeof createServiceClient>,
  year: number,
  month: number,
  filteredUserIds: string[] | null
) {
  let query = db
    .from('mv_daily_queries')
    .select('day, query_count, user_id')
    .eq('year', year)
    .eq('month', month)

  if (filteredUserIds !== null) {
    query = query.in('user_id', filteredUserIds)
  }

  const { data } = await query

  // Aggregate per day
  const grouped = new Map<number, number>()
  for (const row of data ?? []) {
    const day = Number(row.day)
    grouped.set(day, (grouped.get(day) ?? 0) + Number(row.query_count))
  }

  return Array.from(grouped.entries())
    .map(([day, query_count]) => ({ day, query_count }))
    .sort((a, b) => a.day - b.day)
}

async function fetchTopUsers(
  db: ReturnType<typeof createServiceClient>,
  filteredUserIds: string[] | null
) {
  // Get aggregated query/session counts per user from monthly queries
  let monthlyQuery = db
    .from('mv_monthly_queries')
    .select('user_id, year, month, query_count, session_count')

  if (filteredUserIds !== null) {
    monthlyQuery = monthlyQuery.in('user_id', filteredUserIds)
  }

  const { data: monthlyData } = await monthlyQuery

  if (!monthlyData || monthlyData.length === 0) return []

  // Aggregate totals per user
  const userTotals = new Map<
    string,
    {
      total_queries: number
      total_sessions: number
      months: number
      monthlyMap: Map<string, number> // year-month -> query_count for sparkline
    }
  >()

  for (const row of monthlyData) {
    const uid = row.user_id as string
    const existing = userTotals.get(uid)
    const qc = Number(row.query_count)
    const sc = Number(row.session_count)
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`

    if (existing) {
      existing.total_queries += qc
      existing.total_sessions += sc
      existing.months += 1
      existing.monthlyMap.set(key, (existing.monthlyMap.get(key) ?? 0) + qc)
    } else {
      const mm = new Map<string, number>()
      mm.set(key, qc)
      userTotals.set(uid, {
        total_queries: qc,
        total_sessions: sc,
        months: 1,
        monthlyMap: mm,
      })
    }
  }

  // Sort by total_queries desc, take top 20
  const top20Ids = Array.from(userTotals.entries())
    .sort((a, b) => b[1].total_queries - a[1].total_queries)
    .slice(0, 20)
    .map(([uid]) => uid)

  // Fetch profiles for top 20
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, clinic_name, clinic_type')
    .in('id', top20Ids)

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; clinic_name: string | null; clinic_type: string | null }) => [
      p.id,
      p,
    ])
  )

  // Fetch days_active from daily queries
  let dailyQuery = db
    .from('mv_daily_queries')
    .select('user_id, year, month, day')
    .in('user_id', top20Ids)

  const { data: dailyData } = await dailyQuery

  const daysActiveMap = new Map<string, number>()
  if (dailyData) {
    const userDays = new Map<string, Set<string>>()
    for (const row of dailyData) {
      const uid = row.user_id as string
      const dayKey = `${row.year}-${row.month}-${row.day}`
      if (!userDays.has(uid)) userDays.set(uid, new Set())
      userDays.get(uid)!.add(dayKey)
    }
    for (const [uid, days] of userDays) {
      daysActiveMap.set(uid, days.size)
    }
  }

  // Fetch category breakdowns for top 20 from query_events (has user_id, unlike mv_category_stats)
  const { data: catData } = await db
    .from('query_events')
    .select('user_id, drug_category, query_type')
    .in('user_id', top20Ids)

  const drugBreakdownMap = new Map<string, Record<string, number>>()
  const queryTypeBreakdownMap = new Map<string, Record<string, number>>()

  for (const row of catData ?? []) {
    const uid = row.user_id as string

    // Drug group breakdown (each query_events row = 1 event)
    const dg = row.drug_category || 'Khác'
    if (!drugBreakdownMap.has(uid)) drugBreakdownMap.set(uid, {})
    const dgMap = drugBreakdownMap.get(uid)!
    dgMap[dg] = (dgMap[dg] ?? 0) + 1

    // Query type breakdown
    const qt = row.query_type || 'Khác'
    if (!queryTypeBreakdownMap.has(uid)) queryTypeBreakdownMap.set(uid, {})
    const qtMap = queryTypeBreakdownMap.get(uid)!
    qtMap[qt] = (qtMap[qt] ?? 0) + 1
  }

  // Build sparkline: last 12 months
  const now = new Date()
  const sparklineKeys: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    sparklineKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }

  return top20Ids.map(uid => {
    const totals = userTotals.get(uid)!
    const profile = profileMap.get(uid)

    return {
      user_id: uid,
      full_name: profile?.full_name ?? 'Unknown',
      clinic_name: profile?.clinic_name ?? 'Unknown',
      clinic_type: profile?.clinic_type ?? '',
      total_queries: totals.total_queries,
      total_sessions: totals.total_sessions,
      avg_queries: totals.months > 0 ? Math.round(totals.total_queries / totals.months) : 0,
      days_active: daysActiveMap.get(uid) ?? 0,
      monthly_sparkline: sparklineKeys.map(k => totals.monthlyMap.get(k) ?? 0),
      drug_group_breakdown: drugBreakdownMap.get(uid) ?? {},
      query_type_breakdown: queryTypeBreakdownMap.get(uid) ?? {},
    }
  })
}

async function fetchClinicMap(db: ReturnType<typeof createServiceClient>) {
  // Get all non-admin profiles with coordinates
  const { data: profiles } = await db
    .from('profiles')
    .select('id, clinic_name, clinic_type, province, latitude, longitude')
    .eq('is_admin', false)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  if (!profiles || profiles.length === 0) return []

  const userIds = profiles.map((p: { id: string }) => p.id)

  // Get aggregated query counts per user
  const { data: queryData } = await db
    .from('mv_monthly_queries')
    .select('user_id, query_count')
    .in('user_id', userIds)

  const queryCounts = new Map<string, number>()
  for (const row of queryData ?? []) {
    const uid = row.user_id as string
    queryCounts.set(uid, (queryCounts.get(uid) ?? 0) + Number(row.query_count))
  }

  return profiles.map((p: { id: string; clinic_name: string | null; clinic_type: string | null; province: string | null; latitude: number; longitude: number }) => ({
    user_id: p.id,
    clinic_name: p.clinic_name ?? 'Unknown',
    clinic_type: p.clinic_type ?? '',
    province: p.province ?? '',
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    total_queries: queryCounts.get(p.id) ?? 0,
  }))
}
