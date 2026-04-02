/**
 * Import real production data from MySQL SQL dump into Supabase PostgreSQL.
 *
 * Usage: npx tsx scripts/import-real-data.ts
 *
 * Reads samples/dashboard_bamboovet.sql, parses MySQL INSERT statements,
 * maps column names, and upserts into Supabase in batches.
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

// ── Column maps (MySQL name → Postgres name) ──────────────────────────────────

const DOOR_COL_MAP: Record<string, string> = {
  V_Chanel: 'v_chanel',
  SystemType: 'system_type',
  Region: 'region',
  Area: 'area',
  SiteCode: 'site_code',
  SiteName: 'site_name',
  SSCode: 'ss_code',
  SSName: 'ss_name',
  SalepersonKey: 'saleperson_key',
  SalepersonName: 'saleperson_name',
  CustomerKey: 'customer_key',
  SKUCode: 'sku_code',
  SKUName: 'sku_name',
  CustClassKey: 'cust_class_key',
  OffDate: 'off_date',
  OffQty: 'off_qty',
  OffAmt: 'off_amt',
  OffDsc: 'off_dsc',
  OffTaxAmt: 'off_tax_amt',
  Price: 'price',
  Program_ID: 'program_id',
  Category: 'category',
  Brand: 'brand',
  Product: 'product',
  TypeName: 'type_name',
  CustomerName: 'customer_name',
  Address: 'address',
  TownName: 'town_name',
  ProvinceName: 'province_name',
  DistProvince: 'dist_province',
  Lat: 'lat',
  Long: 'long',
  ShipFromCode: 'ship_from_code',
  ShipFromName: 'ship_from_name',
  CustClassName: 'cust_class_name',
  GroupCustomer: 'group_customer',
  ShopOnline: 'shop_online',
  NoneIncentive: 'none_incentive',
  import_time: 'import_time',
  Year: 'year',
}

const DPUR_COL_MAP: Record<string, string> = {
  SystemType: 'system_type',
  Region: 'region',
  Area: 'area',
  SiteCode: 'site_code',
  SiteName: 'site_name',
  DistProvince: 'dist_province',
  Docno: 'docno',
  WhseCode: 'whse_code',
  Vendorkey: 'vendor_key',
  SKUCode: 'sku_code',
  SKUName: 'sku_name',
  PurDate: 'pur_date',
  ShipDate: 'ship_date',
  Seri: 'seri',
  Invno: 'invno',
  Trntyp: 'trntyp',
  V_Chanel: 'v_chanel',
  PRQty: 'pr_qty',
  PRAmt: 'pr_amt',
  PRTaxAmt: 'pr_tax_amt',
  Program_ID: 'program_id',
  Category: 'category',
  Brand: 'brand',
  Product: 'product',
  import_time: 'import_time',
  Year: 'year',
}

const INLOC_COL_MAP: Record<string, string> = {
  Region: 'region',
  SystemType: 'system_type',
  Area: 'area',
  ProvinceName: 'province_name',
  SiteCode: 'site_code',
  SiteName: 'site_name',
  DistProvince: 'dist_province',
  ShipFromCode: 'ship_from_code',
  ShipFromName: 'ship_from_name',
  WhseCode: 'whse_code',
  WhseName: 'whse_name',
  InvDate: 'inv_date',
  OnhandQty: 'onhand_qty',
  Category: 'category',
  Brand: 'brand',
  Product: 'product',
  SKUCode: 'sku_code',
  SKUName: 'sku_name',
  import_time: 'import_time',
  Year: 'year',
}

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

const ARSALESP_COL_MAP: Record<string, string> = {
  salesp_key: 'salesp_key',
  salesp_name: 'salesp_name',
  SSCode: 'ss_code',
  TradeSegment: 'trade_segment',
  Active: 'active',
  ProvinceCode: 'province_code',
  SiteCode: 'site_code',
  source_db: 'source_db',
}

// ── Table family detection ────────────────────────────────────────────────────

type TableFamily = 'door' | 'dpur' | 'inloc' | 'product' | 'arsalesp'

function getTableFamily(mysqlTable: string): TableFamily | null {
  if (mysqlTable === '_door' || /^_door\d+$/.test(mysqlTable)) return 'door'
  if (mysqlTable === '_dpur' || /^_dpur\d+$/.test(mysqlTable)) return 'dpur'
  if (mysqlTable === '_inloc' || /^_inloc\d+$/.test(mysqlTable)) return 'inloc'
  if (mysqlTable === '_product') return 'product'
  if (mysqlTable === 'arsalesp_all') return 'arsalesp'
  return null
}

function getColMap(family: TableFamily): Record<string, string> {
  switch (family) {
    case 'door': return DOOR_COL_MAP
    case 'dpur': return DPUR_COL_MAP
    case 'inloc': return INLOC_COL_MAP
    case 'product': return PRODUCT_COL_MAP
    case 'arsalesp': return ARSALESP_COL_MAP
  }
}

// ── MySQL row parser ──────────────────────────────────────────────────────────

/**
 * Parse a single VALUES row string like: ('val1', NULL, 42, 'val''s')
 * Returns array of raw token strings.
 */
