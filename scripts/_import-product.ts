/**
 * One-shot import for the _product table only.
 * Usage: npx tsx scripts/_import-product.ts
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SQL_DUMP = path.resolve(__dirname, '..', 'samples', 'dashboard_bamboovet.sql')
const BATCH_SIZE = 500

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const PRODUCT_COL_MAP: Record<string, string> = {
  SiteCode: 'site_code',
  SKUCode: 'sku_code',
  SKUName: 'sku_name',
  Price: 'price',
  LastCost: 'last_cost',
  purchconvfctr: 'purchconvfctr',
  Category: 'category',
  Brand: 'brand',
  Product: 'product',
  isLotDateManager: 'is_lot_date_manager',
  TaxKey: 'tax_key',
  ConVertDesc: 'convert_desc',
  CaseDesc: 'case_desc',
}

function parseRow(line: string): string[] | null {
  let i = 0
  const len = line.length
  while (i < len && line[i] !== '(') i++
  if (i >= len) return null
  i++
  const fields: string[] = []
  let current = ''
  let inString = false
  let escaped = false
  while (i < len) {
    const ch = line[i]
    if (escaped) { current += ch; escaped = false; i++; continue }
    if (inString) {
      if (ch === '\\') { escaped = true; current += ch; i++; continue }
      if (ch === "'") {
        if (i + 1 < len && line[i + 1] === "'") { current += "''"; i += 2; continue }
        current += ch; inString = false; i++; continue
      }
      current += ch; i++; continue
    }
    if (ch === "'") { inString = true; current += ch; i++; continue }
    if (ch === ',') { fields.push(current.trim()); current = ''; i++; continue }
    if (ch === ')') { fields.push(current.trim()); return fields }
    current += ch; i++
  }
  fields.push(current.trim())
  return fields
}

function toJsValue(raw: string, pgCol: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'NULL') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    // is_lot_date_manager is smallint — keep as number
    return Number(trimmed)
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    let s = trimmed.slice(1, -1)
    s = s
      .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
      .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      .replace(/''/g, "'")
    if (s === '0000-00-00' || s === '0000-00-00 00:00:00') return null
    return s
  }
  return trimmed
}

const INSERT_HEADER_RE = /^INSERT INTO `([^`]+)` \(([^)]+)\) VALUES$/i

async function main() {
  console.log('Importing _product table...')
  const fileStream = fs.createReadStream(SQL_DUMP, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let inProduct = false
  let mysqlCols: string[] = []
  let pendingRows: string[][] = []
  let inserted = 0
  let errors: string[] = []

  const flush = async () => {
    if (pendingRows.length === 0) return
    const toInsert = pendingRows.splice(0)
    const rows: Record<string, unknown>[] = []
    for (const rawFields of toInsert) {
      const row: Record<string, unknown> = {}
      for (let i = 0; i < mysqlCols.length; i++) {
        const pgCol = PRODUCT_COL_MAP[mysqlCols[i]]
        if (!pgCol) continue
        row[pgCol] = toJsValue(rawFields[i] ?? 'NULL', pgCol)
      }
      rows.push(row)
    }
    const { error } = await supabase.from('product').upsert(rows, { ignoreDuplicates: true })
    if (error) {
      errors.push(error.message.substring(0, 200))
      console.error('Error:', error.message.substring(0, 200))
    } else {
      inserted += rows.length
      console.log(`  Inserted batch, total: ${inserted}`)
    }
  }

  for await (const rawLine of rl) {
    const line = rawLine.trim()
    const match = line.match(INSERT_HEADER_RE)
    if (match) {
      if (inProduct) await flush()
      if (match[1] === '_product') {
        inProduct = true
        mysqlCols = match[2].split(',').map(c => c.trim().replace(/^`|`$/g, ''))
        console.log(`Found _product INSERT, cols: ${mysqlCols.length}`)
        continue
      } else {
        inProduct = false
        continue
      }
    }
    if (!inProduct || !line.startsWith('(')) continue
    const fields = parseRow(line)
    if (fields) pendingRows.push(fields)
    if (pendingRows.length >= BATCH_SIZE) await flush()
    if (line.endsWith(');')) { await flush(); inProduct = false }
  }
  await flush()

  console.log(`\nDone. Inserted: ${inserted}, Errors: ${errors.length}`)

  // Verify
  const { count } = await supabase.from('product').select('*', { count: 'exact', head: true })
  console.log(`Supabase product table: ${count} rows`)
}

main().catch(console.error)
