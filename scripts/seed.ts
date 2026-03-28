/**
 * Bamboo Vet — Idempotent Seed Script
 *
 * Populates the database with 27 months of realistic Vietnamese veterinary
 * analytics data (Jan 2024 - Mar 2026).
 *
 * Uses TS generators for large datasets and markdown parsers for small static data.
 * Inserts in FK dependency order with batch chunking for 50K+ row volumes.
 *
 * All inserts use ON CONFLICT DO NOTHING / ignoreDuplicates for full idempotency.
 * Safe to run multiple times.
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// TS generators
import { generateProfiles, type ProfileSeed } from '../data/seeds/profiles'
import { generateConversations } from '../data/seeds/conversations'
import { generateMessages } from '../data/seeds/messages'
import { generateChatAnalytics } from '../data/seeds/chat_analytics'
import { generateQueryEvents } from '../data/seeds/query_events'
import { SUPPLIERS } from '../data/seeds/suppliers'
import { PRODUCTS } from '../data/seeds/products'
import { CUSTOMERS } from '../data/seeds/customers'
import { CUSTOMER_PURCHASES } from '../data/seeds/customer_purchases'
import { PURCHASE_ORDERS } from '../data/seeds/purchase_orders'
import { PURCHASE_ORDER_ITEMS } from '../data/seeds/purchase_order_items'
import { INVENTORY_SNAPSHOTS } from '../data/seeds/inventory_snapshots'
import { DISPLAY_PROGRAMS } from '../data/seeds/display-programs'
import { DISTRIBUTOR_STAFF } from '../data/seeds/distributor-staff'

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
// Markdown Table Parser (for small static data: clinics.md, kb_documents.md)
// ---------------------------------------------------------------------------

function parseMdTable(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return [] // need header + separator + at least 1 data row

  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0)

  const dataRows = lines.slice(2)

  return dataRows.map(row => {
    const rawCells = row.split('|').slice(1, -1).map(c => c.trim())
    const record: Record<string, string> = {}
    headers.forEach((header, i) => {
      record[header] = rawCells[i] ?? ''
    })
    return record
  })
}

// ---------------------------------------------------------------------------
// Batch Insert Helper
// ---------------------------------------------------------------------------

async function batchInsert(
  table: string,
  rows: Record<string, unknown>[],
  options: { chunkSize?: number; onConflict?: string; useInsert?: boolean } = {}
) {
  const { chunkSize = 500, onConflict = 'id', useInsert = false } = options
  console.log(`  Inserting ${rows.length} rows into ${table}...`)

  let totalInserted = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)

    let error: { message: string } | null = null
    let data: unknown[] | null = null

    if (useInsert) {
      const result = await supabase.from(table).insert(chunk).select('id')
      error = result.error
      data = result.data
    } else {
      const result = await supabase
        .from(table)
        .upsert(chunk, { onConflict, ignoreDuplicates: true })
        .select('id')
      error = result.error
      data = result.data
    }

    if (error) {
      console.error(`  Error inserting chunk ${i}-${i + chunk.length} into ${table}:`, error.message)
      // Continue with next chunk rather than failing entirely
    } else {
      totalInserted += (data as unknown[])?.length ?? 0
    }

    if (i > 0 && i % 5000 === 0) {
      console.log(`  ... ${i}/${rows.length} rows inserted`)
    }
  }

  console.log(`  Done: ${totalInserted}/${rows.length} rows into ${table}`)
  return totalInserted
}

// ---------------------------------------------------------------------------
// Seed Functions
// ---------------------------------------------------------------------------

async function seedClinics() {
  console.log('\n[1/16] Seeding clinics (from .md)...')
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

  return batchInsert('clinics', records, { onConflict: 'code' })
}

async function seedProfiles() {
  console.log('\n[2/16] Seeding profiles (auth users + profile data)...')
  const profiles = generateProfiles()

  let inserted = 0
  let skipped = 0

  for (const profile of profiles) {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        password: 'bamboo-seed-2024',
        user_metadata: { full_name: profile.full_name },
      })

      if (authError) {
        if (authError.message.includes('already') || authError.message.includes('exists') || authError.message.includes('duplicate')) {
          // Expected for idempotent runs
        } else {
          console.error(`  Error creating user ${profile.email}:`, authError.message)
        }
        skipped++
      } else {
        inserted++
      }

      // 2. Get user id
      let userId = authData?.user?.id
      if (!userId) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', profile.email)
          .single()
        userId = profileRow?.id
      }

      if (!userId) {
        console.error(`  Could not find user id for ${profile.email}, skipping profile update`)
        continue
      }

      // 3. Update profile
      const profileData: Record<string, unknown> = {
        id: userId,
        full_name: profile.full_name,
        email: profile.email,
        is_admin: profile.is_admin,
        province: profile.province,
        district: profile.district,
        lat: profile.latitude,
        lng: profile.longitude,
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) {
        console.error(`  Error updating profile for ${profile.email}:`, profileError.message)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  User ${profile.email} already exists or error: ${msg}`)
      skipped++
    }

    // Progress indicator
    if ((inserted + skipped) % 20 === 0) {
      console.log(`  Progress: ${inserted + skipped}/${profiles.length} profiles processed`)
    }
  }

  console.log(`  Done: ${inserted} created, ${skipped} skipped`)
  return inserted
}

async function seedConversations(profiles: ProfileSeed[]) {
  console.log('\n[3/16] Seeding conversations (TS generator)...')
  const conversations = generateConversations(profiles)
  return batchInsert('conversations', conversations as unknown as Record<string, unknown>[], {
    chunkSize: 500,
    onConflict: 'id',
  })
}

async function seedMessages() {
  console.log('\n[4/16] Seeding messages (TS generator)...')

  // Need conversations from DB to generate messages
  const allConvs: Array<{ id: string; user_id: string; created_at: string }> = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data: page } = await supabase
      .from('conversations')
      .select('id, user_id, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (!page || page.length === 0) break
    allConvs.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  if (allConvs.length === 0) {
    console.log('  No conversations found. Skipping messages.')
    return 0
  }

  // Check existing message count
  const { count: existingMsgCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })

  if (existingMsgCount && existingMsgCount > 1000) {
    console.log(`  Messages already seeded (${existingMsgCount} rows). Skipping.`)
    return 0
  }

  // Use generator with DB conversations as ConversationSeed-like input
  const messages = generateMessages(allConvs as any)
  return batchInsert('messages', messages as unknown as Record<string, unknown>[], {
    chunkSize: 1000,
    onConflict: 'id',
  })
}

async function seedChatAnalytics() {
  console.log('\n[5/16] Seeding chat_analytics (TS generator)...')

  // chat_analytics may not have a DB table yet -- check first
  const { error: tableCheck } = await supabase.from('chat_analytics').select('id', { count: 'exact', head: true })
  if (tableCheck) {
    console.log(`  chat_analytics table not found (${tableCheck.message}). Skipping.`)
    return 0
  }

  const { count } = await supabase.from('chat_analytics').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Chat analytics already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Fetch conversations for analytics generation
  const allConvs: Array<{ id: string; user_id: string; created_at: string }> = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('conversations')
      .select('id, user_id, created_at')
      .range(from, from + 999)
    if (!page || page.length === 0) break
    allConvs.push(...page)
    if (page.length < 1000) break
    from += 1000
  }

  const analytics = generateChatAnalytics(allConvs as any)
  return batchInsert('chat_analytics', analytics as unknown as Record<string, unknown>[], {
    chunkSize: 500,
    onConflict: 'id',
  })
}

async function seedQueryEvents(profiles: ProfileSeed[]) {
  console.log('\n[6/16] Seeding query_events (TS generator)...')

  const { count: existingCount } = await supabase.from('query_events').select('*', { count: 'exact', head: true })
  if (existingCount && existingCount > 1000) {
    console.log(`  Query events already seeded (${existingCount} rows). Skipping.`)
    return 0
  }

  // Fetch conversations
  const allConvs: Array<{ id: string; user_id: string; created_at: string }> = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('conversations')
      .select('id, user_id, created_at')
      .range(from, from + 999)
    if (!page || page.length === 0) break
    allConvs.push(...page)
    if (page.length < 1000) break
    from += 1000
  }

  const queryEvents = generateQueryEvents(allConvs as any, profiles)
  return batchInsert('query_events', queryEvents as unknown as Record<string, unknown>[], {
    chunkSize: 500,
    onConflict: 'conversation_id',
  })
}

async function seedKbDocuments() {
  console.log('\n[7/16] Seeding kb_documents (from .md)...')
  const rows = parseMdTable(path.resolve(__dirname, '..', 'data', 'seeds', 'kb_documents.md'))

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

  return batchInsert('kb_documents', records, { onConflict: 'doc_code' })
}

async function seedSuppliers() {
  console.log('\n[8/16] Seeding suppliers (TS generator)...')
  return batchInsert('suppliers', SUPPLIERS as unknown as Record<string, unknown>[], {
    onConflict: 'supplier_code',
  })
}

async function seedProducts() {
  console.log('\n[9/16] Seeding products (TS generator)...')
  return batchInsert('products', PRODUCTS as unknown as Record<string, unknown>[], {
    onConflict: 'product_code',
  })
}

async function seedCustomers() {
  console.log('\n[10/16] Seeding customers (TS generator)...')
  return batchInsert('customers', CUSTOMERS as unknown as Record<string, unknown>[], {
    chunkSize: 200,
    onConflict: 'customer_code',
  })
}

async function seedCustomerPurchases() {
  console.log('\n[11/16] Seeding customer_purchases (TS generator)...')

  const { count } = await supabase.from('customer_purchases').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Customer purchases already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Build customer_code -> id and product_code -> id maps
  const { data: customers } = await supabase.from('customers').select('id, customer_code')
  const customerMap = new Map((customers ?? []).map(c => [c.customer_code, c.id]))

  const { data: products } = await supabase.from('products').select('id, product_code')
  const productMap = new Map((products ?? []).map(p => [p.product_code, p.id]))

  const records = CUSTOMER_PURCHASES.map(row => ({
    customer_id: customerMap.get(row.customer_code)!,
    product_id: productMap.get(row.product_code)!,
    purchase_date: row.purchase_date,
    qty: row.qty,
    unit_price: row.unit_price,
    total_value: row.total_value,
  }))

  return batchInsert('customer_purchases', records, { chunkSize: 500, useInsert: true })
}

async function seedPurchaseOrders() {
  console.log('\n[12/16] Seeding purchase_orders (TS generator)...')

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

  return batchInsert('purchase_orders', records, { onConflict: 'order_code' })
}

async function seedPurchaseOrderItems() {
  console.log('\n[13/16] Seeding purchase_order_items (TS generator)...')

  const { count } = await supabase.from('purchase_order_items').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Purchase order items already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Build product_code -> id and order_code -> id maps
  const { data: products } = await supabase.from('products').select('id, product_code')
  const productMap = new Map((products ?? []).map(p => [p.product_code, p.id]))

  const { data: orders } = await supabase.from('purchase_orders').select('id, order_code')
  const orderMap = new Map((orders ?? []).map(o => [o.order_code, o.id]))

  const records = PURCHASE_ORDER_ITEMS.map(item => ({
    order_id: orderMap.get(item.order_code)!,
    product_id: productMap.get(item.product_code)!,
    quantity: item.quantity,
    promo_qty: item.promo_qty,
    unit_price: item.unit_price,
  }))

  return batchInsert('purchase_order_items', records, { chunkSize: 500, useInsert: true })
}

async function seedInventorySnapshots() {
  console.log('\n[14/16] Seeding inventory_snapshots (TS generator)...')

  const { count } = await supabase.from('inventory_snapshots').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Inventory snapshots already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Look up product IDs
  const { data: products } = await supabase.from('products').select('id, product_code')
  const productMap = new Map((products ?? []).map(p => [p.product_code, p.id]))

  const records = INVENTORY_SNAPSHOTS.map(row => ({
    product_id: productMap.get(row.product_code)!,
    snapshot_date: row.snapshot_date,
    qty: row.qty,
    unit_price: row.unit_price,
  }))

  return batchInsert('inventory_snapshots', records, {
    chunkSize: 200,
    onConflict: 'product_id,snapshot_date',
  })
}

async function seedDisplayPrograms() {
  console.log('\n[15/16] Seeding display_programs (TS generator)...')

  const { count } = await supabase.from('display_programs').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Display programs already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Get customer IDs to assign display programs to
  const { data: customers } = await supabase.from('customers').select('id').limit(5)
  if (!customers || customers.length === 0) {
    console.error('  No customers found. Skipping display programs.')
    return 0
  }

  const records = DISPLAY_PROGRAMS.map((dp, idx) => ({
    customer_id: customers[idx % customers.length].id,
    program_name: dp.program_name,
    staff_name: dp.staff_name,
    time_period: dp.time_period,
    registration_image_url: dp.registration_image_url,
    execution_image_url: dp.execution_image_url,
  }))

  return batchInsert('display_programs', records, { useInsert: true })
}

async function seedDistributorStaff() {
  console.log('\n[16/16] Seeding distributor_staff (TS generator)...')

  const { count } = await supabase.from('distributor_staff').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.log(`  Distributor staff already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Build supplier_code -> id map
  const { data: suppliers } = await supabase.from('suppliers').select('id, supplier_code')
  const supplierMap = new Map((suppliers ?? []).map(s => [s.supplier_code, s.id]))

  const records = DISTRIBUTOR_STAFF.map(staff => ({
    supplier_id: supplierMap.get(staff.supplier_code)!,
    staff_code: staff.staff_code,
    staff_name: staff.staff_name,
  }))

  return batchInsert('distributor_staff', records, {
    onConflict: 'supplier_id,staff_code',
  })
}

// ---------------------------------------------------------------------------
// Post-seed Updates (region/zone for suppliers, addresses for customers)
// ---------------------------------------------------------------------------

async function updateSuppliersRegionZone() {
  console.log('\n  Updating suppliers with region/zone...')

  const { data: check } = await supabase
    .from('suppliers')
    .select('region')
    .eq('supplier_code', 'NPP001')
    .single()

  if (check?.region) {
    console.log('  Suppliers already have region/zone data. Skipping.')
    return 0
  }

  const regionData = [
    { supplier_code: 'NPP001', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
    { supplier_code: 'NPP002', region: 'Mien Trung', zone: 'Duyen Hai Mien Trung' },
    { supplier_code: 'NPP003', region: 'Mien Nam', zone: 'Dong Nam Bo' },
    { supplier_code: 'NPP004', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
    { supplier_code: 'NPP005', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
    { supplier_code: 'NPP006', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
    { supplier_code: 'NPP007', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
    { supplier_code: 'NPP008', region: 'Mien Nam', zone: 'Dong Nam Bo' },
    { supplier_code: 'NPP009', region: 'Mien Nam', zone: 'Dong Nam Bo' },
    { supplier_code: 'NPP010', region: 'Mien Trung', zone: 'Duyen Hai Mien Trung' },
  ]

  let updated = 0
  for (const item of regionData) {
    const { error } = await supabase
      .from('suppliers')
      .update({ region: item.region, zone: item.zone })
      .eq('supplier_code', item.supplier_code)

    if (error) {
      console.error(`  Error updating supplier ${item.supplier_code}:`, error.message)
    } else {
      updated++
    }
  }

  console.log(`  Suppliers updated: ${updated}`)
  return updated
}

async function updateCustomersAddressFields() {
  console.log('  Updating customers with address fields...')

  const { data: check } = await supabase
    .from('customers')
    .select('address')
    .not('address', 'is', null)
    .limit(1)

  if (check && check.length > 0) {
    console.log('  Customers already have address data. Skipping.')
    return 0
  }

  // Fetch all customers
  const allCustomers: Array<{ id: string; customer_code: string; district: string | null }> = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data: page } = await supabase
      .from('customers')
      .select('id, customer_code, district')
      .range(from, from + pageSize - 1)
    if (!page || page.length === 0) break
    allCustomers.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  if (allCustomers.length === 0) {
    console.log('  No customers found. Skipping.')
    return 0
  }

  const STREETS = [
    'Nguyen Hue', 'Le Loi', 'Tran Hung Dao', 'Hai Ba Trung',
    'Pham Ngu Lao', 'Vo Van Tan', 'Ly Thuong Kiet', 'Nguyen Trai',
    'Le Duan', 'Pasteur', 'Dien Bien Phu', 'Nguyen Thi Minh Khai',
    'Cach Mang Thang 8', 'Truong Chinh', 'Lac Long Quan', 'Hoang Van Thu',
  ]

  const WARDS = [
    'Phuong 1', 'Phuong 2', 'Phuong 3', 'Phuong 4', 'Phuong 5',
    'Phuong 6', 'Phuong 7', 'Phuong 8', 'Phuong Tan Dinh', 'Phuong Ben Thanh',
    'Phuong Da Kao', 'Phuong Nguyen Cu Trinh', 'Phuong Cau Ong Lanh',
    'Phuong Ben Nghe', 'Phuong Co Giang', 'Phuong Pham Ngu Lao',
  ]

  function simpleHash(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0
    }
    return Math.abs(h)
  }

  let updated = 0
  for (const cust of allCustomers) {
    const hash = simpleHash(cust.customer_code)
    const streetNum = (hash % 200) + 1
    const street = STREETS[hash % STREETS.length]
    const ward = WARDS[(hash >> 4) % WARDS.length]
    const district = cust.district || 'Quan 1'
    const address = `${streetNum} ${street}, ${ward}, ${district}`

    const { error } = await supabase
      .from('customers')
      .update({ address, street, ward })
      .eq('id', cust.id)

    if (error) {
      console.error(`  Error updating customer ${cust.customer_code}:`, error.message)
    } else {
      updated++
    }
  }

  console.log(`  Customers updated with address: ${updated}`)
  return updated
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.time('seed')
  console.log('=== Bamboo Vet Seed Script ===')
  console.log(`Generators loaded:`)
  console.log(`  Profiles: ${generateProfiles().length}`)
  console.log(`  Suppliers: ${SUPPLIERS.length}`)
  console.log(`  Products: ${PRODUCTS.length}`)
  console.log(`  Customers: ${CUSTOMERS.length}`)
  console.log(`  Customer Purchases: ${CUSTOMER_PURCHASES.length}`)
  console.log(`  Purchase Orders: ${PURCHASE_ORDERS.length}`)
  console.log(`  Purchase Order Items: ${PURCHASE_ORDER_ITEMS.length}`)
  console.log(`  Inventory Snapshots: ${INVENTORY_SNAPSHOTS.length}`)
  console.log(`  Display Programs: ${DISPLAY_PROGRAMS.length}`)
  console.log(`  Distributor Staff: ${DISTRIBUTOR_STAFF.length}`)

  // Generate profiles once for reuse
  const profiles = generateProfiles()

  // FK dependency order: clinics -> profiles -> conversations -> messages ->
  //   chat_analytics -> query_events -> kb_documents ->
  //   suppliers -> products -> customers -> customer_purchases ->
  //   purchase_orders -> purchase_order_items -> inventory_snapshots ->
  //   display_programs -> distributor_staff

  const results: Array<{ table: string; count: number }> = []

  // 1. Clinics (from .md)
  results.push({ table: 'clinics', count: await seedClinics() })

  // 2. Profiles (auth users + profile trigger)
  results.push({ table: 'profiles', count: await seedProfiles() })

  // 3. Conversations (depends on profiles)
  results.push({ table: 'conversations', count: await seedConversations(profiles) })

  // 4. Messages (depends on conversations)
  results.push({ table: 'messages', count: await seedMessages() })

  // 5. Chat analytics (depends on conversations)
  results.push({ table: 'chat_analytics', count: await seedChatAnalytics() })

  // 6. Query events (depends on profiles + conversations)
  results.push({ table: 'query_events', count: await seedQueryEvents(profiles) })

  // 7. KB documents (from .md)
  results.push({ table: 'kb_documents', count: await seedKbDocuments() })

  // 8. Suppliers
  results.push({ table: 'suppliers', count: await seedSuppliers() })

  // 9. Products (depends on suppliers for manufacturer context)
  results.push({ table: 'products', count: await seedProducts() })

  // 10. Customers
  results.push({ table: 'customers', count: await seedCustomers() })

  // 11. Customer purchases (depends on customers + products)
  results.push({ table: 'customer_purchases', count: await seedCustomerPurchases() })

  // 12. Purchase orders (depends on suppliers)
  results.push({ table: 'purchase_orders', count: await seedPurchaseOrders() })

  // 13. Purchase order items (depends on orders + products)
  results.push({ table: 'purchase_order_items', count: await seedPurchaseOrderItems() })

  // 14. Inventory snapshots (depends on products)
  results.push({ table: 'inventory_snapshots', count: await seedInventorySnapshots() })

  // 15. Display programs (depends on customers)
  results.push({ table: 'display_programs', count: await seedDisplayPrograms() })

  // 16. Distributor staff (depends on suppliers)
  results.push({ table: 'distributor_staff', count: await seedDistributorStaff() })

  // Post-seed updates
  console.log('\n--- Post-seed updates ---')
  await updateSuppliersRegionZone()
  await updateCustomersAddressFields()

  // Summary
  console.log('\n=== Seed Complete ===')
  for (const r of results) {
    console.log(`  ${r.table.padEnd(25)} ${r.count} rows`)
  }

  console.timeEnd('seed')
}

main().catch(err => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
