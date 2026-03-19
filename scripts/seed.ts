/**
 * Bamboo Vet — Idempotent Seed Script
 *
 * Populates the database with 27 months of realistic Vietnamese veterinary
 * analytics data (Jan 2024 - Mar 2026).
 *
 * Parses markdown table files from data/seeds/ and inserts in FK dependency order:
 *   clinics -> auth users/profiles -> conversations -> messages -> query_events -> kb_documents
 *
 * All inserts use ON CONFLICT DO NOTHING for full idempotency.
 * Safe to run multiple times.
 *
 * Usage: npx ts-node scripts/seed.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// tsx does not auto-load .env.local — load manually
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ---------------------------------------------------------------------------
// Markdown Table Parser
// ---------------------------------------------------------------------------

function parseMdTable(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return [] // need header + separator + at least 1 data row

  // Extract column names from header row
  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0)

  // Skip separator row (index 1, contains ---)
  const dataRows = lines.slice(2)

  return dataRows.map(row => {
    const cells = row
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0 || row.indexOf('||') >= 0) // handle empty cells

    // Re-parse to handle empty cells properly
    const rawCells = row.split('|').slice(1, -1).map(c => c.trim())

    const record: Record<string, string> = {}
    headers.forEach((header, i) => {
      record[header] = rawCells[i] ?? ''
    })
    return record
  })
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function weightedRandom(distribution: Record<string, number>): string {
  const rand = Math.random() * 100
  let cumulative = 0
  for (const [key, weight] of Object.entries(distribution)) {
    cumulative += weight
    if (rand <= cumulative) return key
  }
  // Fallback to last key
  return Object.keys(distribution).pop()!
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate()
  const day = randomInt(1, daysInMonth)
  const hour = randomInt(6, 22)
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  return d.toISOString()
}

// Vietnamese conversation title templates
const TITLE_TEMPLATES = [
  'Cach dieu tri benh tho o ga',
  'Lieu luong khang sinh cho lon',
  'Chan doan benh o bo sua',
  'Phong benh dich ta lon chau Phi',
  'Dieu tri viem phoi o ga',
  'Xac dinh benh dom trang o ca',
  'Lieu dung florfenicol cho ca',
  'Phuong phap dieu tri tieu chay cho lon',
  'Nhan biet trieu chung cum gia cam',
  'Cach tinh lieu thuoc ta giun cho lon',
  'Dieu tri nhiem trung mat o meo',
  'Chan doan benh Newcastle o ga',
  'Dieu tri benh lep to spirosis o bo',
  'Lieu luong vitamin B12 cho meo',
  'Dieu tri viem vu o bo sua',
  'Nhan biet benh parvo o cho',
  'Chuong trinh vac-xin cho lon nai',
  'Phong benh dai o cho meo',
  'Xac dinh benh viem ruot hoai tu o lon',
  'Phat hien benh sot sua o bo',
  'Dieu tri ap xe o bo',
  'Chan doan benh Gumboro o ga',
  'Tu van ve chat luong nuoc nuoi ca',
  'Lieu luong colistin cho ga thit',
  'Tinh lieu oxytetracycline cho ga de',
  'Xu ly nhiem trung da o meo',
  'Chan doan benh tu cung o cho',
  'Dieu tri nhiem ky sinh trung o ca',
  'Vac-xin phong benh cho bo',
  'Cach chua benh cam o ga',
]

// Vietnamese message templates
const USER_MESSAGES = [
  'Cho hoi bac si, con bo nha toi bi sot cao va bo an may ngay roi. Nen lam gi a?',
  'Toi co dan ga bi tieu chay, phan xanh. Lieu co phai benh Newcastle khong?',
  'Lon con 2 thang tuoi bi ho va kho tho. Nen dung thuoc gi a?',
  'Meo nha toi bi sung mat va chay nuoc mat. Co phai bi nhiem trung khong?',
  'Cho toi hoi ve lieu luong khang sinh cho bo nang 300kg?',
  'Dan ca tra bi noi dom trang tren than. Cach dieu tri nhu the nao?',
  'Ga de giam san luong trung dot ngot. Nguyen nhan la gi?',
  'Lon nai sap de co dau hieu bat thuong, nen xu ly the nao?',
  'Cho con 3 thang tuoi bi non va tieu chay ra mau. Co phai parvo khong?',
  'Bo sua bi viem vu, sua co mau. Nen dieu tri bang gi?',
]

const ASSISTANT_MESSAGES = [
  'Dua tren trieu chung ban mo ta, day co the la nhiem trung do vi khuan. Nen dung khang sinh pho rong nhu amoxicillin, ket hop ha sot bang paracetamol thu y. Lieu luong: 10mg/kg the trong, ngay 2 lan trong 5-7 ngay.',
  'Trieu chung nay co the lien quan den nhieu nguyen nhan. Nen lay mau xet nghiem de xac dinh chinh xac. Trong thoi gian cho ket qua, co the bo sung vitamin va dien giai de tang suc de khang.',
  'Voi trieu chung nay, toi khuyen ban nen cach ly con vat bi benh ngay. Su dung thuoc khang sinh theo chi dinh bac si thu y dia phuong. Dong thoi ve sinh chuong trai sach se de tranh lay lan.',
  'Day la tinh trang kha pho bien. Ban co the su dung thuoc nho mat co thanh phan khang sinh nhu ofloxacin. Nho 2-3 giot moi mat, ngay 3 lan. Neu khong giam sau 3 ngay, nen di kham.',
  'Voi trong luong 300kg, lieu luong khuyen cao la: Amoxicillin 10mg/kg = 3g/ngay. Tiem bap sau, chia 2 lan/ngay. Dieu tri trong 5 ngay lien tuc. Theo doi than nhiet hang ngay.',
]

// Distributions for query events
const DRUG_CATEGORY_DIST: Record<string, number> = {
  khang_sinh: 35,
  vitamin: 20,
  vac_xin: 18,
  hormone: 12,
  khang_ky_sinh_trung: 10,
  khac: 5,
}

const ANIMAL_TYPE_DIST: Record<string, number> = {
  trau_bo: 30,
  lon: 25,
  ga: 20,
  cho_meo: 15,
  thuy_san: 7,
  khac: 3,
}

const QUERY_TYPE_DIST: Record<string, number> = {
  dieu_tri: 35,
  chan_doan: 28,
  lieu_luong: 20,
  phong_benh: 12,
  khac: 5,
}

// Monthly conversation volume targets
function getMonthlyTarget(year: number, month: number): number {
  if (year === 2024) return 80
  if (year === 2025 && month <= 6) return 180
  if (year === 2025 && month > 6) return 320
  if (year === 2026) return 280
  return 80
}

// ---------------------------------------------------------------------------
// Seed Functions
// ---------------------------------------------------------------------------

interface SeedResult {
  inserted: number
  skipped: number
}

async function seedClinics(): Promise<SeedResult> {
  console.log('Seeding clinics...')
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'clinics.md'))

  const records = rows.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code,
    type: r.type,
    province: r.province,
    district: r.district,
    address: r.address,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
    created_at: r.created_at,
  }))

  const { data, error } = await supabase
    .from('clinics')
    .upsert(records, { onConflict: 'code', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('  Error seeding clinics:', error.message)
    return { inserted: 0, skipped: records.length }
  }

  const inserted = data?.length ?? 0
  console.log(`  Clinics: ${inserted} inserted, ${records.length - inserted} skipped`)
  return { inserted, skipped: records.length - inserted }
}

async function seedProfiles(): Promise<SeedResult> {
  console.log('Seeding profiles (auth users + profile data)...')
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'profiles.md'))

  let inserted = 0
  let skipped = 0

  for (const row of rows) {
    // 1. Create auth user
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: row.email,
        email_confirm: true,
        password: 'bamboo-seed-2024',
        user_metadata: { full_name: row.full_name },
      })

      if (authError) {
        if (authError.message.includes('already') || authError.message.includes('exists') || authError.message.includes('duplicate')) {
          console.log(`  User ${row.email} already exists, updating profile...`)
        } else {
          console.error(`  Error creating user ${row.email}:`, authError.message)
        }
        skipped++
      } else {
        inserted++
      }

      // 2. Get the user id — either from creation result or by looking up profiles by email
      let userId = authData?.user?.id
      if (!userId) {
        // Look up via profiles table (trigger sets email on signup)
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', row.email)
          .single()
        userId = profileRow?.id
      }

      if (!userId) {
        console.error(`  Could not find user id for ${row.email}, skipping profile update`)
        continue
      }

      // 3. Update profile with full data (trigger should have created the row)
      const profileData: Record<string, unknown> = {
        id: userId,
        full_name: row.full_name,
        email: row.email,
        is_admin: row.is_admin === 'true',
        clinic_id: row.clinic_id,
        province: row.province,
        district: row.district,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        user_type: row.user_type,
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) {
        console.error(`  Error updating profile for ${row.email}:`, profileError.message)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  User ${row.email} already exists or error: ${msg}`)
      skipped++
    }

    // Progress indicator
    if ((inserted + skipped) % 20 === 0) {
      console.log(`  Progress: ${inserted + skipped}/${rows.length} profiles processed`)
    }
  }

  console.log(`  Profiles: ${inserted} created, ${skipped} skipped`)
  return { inserted, skipped }
}

async function seedConversations(): Promise<SeedResult> {
  console.log('Seeding conversations...')

  // 1. Insert template conversations from markdown
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'conversations.md'))
  const templateRecords = rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))

  // Insert in batches of 100
  let templateInserted = 0
  for (let i = 0; i < templateRecords.length; i += 100) {
    const batch = templateRecords.slice(i, i + 100)
    const { data, error } = await supabase
      .from('conversations')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error inserting template conversations batch ${i}:`, error.message)
    } else {
      templateInserted += data?.length ?? 0
    }
  }
  console.log(`  Template conversations: ${templateInserted} inserted, ${templateRecords.length - templateInserted} skipped`)

  // 2. Get all non-admin profiles for generating conversations
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, clinic_id')
    .eq('is_admin', false)

  if (!profiles || profiles.length === 0) {
    console.warn('  No non-admin profiles found. Skipping bulk conversation generation.')
    return { inserted: templateInserted, skipped: templateRecords.length - templateInserted }
  }

  // 3. Count existing conversations per month to know how many more to generate
  const { count: existingCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })

  const existingTotal = existingCount ?? 0
  const targetTotal = 4000
  const remaining = targetTotal - existingTotal

  if (remaining <= 0) {
    console.log(`  Already have ${existingTotal} conversations. Target reached.`)
    return { inserted: templateInserted, skipped: templateRecords.length - templateInserted }
  }

  console.log(`  Generating ~${remaining} additional conversations to reach ~${targetTotal} total...`)

  // Build monthly targets from Jan 2024 to Mar 2026
  const months: Array<{ year: number; month: number; target: number }> = []
  for (let y = 2024; y <= 2026; y++) {
    const maxMonth = y === 2026 ? 3 : 12
    for (let m = 1; m <= maxMonth; m++) {
      months.push({ year: y, month: m, target: getMonthlyTarget(y, m) })
    }
  }

  // Count templates per month
  const templateMonthCounts = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.created_at)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    templateMonthCounts.set(key, (templateMonthCounts.get(key) ?? 0) + 1)
  }

  // Generate conversations per month
  const allGenerated: Array<{
    id: string; user_id: string; title: string; created_at: string; updated_at: string
  }> = []

  for (const { year, month, target } of months) {
    const key = `${year}-${month}`
    const existing = templateMonthCounts.get(key) ?? 0
    const needed = Math.max(0, target - existing)

    for (let i = 0; i < needed; i++) {
      const profile = profiles[randomInt(0, profiles.length - 1)]
      const title = TITLE_TEMPLATES[randomInt(0, TITLE_TEMPLATES.length - 1)]
      const createdAt = randomDate(year, month)
      const updatedMs = new Date(createdAt).getTime() + randomInt(3, 20) * 60000
      const updatedAt = new Date(updatedMs).toISOString()

      allGenerated.push({
        id: crypto.randomUUID(),
        user_id: profile.id,
        title,
        created_at: createdAt,
        updated_at: updatedAt,
      })
    }
  }

  // Insert generated conversations in batches of 100
  let generatedInserted = 0
  for (let i = 0; i < allGenerated.length; i += 100) {
    const batch = allGenerated.slice(i, i + 100)
    const { data, error } = await supabase
      .from('conversations')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error inserting generated conversations batch ${i}:`, error.message)
    } else {
      generatedInserted += data?.length ?? 0
    }

    if (i % 500 === 0 && i > 0) {
      console.log(`  Generated conversations progress: ${i}/${allGenerated.length}`)
    }
  }

  const totalInserted = templateInserted + generatedInserted
  console.log(`  Generated conversations: ${generatedInserted} inserted`)
  console.log(`  Total conversations: ${totalInserted} inserted`)
  return { inserted: totalInserted, skipped: templateRecords.length - templateInserted }
}

async function seedMessages(): Promise<SeedResult> {
  console.log('Seeding messages...')

  // Get all conversation ids (paginate to bypass 1000-row PostgREST limit)
  const allConvIds: Array<{ id: string }> = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data: page, error: pageErr } = await supabase
      .from('conversations')
      .select('id')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (pageErr || !page || page.length === 0) break
    allConvIds.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  const conversations = allConvIds

  if (conversations.length === 0) {
    console.error('  Error fetching conversations or none found')
    return { inserted: 0, skipped: 0 }
  }

  // Check which conversations already have messages (paginate)
  const allExistingMsgConvs: Array<{ conversation_id: string }> = []
  let msgFrom = 0
  while (true) {
    const { data: msgPage } = await supabase
      .from('messages')
      .select('conversation_id')
      .range(msgFrom, msgFrom + pageSize - 1)
    if (!msgPage || msgPage.length === 0) break
    allExistingMsgConvs.push(...msgPage)
    if (msgPage.length < pageSize) break
    msgFrom += pageSize
  }
  const existingMsgConvs = allExistingMsgConvs

  const existingSet = new Set((existingMsgConvs ?? []).map(m => m.conversation_id))

  const toProcess = conversations.filter(c => !existingSet.has(c.id))
  console.log(`  ${toProcess.length} conversations need messages (${existingSet.size} already have messages)`)

  if (toProcess.length === 0) {
    return { inserted: 0, skipped: conversations.length }
  }

  let totalInserted = 0
  const messageBatch: Array<{
    id: string; conversation_id: string; role: string; content: string; created_at: string
  }> = []

  for (let ci = 0; ci < toProcess.length; ci++) {
    const conv = toProcess[ci]
    const msgCount = randomInt(3, 7) // 3-7 messages per conversation, avg ~5

    for (let mi = 0; mi < msgCount; mi++) {
      const role = mi % 2 === 0 ? 'user' : 'assistant'
      const templates = role === 'user' ? USER_MESSAGES : ASSISTANT_MESSAGES
      const content = templates[randomInt(0, templates.length - 1)]

      messageBatch.push({
        id: crypto.randomUUID(),
        conversation_id: conv.id,
        role,
        content,
        created_at: new Date(Date.now() - randomInt(0, 1000000)).toISOString(), // placeholder
      })
    }

    // Flush batch every 500 messages
    if (messageBatch.length >= 500) {
      const { data, error } = await supabase
        .from('messages')
        .upsert(messageBatch, { onConflict: 'id', ignoreDuplicates: true })
        .select('id')

      if (error) {
        console.error(`  Error inserting messages batch:`, error.message)
      } else {
        totalInserted += data?.length ?? 0
      }
      messageBatch.length = 0

      if (ci % 500 === 0 && ci > 0) {
        console.log(`  Messages progress: ${ci}/${toProcess.length} conversations processed (~${totalInserted} messages)`)
      }
    }
  }

  // Flush remaining messages
  if (messageBatch.length > 0) {
    const { data, error } = await supabase
      .from('messages')
      .upsert(messageBatch, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error inserting final messages batch:`, error.message)
    } else {
      totalInserted += data?.length ?? 0
    }
  }

  console.log(`  Messages: ${totalInserted} inserted, ${existingSet.size * 5} skipped (approx)`)
  return { inserted: totalInserted, skipped: existingSet.size }
}

async function seedQueryEvents(): Promise<SeedResult> {
  console.log('Seeding query_events...')

  // 1. Insert template query_events from markdown
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'query_events.md'))
  const templateRecords = rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    conversation_id: r.conversation_id,
    clinic_id: r.clinic_id,
    drug_category: r.drug_category,
    animal_type: r.animal_type,
    query_type: r.query_type,
    response_time_ms: parseInt(r.response_time_ms, 10),
    created_at: r.created_at,
  }))

  let templateInserted = 0
  for (let i = 0; i < templateRecords.length; i += 100) {
    const batch = templateRecords.slice(i, i + 100)
    const { data, error } = await supabase
      .from('query_events')
      .upsert(batch, { onConflict: 'conversation_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error inserting template query_events batch ${i}:`, error.message)
    } else {
      templateInserted += data?.length ?? 0
    }
  }
  console.log(`  Template query_events: ${templateInserted} inserted, ${templateRecords.length - templateInserted} skipped`)

  // 2. Get conversations without query_events (paginate both fetches)
  const allQEs: Array<{ conversation_id: string }> = []
  let qePage = 0
  while (true) {
    const { data: qePage_ } = await supabase
      .from('query_events')
      .select('conversation_id')
      .range(qePage * 1000, qePage * 1000 + 999)
    if (!qePage_ || qePage_.length === 0) break
    allQEs.push(...qePage_)
    if (qePage_.length < 1000) break
    qePage++
  }
  const existingConvIds = new Set(allQEs.map(qe => qe.conversation_id))

  const allConvsFull: Array<{ id: string; user_id: string; created_at: string }> = []
  let convPage = 0
  while (true) {
    const { data: convPage_ } = await supabase
      .from('conversations')
      .select('id, user_id, created_at')
      .range(convPage * 1000, convPage * 1000 + 999)
    if (!convPage_ || convPage_.length === 0) break
    allConvsFull.push(...convPage_)
    if (convPage_.length < 1000) break
    convPage++
  }
  const allConversations = allConvsFull

  if (allConversations.length === 0) {
    return { inserted: templateInserted, skipped: templateRecords.length - templateInserted }
  }

  const needsQE = allConversations.filter(c => !existingConvIds.has(c.id))
  console.log(`  ${needsQE.length} conversations need query_events`)

  if (needsQE.length === 0) {
    return { inserted: templateInserted, skipped: templateRecords.length - templateInserted + existingConvIds.size }
  }

  // Build user -> clinic_id mapping (paginate)
  const allProfiles: Array<{ id: string; clinic_id: string | null }> = []
  let profPage = 0
  while (true) {
    const { data: profPage_ } = await supabase
      .from('profiles')
      .select('id, clinic_id')
      .range(profPage * 1000, profPage * 1000 + 999)
    if (!profPage_ || profPage_.length === 0) break
    allProfiles.push(...profPage_)
    if (profPage_.length < 1000) break
    profPage++
  }
  const profilesData = allProfiles

  const userClinicMap = new Map<string, string>()
  for (const p of profilesData ?? []) {
    if (p.clinic_id) userClinicMap.set(p.id, p.clinic_id)
  }

  // Generate query_events for conversations that don't have one
  const generated: Array<{
    id: string; user_id: string; conversation_id: string; clinic_id: string | null;
    drug_category: string; animal_type: string; query_type: string;
    response_time_ms: number; created_at: string
  }> = []

  for (const conv of needsQE) {
    generated.push({
      id: crypto.randomUUID(),
      user_id: conv.user_id,
      conversation_id: conv.id,
      clinic_id: userClinicMap.get(conv.user_id) ?? null,
      drug_category: weightedRandom(DRUG_CATEGORY_DIST),
      animal_type: weightedRandom(ANIMAL_TYPE_DIST),
      query_type: weightedRandom(QUERY_TYPE_DIST),
      response_time_ms: randomInt(800, 5000),
      created_at: conv.created_at,
    })
  }

  // Insert in batches
  let generatedInserted = 0
  for (let i = 0; i < generated.length; i += 100) {
    const batch = generated.slice(i, i + 100)
    const { data, error } = await supabase
      .from('query_events')
      .upsert(batch, { onConflict: 'conversation_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error inserting generated query_events batch ${i}:`, error.message)
    } else {
      generatedInserted += data?.length ?? 0
    }

    if (i % 500 === 0 && i > 0) {
      console.log(`  Generated query_events progress: ${i}/${generated.length}`)
    }
  }

  const totalInserted = templateInserted + generatedInserted
  console.log(`  Generated query_events: ${generatedInserted} inserted`)
  return { inserted: totalInserted, skipped: templateRecords.length - templateInserted }
}

// ---------------------------------------------------------------------------
// Nhap-hang Seed Functions
// ---------------------------------------------------------------------------

async function seedSuppliers(): Promise<SeedResult> {
  console.log('Seeding suppliers...')

  // Idempotency check: if suppliers already exist, skip all nhap-hang seeding
  const { count } = await supabase.from('suppliers').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Nhap-hang tables already seeded (${count} suppliers). Skipping.`)
    return { inserted: 0, skipped: count }
  }

  const { SUPPLIERS } = await import('../data/seeds/suppliers')

  const { data, error } = await supabase
    .from('suppliers')
    .upsert(SUPPLIERS, { onConflict: 'supplier_code', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('  Error seeding suppliers:', error.message)
    return { inserted: 0, skipped: SUPPLIERS.length }
  }

  const inserted = data?.length ?? 0
  console.log(`  Suppliers: ${inserted} inserted, ${SUPPLIERS.length - inserted} skipped`)
  return { inserted, skipped: SUPPLIERS.length - inserted }
}

async function seedProducts(): Promise<SeedResult> {
  console.log('Seeding products...')
  const { PRODUCTS } = await import('../data/seeds/products')

  const { data, error } = await supabase
    .from('products')
    .upsert(PRODUCTS, { onConflict: 'product_code', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('  Error seeding products:', error.message)
    return { inserted: 0, skipped: PRODUCTS.length }
  }

  const inserted = data?.length ?? 0
  console.log(`  Products: ${inserted} inserted, ${PRODUCTS.length - inserted} skipped`)
  return { inserted, skipped: PRODUCTS.length - inserted }
}

async function seedPurchaseOrders(): Promise<SeedResult> {
  console.log('Seeding purchase_orders...')
  // Import items too so that totals are computed
  await import('../data/seeds/purchase_order_items')
  const { PURCHASE_ORDERS } = await import('../data/seeds/purchase_orders')

  // Build supplier_code -> id map
  const { data: suppliers } = await supabase.from('suppliers').select('id, supplier_code')
  const supplierMap = new Map((suppliers ?? []).map(s => [s.supplier_code, s.id]))

  const records = PURCHASE_ORDERS.map(o => ({
    order_code: o.order_code,
    order_date: o.order_date,
    supplier_id: supplierMap.get(o.supplier_code)!,
    total_amount: o.total_amount,
    total_promo_qty: o.total_promo_qty,
  }))

  let inserted = 0
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100)
    const { data, error } = await supabase
      .from('purchase_orders')
      .upsert(batch, { onConflict: 'order_code', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`  Error seeding purchase_orders batch ${i}:`, error.message)
    } else {
      inserted += data?.length ?? 0
    }
  }

  console.log(`  Purchase orders: ${inserted} inserted, ${records.length - inserted} skipped`)
  return { inserted, skipped: records.length - inserted }
}

async function seedPurchaseOrderItems(): Promise<SeedResult> {
  console.log('Seeding purchase_order_items...')
  const { PURCHASE_ORDER_ITEMS } = await import('../data/seeds/purchase_order_items')

  // Build product_code -> id map
  const { data: products } = await supabase.from('products').select('id, product_code')
  const productMap = new Map((products ?? []).map(p => [p.product_code, p.id]))

  // Build order_code -> id map
  const { data: orders } = await supabase.from('purchase_orders').select('id, order_code')
  const orderMap = new Map((orders ?? []).map(o => [o.order_code, o.id]))

  const records = PURCHASE_ORDER_ITEMS.map(item => ({
    order_id: orderMap.get(item.order_code)!,
    product_id: productMap.get(item.product_code)!,
    quantity: item.quantity,
    promo_qty: item.promo_qty,
    unit_price: item.unit_price,
  }))

  let inserted = 0
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100)
    const { data, error } = await supabase
      .from('purchase_order_items')
      .insert(batch)
      .select('id')

    if (error) {
      console.error(`  Error seeding purchase_order_items batch ${i}:`, error.message)
    } else {
      inserted += data?.length ?? 0
    }

    if (i % 500 === 0 && i > 0) {
      console.log(`  Purchase order items progress: ${i}/${records.length}`)
    }
  }

  console.log(`  Purchase order items: ${inserted} inserted, ${records.length - inserted} skipped`)
  return { inserted, skipped: records.length - inserted }
}

async function seedKbDocuments(): Promise<SeedResult> {
  console.log('Seeding kb_documents...')
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'kb_documents.md'))

  // Do NOT include `id` — let the database generate it
  const records = rows.map(r => ({
    doc_code: r.doc_code,
    doc_name: r.doc_name,
    chunk_count: parseInt(r.chunk_count, 10),
    doc_type: r.doc_type,
    category: r.category,
    drug_group: r.drug_group === 'null' ? null : r.drug_group,
    source: r.source,
    relevance_score: parseFloat(r.relevance_score),
    status: r.status,
    created_at: r.created_at,
  }))

  // Insert in batches
  let inserted = 0
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100)
    const { data, error } = await supabase
      .from('kb_documents')
      .upsert(batch, { onConflict: 'doc_code', ignoreDuplicates: true })
      .select('doc_code')

    if (error) {
      console.error(`  Error inserting kb_documents batch ${i}:`, error.message)
    } else {
      inserted += data?.length ?? 0
    }
  }

  console.log(`  KB Documents: ${inserted} inserted, ${records.length - inserted} skipped`)
  return { inserted, skipped: records.length - inserted }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Bamboo Vet Seed Script ===\n')
  const startTime = Date.now()

  // Check if already seeded
  const { count } = await supabase.from('clinics').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`Database already has ${count} clinics. Running in idempotent mode (will skip existing records).\n`)
  }

  const clinics = await seedClinics()
  const profiles = await seedProfiles()
  const conversations = await seedConversations()
  const messages = await seedMessages()
  const queryEvents = await seedQueryEvents()
  const kbDocs = await seedKbDocuments()

  // Nhap-hang tables (FK order: suppliers -> products -> orders -> items)
  const suppliers = await seedSuppliers()
  const products = await seedProducts()
  const purchaseOrders = await seedPurchaseOrders()
  const purchaseOrderItems = await seedPurchaseOrderItems()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n=== Seed Complete ===')
  console.log(`Clinics:       ${clinics.inserted} inserted, ${clinics.skipped} skipped`)
  console.log(`Profiles:      ${profiles.inserted} inserted, ${profiles.skipped} skipped`)
  console.log(`Conversations: ${conversations.inserted} inserted, ${conversations.skipped} skipped`)
  console.log(`Messages:      ${messages.inserted} inserted, ${messages.skipped} skipped`)
  console.log(`Query Events:  ${queryEvents.inserted} inserted, ${queryEvents.skipped} skipped`)
  console.log(`KB Documents:  ${kbDocs.inserted} inserted, ${kbDocs.skipped} skipped`)
  console.log(`Suppliers:     ${suppliers.inserted} inserted, ${suppliers.skipped} skipped`)
  console.log(`Products:      ${products.inserted} inserted, ${products.skipped} skipped`)
  console.log(`PO Orders:     ${purchaseOrders.inserted} inserted, ${purchaseOrders.skipped} skipped`)
  console.log(`PO Items:      ${purchaseOrderItems.inserted} inserted, ${purchaseOrderItems.skipped} skipped`)
  console.log(`\nTotal time: ${elapsed}s`)
}

main().catch(err => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