function parseRow(line: string): string[] | null {
  // Find the opening paren (the line starts with the row, possibly leading whitespace)
  let i = 0
  const len = line.length

  // skip to first '('
  while (i < len && line[i] !== '(') i++
  if (i >= len) return null
  i++ // skip '('

  const fields: string[] = []
  let current = ''
  let inString = false
  let escaped = false

  while (i < len) {
    const ch = line[i]

    if (escaped) {
      current += ch
      escaped = false
      i++
      continue
    }

    if (inString) {
      if (ch === '\\') {
        escaped = true
        current += ch
        i++
        continue
      }
      if (ch === "'") {
        // check for '' (doubled quote escape)
        if (i + 1 < len && line[i + 1] === "'") {
          current += "''"
          i += 2
          continue
        }
        // end of string
        current += ch
        inString = false
        i++
        continue
      }
      current += ch
      i++
      continue
    }

    // Not in string
    if (ch === "'") {
      inString = true
      current += ch
      i++
      continue
    }

    if (ch === ',') {
      fields.push(current.trim())
      current = ''
      i++
      continue
    }

    if (ch === ')') {
      fields.push(current.trim())
      return fields
    }

    current += ch
    i++
  }

  // If we reach end of string without finding closing ), partial parse
  fields.push(current.trim())
  return fields
}

// ── Value conversion ──────────────────────────────────────────────────────────

// Only truly boolean PG columns (bool type). smallint and varchar cols stay as numbers/strings.
const BOOL_COLS = new Set(['shop_online', 'active'])
const DATE_COLS = new Set(['off_date', 'pur_date', 'inv_date', 'ship_date'])

function toJsValue(raw: string, pgCol: string): unknown {
  const trimmed = raw.trim()

  if (trimmed === 'NULL') return null

  // Unquoted number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    if (BOOL_COLS.has(pgCol)) return trimmed === '1'
    return Number(trimmed)
  }

  // Quoted string
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    let s = trimmed.slice(1, -1)
    // Unescape MySQL sequences
    s = s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/''/g, "'")

    // Invalid date sentinel
    if (s === '0000-00-00' || s === '0000-00-00 00:00:00') return null

    if (BOOL_COLS.has(pgCol)) return s === '1'
    return s
  }

  // Fallback: return as-is (shouldn't happen with clean MySQL dumps)
  return trimmed === 'NULL' ? null : trimmed
}

// ── Batch insert ──────────────────────────────────────────────────────────────

