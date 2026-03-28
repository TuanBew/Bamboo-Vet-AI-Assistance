/**
 * Deterministic conversation generator for Bamboo Vet seed data.
 *
 * Produces 10,000-12,000 conversations across 27 months (Jan 2024 - Mar 2026)
 * following a non-linear growth curve.
 *
 * Deterministic: same output on every run.
 */

import type { ProfileSeed } from './profiles'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationSeed {
  id: string
  user_id: string
  title: string
  created_at: string
  /** Derived drug group for downstream generators */
  _drug_group: string
  /** Derived animal type for downstream generators */
  _animal_type: string
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

function convUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `cv${hex.slice(0, 6)}-${hex.slice(6, 10)}-4bbb-8ccc-${hex}`
}

// ---------------------------------------------------------------------------
// Title templates
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

const ANIMAL_LABELS: Record<string, string> = {
  trau_bo: 'bo',
  lon: 'lon',
  ga: 'ga',
  cho_meo: 'cho',
  thuy_san: 'ca',
  khac: 'vat nuoi',
}

const TITLE_TEMPLATES: Record<string, string[]> = {
  khang_sinh: [
    'Lieu luong khang sinh cho {animal}',
    'Tinh lieu amoxicillin cho {animal} con',
    'Lieu luong khang sinh tiem cho {animal}',
    'Lieu dung florfenicol cho {animal}',
    'Lieu luong colistin cho {animal} thit',
    'Tinh lieu oxytetracycline cho {animal} de',
  ],
  vitamin: [
    'Lieu luong vitamin B12 cho {animal}',
    'Tu van dinh duong cho {animal} de',
    'Bo sung vitamin cho {animal} con',
    'Cach bo sung khoang chat cho {animal}',
  ],
  vac_xin: [
    'Lich tiem phong cho {animal} thit',
    'Chuong trinh vac-xin cho {animal} nai',
    'Vac-xin phong benh cho {animal}',
    'Chuong trinh tiem phong cho {animal} con',
    'Lich tiem phong cum gia cam',
    'Cach phong benh dich ta lon chau Phi',
  ],
  hormone: [
    'Lieu dung dexamethasone cho {animal}',
    'Su dung hormone tang truong cho {animal}',
    'Dieu tri viem vu o {animal} sua',
  ],
  khang_ky_sinh_trung: [
    'Cach tinh lieu thuoc ta giun cho {animal}',
    'Dieu tri nhiem ky sinh trung o {animal}',
    'Tinh lieu ivermectin cho {animal}',
    'Lieu luong thuoc diet ky sinh trung cho {animal}',
  ],
  khac: [
    'Huong dan bao quan thuoc thu y',
    'Tu van ve chat luong nuoc nuoi {animal}',
    'Quan ly trai chan nuoi mua nong',
    'Yeu cau ve ve sinh chuong trai',
    'Thong tin ve thuoc moi tren thi truong',
  ],
}

const DIAGNOSTIC_TITLES = [
  'Chan doan benh lao o {animal}',
  'Nhan biet trieu chung cum gia cam',
  'Chan doan benh o {animal} con',
  'Xet nghiem mau cho {animal} nghi nhiem benh',
  'Chan doan benh Newcastle o {animal}',
  'Xac dinh benh dom trang o {animal}',
  'Chan doan benh Gumboro o {animal}',
  'Nhan biet benh parvo o {animal}',
  'Phat hien benh sot sua o {animal}',
  'Chan doan benh FIP o {animal}',
  'Chan doan benh tu cung o {animal}',
  'Chan doan benh viem da noi trung o {animal}',
  'Xac dinh benh viem ruot hoai tu o {animal}',
  'Xac dinh nguyen nhan tieu chay o {animal}',
  'Phan biet benh tai xanh va dich ta lon',
]

const TREATMENT_TITLES = [
  'Dieu tri benh duong ho hap o {animal}',
  'Phuong phap dieu tri tieu chay cho {animal}',
  'Dieu tri viem ruot o {animal} con',
  'Dieu tri nhiem trung mat o {animal}',
  'Dieu tri benh cau trung o {animal}',
  'Dieu tri benh lep to spirosis o {animal}',
  'Dieu tri benh pho thuong han o {animal}',
  'Dieu tri viem phoi o {animal}',
  'Dieu tri ap xe o {animal}',
  'Xu ly benh truong bung o {animal}',
  'Chua benh ghe o {animal}',
  'Xu ly nhiem trung da o {animal}',
  'Dieu tri viem gan o {animal}',
  'Phong benh dai o {animal}',
  'Phong ngua benh cau trung cho {animal}',
  'Phuong phap chua benh tu huyet trung o {animal}',
  'Cach dieu tri benh tho o {animal}',
  'Phong benh lep to spirosis cho {animal}',
  'Dieu tri benh ghe cho {animal}',
  'Cach chua benh cam o {animal}',
  'Vac-xin phong benh parvo cho {animal}',
]

