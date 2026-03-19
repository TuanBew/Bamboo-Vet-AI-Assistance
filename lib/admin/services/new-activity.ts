import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewActivityFilters {
  year: number
  month: number
}

export interface NewActivityData {
  kpis: {
    total_new_sessions: number
    total_new_queries: number
    total_new_users: number
    avg_queries_per_session: number
    total_new_documents: number
    avg_session_duration_min: number
  }
  daily_query_volume: Array<{ day: number; query_count: number }>
  daily_sessions: Array<{ day: number; session_count: number }>
  recent_sessions: Array<{
    session_code: string
    date: string
    user_name: string
    query_count: number
    duration_min: number
  }>
  top_questions: Array<{ question_prefix: string; count: number }>
  category_stats: {
    drug_groups: Array<{ name: string; count: number }>
    animal_types: Array<{ name: string; count: number }>
    query_types: Array<{ name: string; count: number }>
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end }
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getNewActivityData(
  filters: NewActivityFilters
): Promise<NewActivityData> {
  const db = createServiceClient()
  const { year, month } = filters
  const { start, end } = monthRange(year, month)

  // 1. KPI: total_new_sessions
  const { count: totalNewSessions } = await db
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', start)
    .lt('created_at', end)

  // 2. KPI: total_new_queries — user messages in conversations created this month
  //    We need conversation IDs for the month first
  const { data: monthConvos } = await db
    .from('conversations')
    .select('id')
    .gte('created_at', start)
    .lt('created_at', end)

  const monthConvoIds = (monthConvos ?? []).map((c: { id: string }) => c.id)

  let totalNewQueries = 0
  if (monthConvoIds.length > 0) {
    const { count } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .in('conversation_id', monthConvoIds)
    totalNewQueries = count ?? 0
  }

  // 3. KPI: total_new_users
  const { count: totalNewUsers } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', false)
    .gte('created_at', start)
    .lt('created_at', end)

  // 4. KPI: avg_queries_per_session
  const sessCount = totalNewSessions ?? 0
  const avgQueriesPerSession =
    sessCount > 0 ? totalNewQueries / sessCount : 0

  // 5. KPI: total_new_documents
  const { count: totalNewDocuments } = await db
    .from('kb_documents')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('created_at', start)
    .lt('created_at', end)

  // 6. KPI: avg_session_duration_min
  //    Compute from message timestamps per conversation
  let avgSessionDurationMin = 0
  if (monthConvoIds.length > 0) {
    const { data: msgTimestamps } = await db
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', monthConvoIds)

    if (msgTimestamps && msgTimestamps.length > 0) {
      const convoMinMax = new Map<
        string,
        { min: number; max: number }
      >()
      for (const msg of msgTimestamps) {
        const cid = msg.conversation_id as string
        const ts = new Date(msg.created_at as string).getTime()
        const existing = convoMinMax.get(cid)
        if (existing) {
          if (ts < existing.min) existing.min = ts
          if (ts > existing.max) existing.max = ts
        } else {
          convoMinMax.set(cid, { min: ts, max: ts })
        }
      }

      let totalDuration = 0
      let convoCount = 0
      for (const { min, max } of convoMinMax.values()) {
        // Duration in minutes, minimum 1 for single-message conversations
        const durationMin = Math.max((max - min) / 60000, 1)
        totalDuration += durationMin
        convoCount++
      }

      avgSessionDurationMin =
        convoCount > 0 ? totalDuration / convoCount : 0
    }
  }

  // 7. daily_query_volume from mv_daily_queries
  const { data: dailyRaw } = await db
    .from('mv_daily_queries')
    .select('day, query_count')
    .eq('year', year)
    .eq('month', month)

  const dailyQueryMap = new Map<number, number>()
  for (const row of dailyRaw ?? []) {
    const day = Number(row.day)
    dailyQueryMap.set(day, (dailyQueryMap.get(day) ?? 0) + Number(row.query_count))
  }
  const daily_query_volume = Array.from(dailyQueryMap.entries())
    .map(([day, query_count]) => ({ day, query_count }))
    .sort((a, b) => a.day - b.day)

  // 8. daily_sessions from mv_daily_queries
  const { data: dailySessRaw } = await db
    .from('mv_daily_queries')
    .select('day, session_count')
    .eq('year', year)
    .eq('month', month)

  const dailySessionMap = new Map<number, number>()
  for (const row of dailySessRaw ?? []) {
    const day = Number(row.day)
    dailySessionMap.set(day, (dailySessionMap.get(day) ?? 0) + Number(row.session_count))
  }
  const daily_sessions = Array.from(dailySessionMap.entries())
    .map(([day, session_count]) => ({ day, session_count }))
    .sort((a, b) => a.day - b.day)

  // 9. recent_sessions (latest 20)
  const recent_sessions: NewActivityData['recent_sessions'] = []
  if (monthConvoIds.length > 0) {
    const { data: recentConvos } = await db
      .from('conversations')
      .select('id, created_at, user_id')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
      .limit(20)

    if (recentConvos && recentConvos.length > 0) {
      // Fetch user names
      const userIds = [...new Set(recentConvos.map((c: { user_id: string }) => c.user_id))]
      const { data: profiles } = await db
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      const profileMap = new Map(
        (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? 'Unknown'])
      )

      // Fetch messages for these conversations to compute query count + duration
      const recentIds = recentConvos.map((c: { id: string }) => c.id)
      const { data: recentMsgs } = await db
        .from('messages')
        .select('conversation_id, role, created_at')
        .in('conversation_id', recentIds)

      // Build per-conversation stats
      const convoStats = new Map<
        string,
        { queryCount: number; minTs: number; maxTs: number }
      >()
      for (const msg of recentMsgs ?? []) {
        const cid = msg.conversation_id as string
        const ts = new Date(msg.created_at as string).getTime()
        const existing = convoStats.get(cid)
        if (existing) {
          if (msg.role === 'user') existing.queryCount++
          if (ts < existing.minTs) existing.minTs = ts
          if (ts > existing.maxTs) existing.maxTs = ts
        } else {
          convoStats.set(cid, {
            queryCount: msg.role === 'user' ? 1 : 0,
            minTs: ts,
            maxTs: ts,
          })
        }
      }

      for (const convo of recentConvos) {
        const stats = convoStats.get(convo.id)
        const durationMin = stats
          ? Math.max((stats.maxTs - stats.minTs) / 60000, 1)
          : 1

        recent_sessions.push({
          session_code: convo.id.substring(0, 8).toUpperCase(),
          date: new Date(convo.created_at as string).toLocaleDateString('vi-VN'),
          user_name: profileMap.get(convo.user_id) ?? 'Unknown',
          query_count: stats?.queryCount ?? 0,
          duration_min: Number(durationMin.toFixed(1)),
        })
      }
    }
  }

