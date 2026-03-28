/**
 * Deterministic chat_analytics generator for Bamboo Vet seed data.
 *
 * Produces 1 analytics row per conversation with drug_group, animal_type,
 * and query_type distributions.
 *
 * Note: The current database schema uses query_events instead of a separate
 * chat_analytics table. This generator produces the analytical classification
 * data that can feed into query_events or a future chat_analytics table.
 *
 * Deterministic: same output on every run.
 */

import type { ConversationSeed } from './conversations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatAnalyticsSeed {
  id: string
  conversation_id: string
  drug_group: string
  animal_type: string
  query_type: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Deterministic hash
// ---------------------------------------------------------------------------

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

function caUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `ca${hex.slice(0, 6)}-${hex.slice(6, 10)}-4ddd-9eee-${hex}`
}

// ---------------------------------------------------------------------------
// Distribution categories
// ---------------------------------------------------------------------------

const DRUG_GROUPS = [
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

export function generateChatAnalytics(conversations: ConversationSeed[]): ChatAnalyticsSeed[] {
  const analytics: ChatAnalyticsSeed[] = []

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i]
    const convHash = deterministicHash(conv.id)

    // Use conversation's pre-computed drug_group and animal_type if available
    const drugGroup = conv._drug_group || pickWeighted(DRUG_GROUPS, deterministicHash(`ca-dg-${conv.id}`))
    const animalType = conv._animal_type || pickWeighted(ANIMAL_TYPES, deterministicHash(`ca-at-${conv.id}`))
    const queryType = pickWeighted(QUERY_TYPES, deterministicHash(`ca-qt-${conv.id}`))

    analytics.push({
      id: caUuid(i + 1),
      conversation_id: conv.id,
      drug_group: drugGroup,
      animal_type: animalType,
      query_type: queryType,
      created_at: conv.created_at,
    })
  }

  return analytics
}
