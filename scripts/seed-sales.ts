/**
 * Bamboo Vet — Sales & Inventory Seed Script (Plan 01-04)
 *
 * Populates the live Supabase database with:
 * - All products (from data/seeds/products.ts) + missing 5 suppliers
 * - 450 customers with lat/lon, supplier_id, Vietnamese names
 * - Daily inventory snapshots Jan 2024 – Mar 2026 (~53K rows)
 * - ~2,000 customer purchases with seasonal patterns
 *
 * Idempotent: checks counts before inserting, uses ON CONFLICT DO NOTHING.
 * Usage: npx tsx scripts/seed-sales.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detHash(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

async function batchInsert(
  table: string,
  rows: Record<string, unknown>[],
  opts: { chunkSize?: number; onConflict?: string; useInsert?: boolean } = {},
) {
  const { chunkSize = 500, onConflict, useInsert = false } = opts
  console.log(`  Inserting ${rows.length} rows into ${table}...`)

  let totalInserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    let error: { message: string } | null = null

    if (useInsert) {
      const result = await supabase.from(table).insert(chunk)
      error = result.error
      if (!error) totalInserted += chunk.length
    } else if (onConflict) {
      const result = await supabase
        .from(table)
        .upsert(chunk, { onConflict, ignoreDuplicates: true })
      error = result.error
      if (!error) totalInserted += chunk.length
    } else {
      const result = await supabase.from(table).upsert(chunk, { ignoreDuplicates: true })
      error = result.error
      if (!error) totalInserted += chunk.length
    }

    if (error) {
      console.error(`  Error at rows ${i}-${i + chunk.length}: ${error.message}`)
    }

    if (i > 0 && i % 5000 === 0) {
      console.log(`  ... ${i}/${rows.length}`)
    }
  }

  console.log(`  Done: ${totalInserted}/${rows.length} rows into ${table}`)
  return totalInserted
}

// ---------------------------------------------------------------------------
// Step 1: Upsert suppliers (ensure all 10 exist)
// ---------------------------------------------------------------------------

const SUPPLIERS_FULL = [
  { supplier_code: 'NPP001', supplier_name: 'Cong ty TNHH Phan phoi Thu y Mien Bac', province: 'Ha Noi', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
  { supplier_code: 'NPP002', supplier_name: 'Cong ty CP Duoc Thu y Trung Nam', province: 'Da Nang', region: 'Mien Trung', zone: 'Duyen Hai Mien Trung' },
  { supplier_code: 'NPP003', supplier_name: 'Cong ty TNHH Thuong mai Thu y Phuong Nam', province: 'TP. Ho Chi Minh', region: 'Mien Nam', zone: 'Dong Nam Bo' },
  { supplier_code: 'NPP004', supplier_name: 'Cong ty CP Phan phoi Nong nghiep Viet', province: 'Ha Noi', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
  { supplier_code: 'NPP005', supplier_name: 'Cong ty TNHH Duoc Thu y Dong Bac', province: 'Hai Phong', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
  { supplier_code: 'NPP006', supplier_name: 'Vimedimex', province: 'Ha Noi', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
  { supplier_code: 'NPP007', supplier_name: 'Hanvet', province: 'Hung Yen', region: 'Mien Bac', zone: 'Dong Bang Song Hong' },
  { supplier_code: 'NPP008', supplier_name: 'Navetco', province: 'TP. Ho Chi Minh', region: 'Mien Nam', zone: 'Dong Nam Bo' },
  { supplier_code: 'NPP009', supplier_name: 'Anova Feed', province: 'Binh Duong', region: 'Mien Nam', zone: 'Dong Nam Bo' },
  { supplier_code: 'NPP010', supplier_name: 'Vina Animal Health', province: 'Da Nang', region: 'Mien Trung', zone: 'Duyen Hai Mien Trung' },
]

async function seedSuppliers() {
  console.log('\n[1/5] Upserting 10 suppliers...')
  return batchInsert('suppliers', SUPPLIERS_FULL as any[], { onConflict: 'supplier_code' })
}

// ---------------------------------------------------------------------------
// Step 2: Upsert all products (from products.ts — 62 already exist, upsert all)
// ---------------------------------------------------------------------------

async function seedProducts() {
  console.log('\n[2/5] Upserting all products...')
  const { PRODUCTS } = await import('../data/seeds/products.js')
  console.log(`  Loaded ${PRODUCTS.length} products from data/seeds/products.ts`)
  return batchInsert('products', PRODUCTS as any[], { onConflict: 'product_code' })
}

// ---------------------------------------------------------------------------
// Step 3: Generate and insert 450 customers with lat/lon and supplier_id
// ---------------------------------------------------------------------------

interface ProvinceGeo {
  lat: number
  lon: number
  spread: number // lat/lon deviation range
}

const PROVINCE_GEO: Record<string, ProvinceGeo> = {
  'Ho Chi Minh': { lat: 10.8231, lon: 106.6297, spread: 0.08 },
  'Ha Noi': { lat: 21.0285, lon: 105.8542, spread: 0.07 },
  'Da Nang': { lat: 16.0544, lon: 108.2022, spread: 0.05 },
  'Hai Phong': { lat: 20.8449, lon: 106.6881, spread: 0.05 },
  'Can Tho': { lat: 10.0452, lon: 105.7469, spread: 0.05 },
  'Binh Duong': { lat: 11.0764, lon: 106.6093, spread: 0.06 },
  'Dong Nai': { lat: 10.9453, lon: 106.8243, spread: 0.06 },
  'Bac Ninh': { lat: 21.1861, lon: 106.0763, spread: 0.03 },
  'Quang Ninh': { lat: 21.006, lon: 107.2925, spread: 0.05 },
  'Nghe An': { lat: 18.6767, lon: 105.6813, spread: 0.04 },
  'Thanh Hoa': { lat: 19.8067, lon: 105.7852, spread: 0.04 },
  'Khanh Hoa': { lat: 12.2585, lon: 109.0526, spread: 0.04 },
  'Lam Dong': { lat: 11.9404, lon: 108.4583, spread: 0.03 },
  'Thua Thien Hue': { lat: 16.4637, lon: 107.5909, spread: 0.03 },
  'Long An': { lat: 10.5419, lon: 106.4138, spread: 0.05 },
}

const PROVINCE_WEIGHTS = [
  { name: 'Ho Chi Minh', weight: 25 },
  { name: 'Ha Noi', weight: 15 },
  { name: 'Da Nang', weight: 8 },
  { name: 'Hai Phong', weight: 6 },
  { name: 'Can Tho', weight: 6 },
  { name: 'Binh Duong', weight: 6 },
  { name: 'Dong Nai', weight: 5 },
  { name: 'Bac Ninh', weight: 4 },
  { name: 'Quang Ninh', weight: 4 },
  { name: 'Nghe An', weight: 4 },
  { name: 'Thanh Hoa', weight: 4 },
  { name: 'Khanh Hoa', weight: 4 },
  { name: 'Lam Dong', weight: 3 },
  { name: 'Thua Thien Hue', weight: 3 },
  { name: 'Long An', weight: 3 },
]

const DISTRICTS: Record<string, string[]> = {
  'Ha Noi': ['Ba Dinh', 'Hoan Kiem', 'Dong Da', 'Cau Giay', 'Thanh Xuan', 'Ha Dong', 'Long Bien', 'Nam Tu Liem'],
  'Ho Chi Minh': ['Quan 1', 'Quan 3', 'Quan 7', 'Binh Thanh', 'Go Vap', 'Phu Nhuan', 'Thu Duc', 'Tan Binh'],
  'Da Nang': ['Hai Chau', 'Thanh Khe', 'Son Tra', 'Ngu Hanh Son', 'Cam Le'],
  'Hai Phong': ['Hong Bang', 'Le Chan', 'Ngo Quyen', 'Kien An'],
  'Can Tho': ['Ninh Kieu', 'Cai Rang', 'Binh Thuy', 'O Mon'],
  'Binh Duong': ['Thu Dau Mot', 'Di An', 'Thuan An', 'Ben Cat'],
  'Dong Nai': ['Bien Hoa', 'Long Thanh', 'Nhon Trach', 'Trang Bom'],
  'Bac Ninh': ['Bac Ninh', 'Tu Son', 'Tien Du', 'Yen Phong'],
  'Quang Ninh': ['Ha Long', 'Cam Pha', 'Uong Bi', 'Mong Cai'],
  'Nghe An': ['Vinh', 'Cua Lo', 'Thai Hoa'],
  'Thanh Hoa': ['Thanh Hoa', 'Bim Son', 'Sam Son'],
  'Khanh Hoa': ['Nha Trang', 'Cam Ranh', 'Ninh Hoa'],
  'Lam Dong': ['Da Lat', 'Bao Loc'],
  'Thua Thien Hue': ['Hue', 'Huong Thuy'],
  'Long An': ['Tan An', 'Kien Tuong', 'Ben Luc'],
}

const VN_FIRST = ['Minh', 'Thanh', 'Hoang', 'Phuong', 'Hai', 'Lan', 'Hoa', 'Thu', 'Duc', 'Binh', 'Anh', 'Tuan', 'Hung', 'Long', 'Ngoc', 'Quang', 'Trung', 'Phuc', 'Dat', 'Khanh', 'Vinh', 'Trang', 'Linh', 'Huy', 'Son', 'Tam', 'Dung', 'Nam', 'Cuong', 'Thao']
const VN_LAST = ['Anh', 'Binh', 'Chi', 'Dung', 'Em', 'Gia', 'Hien', 'Khoa', 'Lam', 'My', 'Nhi', 'Oanh', 'Phat', 'Quy', 'Sen', 'Tien']

const TYPE_PREFIXES: Record<string, string[]> = {
  TH: ['Cua hang Thu y', 'Dai ly Thu y', 'Shop Thu y'],
  GSO: ['Bach hoa Thu y', 'Nha phan phoi', 'Tong kho Thu y'],
  PHA: ['Nha thuoc Thu y', 'Quay thuoc Thu y'],
  SPS: ['Cua hang Me Be', 'Shop Me va Be'],
  BTS: ['Cua hang My pham', 'Dai ly My pham'],
  OTHER: ['Cua hang', 'Shop'],
  PLT: ['Phu lieu toc', 'Cua hang Toc'],
  WMO: ['Cho', 'Sieu thi mini'],
}

const STREETS = ['Nguyen Hue', 'Le Loi', 'Tran Hung Dao', 'Hai Ba Trung', 'Pham Ngu Lao', 'Vo Van Tan', 'Ly Thuong Kiet', 'Nguyen Trai', 'Le Duan', 'Pasteur', 'Dien Bien Phu', 'Nguyen Thi Minh Khai', 'Cach Mang Thang 8', 'Truong Chinh', 'Lac Long Quan', 'Hoang Van Thu']
const WARDS = ['Phuong 1', 'Phuong 2', 'Phuong 3', 'Phuong 4', 'Phuong 5', 'Phuong 6', 'Phuong 7', 'Phuong 8', 'Phuong Tan Dinh', 'Phuong Ben Thanh', 'Phuong Da Kao', 'Phuong Ben Nghe']

async function seedCustomers(supplierIds: string[]) {
  console.log('\n[3/5] Generating 450 customers with lat/lon and supplier_id...')

  const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
  if (count && count >= 400) {
    console.log(`  Customers already seeded (${count} rows). Skipping.`)
    return 0
  }

  const typeDistribution = [
    { type: 'TH', count: 126 },
    { type: 'GSO', count: 153 },
    { type: 'PHA', count: 63 },
    { type: 'SPS', count: 54 },
    { type: 'BTS', count: 40 },
    { type: 'OTHER', count: 5 },
    { type: 'PLT', count: 5 },
    { type: 'WMO', count: 4 },
  ]

  const totalWeight = PROVINCE_WEIGHTS.reduce((s, p) => s + p.weight, 0)
  const customers: Record<string, unknown>[] = []
  let idx = 0

  for (const { type, count: cnt } of typeDistribution) {
    for (let i = 0; i < cnt; i++) {
      const code = `KH${String(idx + 1).padStart(3, '0')}`
      const firstName = VN_FIRST[idx % VN_FIRST.length]
      const lastName = VN_LAST[(idx * 7 + 3) % VN_LAST.length]
      const prefixes = TYPE_PREFIXES[type] || ['Cua hang']
      const prefix = prefixes[idx % prefixes.length]
      const name = `${prefix} ${firstName} ${lastName}`

      // Province selection
      const provHash = detHash(idx * 10 + 7)
      let cumWeight = 0
      let province = PROVINCE_WEIGHTS[0].name
      for (const pw of PROVINCE_WEIGHTS) {
        cumWeight += pw.weight
        if (provHash < cumWeight / totalWeight) {
          province = pw.name
          break
        }
      }
      const dists = DISTRICTS[province] || ['Quan 1']
      const district = dists[(idx * 3 + 1) % dists.length]

      const isActive = detHash(idx * 10 + 1) < 0.85
      const isMapped = detHash(idx * 10 + 2) < 0.70
      const isGeoLocated = detHash(idx * 10 + 3) < 0.65

      // Geo coordinates
      const geo = PROVINCE_GEO[province] || { lat: 10.8, lon: 106.6, spread: 0.05 }
      const lat = isGeoLocated ? +(geo.lat + (detHash(idx * 100 + 11) - 0.5) * 2 * geo.spread).toFixed(6) : null
      const lon = isGeoLocated ? +(geo.lon + (detHash(idx * 100 + 12) - 0.5) * 2 * geo.spread).toFixed(6) : null

      // Address fields
      const streetNum = (Math.abs(Math.floor(detHash(idx * 10 + 5) * 200)) + 1)
      const street = STREETS[idx % STREETS.length]
      const ward = WARDS[(idx * 3) % WARDS.length]
      const address = `${streetNum} ${street}, ${ward}, ${district}`

      // Supplier: distribute ~45 per supplier
      const supplierId = supplierIds[idx % supplierIds.length]

      // created_at: spread Jan 2024 - Mar 2026
      const monthOffset = Math.floor(detHash(idx * 10 + 4) * 26) // 0-26 months
      const dayOffset = Math.floor(detHash(idx * 10 + 6) * 28)
      const created = new Date(2024, monthOffset, dayOffset + 1)
      const createdAt = created.toISOString()

      customers.push({
        customer_code: code,
        customer_name: name,
        customer_type: type,
        province,
        district,
        is_active: isActive,
        is_mapped: isMapped,
        is_geo_located: isGeoLocated,
        latitude: lat,
        longitude: lon,
        address,
        street,
        ward,
        supplier_id: supplierId,
        created_at: createdAt,
      })

      idx++
    }
  }

  return batchInsert('customers', customers, { chunkSize: 200, onConflict: 'customer_code' })
}

// ---------------------------------------------------------------------------
// Step 4: Generate daily inventory snapshots (Jan 2024 – Mar 2026)
// ---------------------------------------------------------------------------

async function seedInventorySnapshots(productMap: Map<string, { id: string; price: number }>) {
  console.log('\n[4/5] Generating daily inventory snapshots Jan 2024 – Mar 2026...')

  const { count } = await supabase.from('inventory_snapshots').select('*', { count: 'exact', head: true })
  if (count && count > 5000) {
    console.log(`  Inventory snapshots already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Delete existing small dataset if present
  if (count && count > 0 && count < 5000) {
    console.log(`  Found ${count} old snapshots (too few). Deleting to regenerate...`)
    // Delete in batches to avoid timeout
    let deleted = 0
    while (deleted < count) {
      const { data } = await supabase.from('inventory_snapshots').select('id').limit(1000)
      if (!data || data.length === 0) break
      const ids = data.map(r => r.id)
      await supabase.from('inventory_snapshots').delete().in('id', ids)
      deleted += ids.length
      console.log(`  Deleted ${deleted}/${count}...`)
    }
  }

  const startDate = new Date(2024, 0, 1) // Jan 1, 2024
  const endDate = new Date(2026, 2, 29) // Mar 29, 2026

  const products = Array.from(productMap.entries())
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  console.log(`  ${products.length} products x ${totalDays} days = ~${products.length * totalDays} rows`)

  // Pre-generate all rows for batch insert
  const rows: Record<string, unknown>[] = []

  for (const [productCode, { id: productId, price }] of products) {
    // Base quantity: deterministic per product (50-500)
    const baseQty = 50 + Math.floor(detHash(productCode.length * 1000 + productCode.charCodeAt(0)) * 450)
    let qty = baseQty

    const d = new Date(startDate)
    let dayIdx = 0

    while (d <= endDate) {
      const month = d.getMonth() + 1
      const quarter = Math.ceil(month / 3)

      // Seasonal bias
      let bias = 0
      if (quarter === 1) bias = 0.02       // Q1: trend UP (replenishment)
      else if (quarter === 2) bias = 0.0    // Q2: stable
      else if (quarter === 3) bias = -0.015 // Q3: trend DOWN (disease season usage)
      else bias = -0.01                     // Q4: slight down then replenishment in Dec

      if (month === 12 && d.getDate() > 15) bias = 0.03 // Dec replenishment

      // Daily fluctuation: +-0-15% random
      const fluctuation = (detHash(dayIdx * 1000 + productCode.charCodeAt(0) * 100 + productCode.length) - 0.5) * 0.3
      const change = fluctuation + bias

      qty = Math.round(qty * (1 + change))
      qty = Math.max(5, Math.min(1000, qty)) // Floor 5, cap 1000

      // Unit price: base price +- 5% quarterly variation
      const priceVar = 1 + (detHash(quarter * 100 + productCode.charCodeAt(0)) - 0.5) * 0.1
      const unitPrice = Math.round(price * priceVar)

      const dateStr = d.toISOString().slice(0, 10)
      rows.push({
        product_id: productId,
        snapshot_date: dateStr,
        qty,
        unit_price: unitPrice,
      })

      d.setDate(d.getDate() + 1)
      dayIdx++
    }
  }

  console.log(`  Generated ${rows.length} snapshot rows`)
  return batchInsert('inventory_snapshots', rows, {
    chunkSize: 500,
    onConflict: 'product_id,snapshot_date',
  })
}

// ---------------------------------------------------------------------------
// Step 5: Generate customer purchases (Jan 2024 – Mar 2026)
// ---------------------------------------------------------------------------

async function seedCustomerPurchases(
  customerIds: string[],
  productList: Array<{ id: string; code: string; price: number }>,
) {
  console.log('\n[5/5] Generating customer purchases Jan 2024 – Mar 2026...')

  const { count } = await supabase.from('customer_purchases').select('*', { count: 'exact', head: true })
  if (count && count > 500) {
    console.log(`  Customer purchases already seeded (${count} rows). Skipping.`)
    return 0
  }

  // Seasonal multipliers per month (1-indexed)
  const SEASONAL: Record<number, number> = {
    1: 1.4, 2: 0.8, 3: 1.2, 4: 1.0, 5: 1.0, 6: 1.0,
    7: 1.3, 8: 1.3, 9: 1.1, 10: 1.2, 11: 1.2, 12: 1.5,
  }

  const purchases: Record<string, unknown>[] = []
  let purchaseIdx = 0

  // High-value customers: first 30% get more purchases
  const highValueCount = Math.floor(customerIds.length * 0.2)

  // Generate by month to ensure even distribution
  for (let year = 2024; year <= 2026; year++) {
    const maxMonth = year === 2026 ? 3 : 12
    for (let month = 1; month <= maxMonth; month++) {
      const multiplier = SEASONAL[month] || 1.0
      const basePurchasesThisMonth = Math.floor(70 * multiplier) // ~70-105 purchases per month

      for (let p = 0; p < basePurchasesThisMonth; p++) {
        const h = detHash(purchaseIdx * 7 + 1)

        // Customer selection: bias toward high-value customers
        let custIdx: number
        if (h < 0.4) {
          // 40% of purchases from top 20% customers
          custIdx = Math.floor(detHash(purchaseIdx * 7 + 2) * highValueCount)
        } else {
          custIdx = Math.floor(detHash(purchaseIdx * 7 + 2) * customerIds.length)
        }

        const customerId = customerIds[custIdx]

        // Product selection: weight toward first 30 products (top sellers)
        const prodH = detHash(purchaseIdx * 7 + 3)
        let prodIdx: number
        if (prodH < 0.6) {
          prodIdx = Math.floor(detHash(purchaseIdx * 7 + 4) * Math.min(30, productList.length))
        } else {
          prodIdx = Math.floor(detHash(purchaseIdx * 7 + 4) * productList.length)
        }

        const product = productList[prodIdx]

        // Quantity: 1-50, mostly 1-10
        const qtyH = detHash(purchaseIdx * 7 + 5)
        let qty: number
        if (qtyH < 0.7) qty = Math.floor(qtyH / 0.7 * 10) + 1 // 1-10
        else if (qtyH < 0.9) qty = Math.floor((qtyH - 0.7) / 0.2 * 20) + 10 // 10-30
        else qty = Math.floor((qtyH - 0.9) / 0.1 * 20) + 30 // 30-50

        // Unit price with +-10% variation
        const priceVar = 1 + (detHash(purchaseIdx * 7 + 6) - 0.5) * 0.2
        const unitPrice = Math.round(product.price * priceVar)
        const totalValue = qty * unitPrice

        // Purchase date: random day in month
        const maxDay = new Date(year, month, 0).getDate()
        const day = Math.floor(detHash(purchaseIdx * 7 + 7) * maxDay) + 1
        const purchaseDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        purchases.push({
          customer_id: customerId,
          product_id: product.id,
          purchase_date: purchaseDate,
          qty,
          unit_price: unitPrice,
          total_value: totalValue,
        })

        purchaseIdx++
      }
    }
  }

  console.log(`  Generated ${purchases.length} purchase rows`)
  return batchInsert('customer_purchases', purchases, { chunkSize: 500, useInsert: true })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.time('seed-sales')
  console.log('=== Bamboo Vet Sales Seed Script (Plan 01-04) ===')

  // Step 1: Suppliers
  await seedSuppliers()

  // Get supplier IDs
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, supplier_code')
    .order('supplier_code')
  if (!suppliers || suppliers.length === 0) {
    console.error('FATAL: No suppliers found.')
    process.exit(1)
  }
  const supplierIds = suppliers.map(s => s.id)
  console.log(`  Supplier IDs loaded: ${supplierIds.length}`)

  // Step 2: Products
  await seedProducts()

  // Get product map
  const allProducts: Array<{ id: string; product_code: string; unit_price: number }> = []
  let from = 0
  while (true) {
    const { data: page } = await supabase
      .from('products')
      .select('id, product_code, unit_price')
      .range(from, from + 999)
    if (!page || page.length === 0) break
    allProducts.push(...page)
    if (page.length < 1000) break
    from += 1000
  }
  console.log(`  Products in DB: ${allProducts.length}`)

  const productMap = new Map(allProducts.map(p => [p.product_code, { id: p.id, price: Number(p.unit_price) }]))

  // Step 3: Customers
  await seedCustomers(supplierIds)

  // Get customer IDs
  const allCustomerIds: string[] = []
  from = 0
  while (true) {
    const { data: page } = await supabase
      .from('customers')
      .select('id')
      .range(from, from + 999)
    if (!page || page.length === 0) break
    allCustomerIds.push(...page.map(c => c.id))
    if (page.length < 1000) break
    from += 1000
  }
  console.log(`  Customer IDs loaded: ${allCustomerIds.length}`)

  // Step 4: Inventory snapshots
  await seedInventorySnapshots(productMap)

  // Step 5: Customer purchases
  const productList = allProducts.map(p => ({
    id: p.id,
    code: p.product_code,
    price: Number(p.unit_price),
  }))
  await seedCustomerPurchases(allCustomerIds, productList)

  // Final counts
  console.log('\n=== Final Counts ===')
  for (const table of ['products', 'suppliers', 'customers', 'customer_purchases', 'inventory_snapshots']) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    console.log(`  ${table.padEnd(25)} ${count} rows`)
  }

  console.timeEnd('seed-sales')
}

main().catch(err => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