async function insertBatch(
  table: TableFamily,
  mysqlCols: string[],
  colMap: Record<string, string>,
  valueRows: string[][]
): Promise<{ inserted: number; skipped: number; errorMsg: string | null }> {
  const rows: Record<string, unknown>[] = []
  let skipped = 0

  for (const rawFields of valueRows) {
    const row: Record<string, unknown> = {}
    let skipRow = false

    for (let i = 0; i < mysqlCols.length; i++) {
      const mysqlCol = mysqlCols[i]
      const pgCol = colMap[mysqlCol]
      if (!pgCol) continue

      const raw = rawFields[i] ?? 'NULL'
      const val = toJsValue(raw, pgCol)

      if (DATE_COLS.has(pgCol) && val === null) {
        skipRow = true
        break
      }

      row[pgCol] = val
    }

    if (skipRow) { skipped++; continue }
    rows.push(row)
  }

  if (rows.length === 0) return { inserted: 0, skipped, errorMsg: null }

  const { error } = await supabase
    .from(table)
    .insert(rows)

  if (error) {
    // If duplicate key / unique violation, try upsert
    if (error.code === '23505' || error.message.includes('duplicate')) {
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(rows, { ignoreDuplicates: true })
      if (upsertError) {
        return { inserted: 0, skipped, errorMsg: upsertError.message }
      }
      return { inserted: rows.length, skipped, errorMsg: null }
    }
    return { inserted: 0, skipped, errorMsg: error.message }
  }

  return { inserted: rows.length, skipped, errorMsg: null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Stats {
  inserted: number
  skipped: number
  errors: string[]
}

const stats: Record<string, Stats> = {
  door: { inserted: 0, skipped: 0, errors: [] },
  dpur: { inserted: 0, skipped: 0, errors: [] },
  inloc: { inserted: 0, skipped: 0, errors: [] },
  product: { inserted: 0, skipped: 0, errors: [] },
  arsalesp: { inserted: 0, skipped: 0, errors: [] },
}

async function main() {
  console.log('Starting import from:', SQL_DUMP)
  console.log('Target Supabase:', SUPABASE_URL)
  console.log()

  const fileStream = fs.createReadStream(SQL_DUMP, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let currentFamily: TableFamily | null = null
  let currentMysqlCols: string[] = []
  let colMap: Record<string, string> = {}
  let pendingRows: string[][] = []
  let linesProcessed = 0
  let totalBatches = 0

  // Regex to detect INSERT header lines:
  // INSERT INTO `tablename` (`col1`, `col2`, ...) VALUES
  const INSERT_HEADER_RE = /^INSERT INTO `([^`]+)` \(([^)]+)\) VALUES$/i

  const flushBatch = async (force = false) => {
    if (!currentFamily || pendingRows.length === 0) return
    if (!force && pendingRows.length < BATCH_SIZE) return

    // Take up to BATCH_SIZE rows
    const toInsert = pendingRows.splice(0, BATCH_SIZE)
    const result = await insertBatch(currentFamily, currentMysqlCols, colMap, toInsert)

    stats[currentFamily].inserted += result.inserted
    stats[currentFamily].skipped += result.skipped
    if (result.errorMsg) {
      stats[currentFamily].errors.push(result.errorMsg.substring(0, 200))
    }
    totalBatches++

    if (totalBatches % 10 === 0) {
      const s = stats[currentFamily]
      process.stdout.write(
        `\r  [${currentFamily}] inserted=${s.inserted.toLocaleString()} skipped=${s.skipped} errors=${s.errors.length} batches=${totalBatches}   `
      )
    }
  }

  for await (const line of rl) {
    linesProcessed++

    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('/*')) continue

    // Detect INSERT header
    const headerMatch = trimmed.match(INSERT_HEADER_RE)
    if (headerMatch) {
      // Flush any remaining rows from previous block
      await flushBatch(true)

      const mysqlTable = headerMatch[1]
      const family = getTableFamily(mysqlTable)
      if (!family) {
        currentFamily = null
        continue
      }

      currentFamily = family
      colMap = getColMap(family)
      currentMysqlCols = headerMatch[2]
        .split(',')
        .map(c => c.trim().replace(/^`|`$/g, ''))
      pendingRows = []
      continue
    }

    // If not inside an INSERT block, skip
    if (!currentFamily) continue

    // This line should be a row: starts with ( and ends with ), or );
    if (!trimmed.startsWith('(')) continue

    const fields = parseRow(trimmed)
    if (!fields) continue

    pendingRows.push(fields)

    // Flush when batch is full
    while (pendingRows.length >= BATCH_SIZE) {
      await flushBatch(false)
    }

    // Detect end of INSERT block (line ends with );)
    if (trimmed.endsWith(');')) {
      await flushBatch(true)
      currentFamily = null
    }
  }

  // Final flush
  await flushBatch(true)

  console.log('\n\n=== Import Complete ===')
  console.log(`Total lines processed: ${linesProcessed.toLocaleString()}`)
  console.log(`Total batches sent:    ${totalBatches.toLocaleString()}`)
  console.log()

  for (const [table, s] of Object.entries(stats)) {
    console.log(`Table: ${table}`)
    console.log(`  Inserted : ${s.inserted.toLocaleString()}`)
    console.log(`  Skipped  : ${s.skipped.toLocaleString()} (invalid dates)`)
    if (s.errors.length > 0) {
      console.log(`  Errors   : ${s.errors.length}`)
      s.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`))
    }
  }

  // Verification: count rows in Supabase
  console.log('\n=== Supabase Row Counts ===')
  for (const table of ['door', 'dpur', 'inloc', 'product', 'arsalesp'] as const) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`  ${table}: ERROR - ${error.message}`)
    } else {
      console.log(`  ${table}: ${(count ?? 0).toLocaleString()} rows`)
    }
  }

  const hasErrors = Object.values(stats).some(s => s.errors.length > 0)
  console.log(hasErrors ? '\nStatus: DONE_WITH_CONCERNS' : '\nStatus: DONE')
  if (hasErrors) process.exit(1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