function pickWeighted<T extends { weight: number }>(items: T[], hashVal: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let threshold = (hashVal % total)
  for (const item of items) {
    threshold -= item.weight
    if (threshold < 0) return item
  }
  return items[items.length - 1]
}

// ---------------------------------------------------------------------------
// Growth curve: conversations per month
// ---------------------------------------------------------------------------

function monthlyVolume(monthIndex: number, varianceHash: number): number {
  // Scale factor ~2x to reach 10K-12K total across 27 months
  let base: number
  if (monthIndex < 12) {
    // 2024: ramp from 120 to 200
    base = 120 + (monthIndex / 11) * 80
  } else if (monthIndex < 18) {
    // 2025 Q1-Q2: 300 to 500
    base = 300 + ((monthIndex - 12) / 5) * 200
  } else if (monthIndex < 24) {
    // 2025 Q3-Q4: 700 to 900
    base = 700 + ((monthIndex - 18) / 5) * 200
  } else {
    // 2026 Q1: 500 down to 350
    base = 500 - ((monthIndex - 24) / 2) * 75
  }

  // Apply 10-20% deterministic variance
  const variancePct = 0.10 + (varianceHash % 11) / 100 // 0.10 to 0.20
  const sign = varianceHash % 2 === 0 ? 1 : -1
  const variance = base * variancePct * sign * 0.5
  return Math.round(base + variance)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateConversations(profiles: ProfileSeed[]): ConversationSeed[] {
  const nonAdminProfiles = profiles.filter(p => !p.is_admin)
  const conversations: ConversationSeed[] = []
  let globalIdx = 1

  for (let monthIndex = 0; monthIndex < 27; monthIndex++) {
    const year = 2024 + Math.floor(monthIndex / 12)
    const month = (monthIndex % 12) + 1
    const varHash = deterministicHash(`vol-${year}-${String(month).padStart(2, '0')}`)
    const count = monthlyVolume(monthIndex, varHash)
    const days = daysInMonth(year, month)

    for (let c = 0; c < count; c++) {
      const seed = globalIdx * 7 + c * 13
      // Pick day: weekdays (Mon-Fri) get 1.3x weight, weekends 0.7x weight
      const dayHash = deterministicHash(`day-${globalIdx}`)
      let day = (dayHash % days) + 1
      const date = new Date(year, month - 1, day)
      const dow = date.getDay() // 0=Sun, 6=Sat
      // If weekend and hash says rebalance, shift to nearest weekday
      if ((dow === 0 || dow === 6) && detHash(seed + 1) < 0.46) {
        day = Math.max(1, Math.min(days, day + (dow === 0 ? 1 : -1)))
      }

      // Work hours weighted: 7am-9pm
      const hourHash = deterministicHash(`hour-${globalIdx}`)
      const hour = 7 + (hourHash % 15) // 7 to 21
      const minute = deterministicHash(`min-${globalIdx}`) % 60
      const second = deterministicHash(`sec-${globalIdx}`) % 60

      const createdAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`

      // Pick profile
      const profileIdx = deterministicHash(`profile-${globalIdx}`) % nonAdminProfiles.length
      const profile = nonAdminProfiles[profileIdx]

      // Pick drug group and animal type
      const dgHash = deterministicHash(`dg-${globalIdx}`)
      const drugGroup = pickWeighted(DRUG_GROUPS, dgHash)
      const atHash = deterministicHash(`at-${globalIdx}`)
      const animalType = pickWeighted(ANIMAL_TYPES, atHash)
      const animalLabel = ANIMAL_LABELS[animalType.name]

      // Pick title
      const titleHash = deterministicHash(`title-${globalIdx}`)
      let title: string
      const titleType = titleHash % 3
      if (titleType === 0) {
        // Drug-group specific
        const templates = TITLE_TEMPLATES[drugGroup.name]
        title = templates[titleHash % templates.length].replace('{animal}', animalLabel)
      } else if (titleType === 1) {
        // Diagnostic
        title = DIAGNOSTIC_TITLES[titleHash % DIAGNOSTIC_TITLES.length].replace('{animal}', animalLabel)
      } else {
        // Treatment
        title = TREATMENT_TITLES[titleHash % TREATMENT_TITLES.length].replace('{animal}', animalLabel)
      }

      conversations.push({
        id: convUuid(globalIdx),
        user_id: profile.id,
        title,
        created_at: createdAt,
        _drug_group: drugGroup.name,
        _animal_type: animalType.name,
      })

      globalIdx++
    }
  }

  return conversations
}
