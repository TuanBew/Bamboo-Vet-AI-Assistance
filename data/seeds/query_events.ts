/**
 * Deterministic query_events generator for Bamboo Vet seed data.
 *
 * Produces 1 query event per conversation, matching the actual database schema:
 * query_events(id, user_id, conversation_id, clinic_id, drug_category,
 *              animal_type, query_type, response_time_ms, created_at)
 *
 * Feeds materialized views: mv_monthly_queries, mv_daily_queries, mv_category_stats.
 *
 * Deterministic: same output on every run.
 */

import type { ConversationSeed } from './conversations'
import type { ProfileSeed } from './profiles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryEventSeed {
  id: string
  user_id: string
  conversation_id: string
  drug_category: string
  animal_type: string
  query_type: string
  response_time_ms: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Deterministic hash
// ---------------------------------------------------------------------------

function detHash(seed: number): number {
  let x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function deterministicHash(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function qeUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `qe${hex.slice(0, 6)}-${hex.slice(6, 10)}-4eee-8fff-${hex}`
}

// ---------------------------------------------------------------------------
// Distribution categories (matching actual DB column names)
// ---------------------------------------------------------------------------

const DRUG_CATEGORIES = [
  { name: 'khang_sinh', weight: 35 },
  { name: 'vitamin', weight: 20 },
  { name: 'vac_xin', weight: 18 },
  { name: 'hormone', weight: 12 },
  { name: 'khang_ky_sinh_trung', weight: 10 },
  { name: 'khac', weight: 5 },
]

const ANIMAL_TYPES = [
  { name: 'trau_bo', weight: 30 },
  { name: 'lon', weight: 25 },
  { name: 'ga', weight: 20 },
  { name: 'cho_meo', weight: 15 },
  { name: 'thuy_san', weight: 7 },
  { name: 'khac', weight: 3 },
]

const QUERY_TYPES = [
  { name: 'dieu_tri', weight: 35 },
  { name: 'chan_doan', weight: 28 },
  { name: 'lieu_luong', weight: 20 },
  { name: 'phong_benh', weight: 12 },
  { name: 'khac', weight: 5 },
]

function pickWeighted(items: { name: string; weight: number }[], hashVal: number): string {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let threshold = hashVal % total
  for (const item of items) {
    threshold -= item.weight
    if (threshold < 0) return item.name
  }
  return items[items.length - 1].name
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateQueryEvents(
  conversations: ConversationSeed[],
  profiles: ProfileSeed[]
): QueryEventSeed[] {
  // Build profile lookup for user_id
  const profileMap = new Map<string, ProfileSeed>()
  for (const p of profiles) profileMap.set(p.id, p)

  const events: QueryEventSeed[] = []

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]

    // Use conversation's pre-computed categories when available
    const drugCategory = conv._drug_group || pickWeighted(DRUG_CATEGORIES, deterministicHash(`qe-dc-${conv.id}`))
    const animalType = conv._animal_type || pickWeighted(ANIMAL_TYPES, deterministicHash(`qe-at-${conv.id}`))
    const queryType = pickWeighted(QUERY_TYPES, deterministicHash(`qe-qt-${conv.id}`))

    // Response time: 500ms - 5000ms (realistic API response time)
    const responseTime = 500 + Math.floor(detHash(i * 23 + 7) * 4500)

    events.push({
      id: qeUuid(i + 1),
      user_id: conv.user_id,
      conversation_id: conv.id,
      drug_category: drugCategory,
      animal_type: animalType,
      query_type: queryType,
      response_time_ms: responseTime,
      created_at: conv.created_at,
    })
  }

  return events
}