  // 10. top_questions (top 10 by 60-char prefix grouping)
  let top_questions: NewActivityData['top_questions'] = []
  if (monthConvoIds.length > 0) {
    const { data: userMessages } = await db
      .from('messages')
      .select('content')
      .eq('role', 'user')
      .in('conversation_id', monthConvoIds)

    if (userMessages && userMessages.length > 0) {
      const prefixCounts = new Map<string, number>()
      for (const msg of userMessages) {
        const content = (msg.content as string) || ''
        const prefix = content.slice(0, 60)
        if (prefix.trim()) {
          prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1)
        }
      }

      top_questions = Array.from(prefixCounts.entries())
        .map(([question_prefix, count]) => ({ question_prefix, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }
  }

  // 11. category_stats from mv_category_stats
  const { data: catData } = await db
    .from('mv_category_stats')
    .select('drug_category, animal_type, query_type, count')
    .eq('year', year)
    .eq('month', month)

  const drugGroups = new Map<string, number>()
  const animalTypes = new Map<string, number>()
  const queryTypes = new Map<string, number>()

  for (const row of catData ?? []) {
    const cnt = Number(row.count)
    const dg = (row.drug_category as string) || 'Khac'
    const at = (row.animal_type as string) || 'Khac'
    const qt = (row.query_type as string) || 'Khac'

    drugGroups.set(dg, (drugGroups.get(dg) ?? 0) + cnt)
    animalTypes.set(at, (animalTypes.get(at) ?? 0) + cnt)
    queryTypes.set(qt, (queryTypes.get(qt) ?? 0) + cnt)
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  return {
    kpis: {
      total_new_sessions: Number(totalNewSessions ?? 0),
      total_new_queries: Number(totalNewQueries),
      total_new_users: Number(totalNewUsers ?? 0),
      avg_queries_per_session: Number(avgQueriesPerSession.toFixed(1)),
      total_new_documents: Number(totalNewDocuments ?? 0),
      avg_session_duration_min: Number(avgSessionDurationMin.toFixed(1)),
    },
    daily_query_volume,
    daily_sessions,
    recent_sessions,
    top_questions,
    category_stats: {
      drug_groups: toSorted(drugGroups),
      animal_types: toSorted(animalTypes),
      query_types: toSorted(queryTypes),
    },
  }
}
