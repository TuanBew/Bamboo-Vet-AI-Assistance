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

type TableFamily = 'door' | 'dpur' | 'inloc' | 'product' | 'arsalesp' | null

function getTableFamily(mysqlTable: string): TableFamily {
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
    default: return {}
  }
}

// ── MySQL value parser ────────────────────────────────────────────────────────

/**
 * Parse the VALUES portion of a MySQL INSERT line.
 * Handles multi-row VALUES: (row1), (row2), ...;
 * Returns array of raw string arrays per row.
 */
function parseValuesSection(valuesStr: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const len = valuesStr.length

  while (i < len) {
    // find opening paren
    while (i < len && valuesStr[i] !== '(') i++
    if (i >= len) break
    i++ // skip '('

    const fields: string[] = []
    let current = ''
    let inString = false
    let stringChar = ''
    let escaped = false

    while (i < len) {
      const ch = valuesStr[i]

      if (escaped) {
        current += ch
        escaped = false
        i++
        continue
      }

      if (ch === '\\') {
        escaped = true
        current += ch
        i++
        continue
      }

      if (inString) {
        if (ch === stringChar) {
          // check for doubled-quote escape ''
          if (i + 1 < len && valuesStr[i + 1] === stringChar) {
            current += ch
            i += 2
            continue
          }
          inString = false
          current += ch
          i++
          continue
        }
        current += ch
        i++
        continue
      }

      if (ch === "'" || ch === '"') {
        inString = true
        stringChar = ch
        current += ch
        i++
        continue
      }

      if (ch === ',' ) {
        fields.push(current.trim())
        current = ''
        i++
        continue
      }

      if (ch === ')') {
        fields.push(current.trim())
        rows.push(fields)
        i++
        break
      }

      current += ch
      i++
    }
  }

  return rows
}

/**
 * Convert a raw MySQL field string to a JS value suitable for Supabase.
 */
function toJsValue(raw: string, pgCol: string): unknown {
  if (raw === 'NULL') return null

  // Unquoted numbers
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    // boolean columns
    if (pgCol === 'shop_online' || pgCol === 'none_incentive' || pgCol === 'active' || pgCol === 'is_lot_date_manager') {
      return raw === '1'
    }
    return Number(raw)
  }

  // Quoted string
  if ((raw.startsWith("'") && raw.endsWith("'"))) {
    let unquoted = raw.slice(1, -1)
    // Unescape MySQL escape sequences
    unquoted = unquoted
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/''/g, "'")

    // Invalid date sentinel
    if (unquoted === '0000-00-00' || unquoted === '0000-00-00 00:00:00') return null

    // Boolean columns that arrived as string '0'/'1'
    if (pgCol === 'shop_online' || pgCol === 'none_incentive' || pgCol === 'active' || pgCol === 'is_lot_date_manager') {
      return unquoted === '1'
    }

    return unquoted
  }

  return raw
}

// ── Batch upsert ──────────────────────────────────────────────────────────────

const DATE_COLS = new Set(['off_date', 'pur_date', 'inv_date', 'ship_date'])

async function upsertBatch(
  table: string,
  family: TableFamily,
  colMap: Record<string, string>,
  mysqlCols: string[],
  valueRows: string[][]
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = []
  let skipped = 0
  const pgCols = mysqlCols.map(c => colMap[c]).filter(Boolean)

  const rows: Record<string, unknown>[] = []

  for (const rawFields of valueRows) {
    const row: Record<string, unknown> = {}
    let skipRow = false

    for (let i = 0; i < mysqlCols.length; i++) {
      const mysqlCol = mysqlCols[i]
      const pgCol = colMap[mysqlCol]
      if (!pgCol) continue // column not in our schema

      const raw = rawFields[i] ?? 'NULL'
      const val = toJsValue(raw, pgCol)

      // Skip rows with invalid/missing date in primary date columns
      if (DATE_COLS.has(pgCol) && val === null) {
        skipRow = true
        break
      }

      row[pgCol] = val
    }

    if (skipRow) {
      skipped++
      continue
    }

    rows.push(row)
  }

  if (rows.length === 0) return { inserted: 0, skipped, errors }

  // Use upsert with ignoreDuplicates for idempotency
  // door table has serial id — no conflict key needed; use insert with onConflict ignore
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: '', ignoreDuplicates: true })

  if (error) {
    errors.push(`${table}: ${error.message} (batch of ${rows.length})`)
    return { inserted: 0, skipped, errors }
  }

  return { inserted: rows.length, skipped, errors }
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

  // State machine: we accumulate multi-line INSERT statements
  let currentFamily: TableFamily = null
  let currentMysqlCols: string[] = []
  let colMap: Record<string, string> = {}
  let pendingRows: string[][] = []
  let lineBuffer = ''
  let linesProcessed = 0
  let batchCount = 0

  const flushBatch = async () => {
    if (pendingRows.length === 0 || !currentFamily) return
    const table = currentFamily
    const result = await upsertBatch(table, currentFamily, colMap, currentMysqlCols, pendingRows)
    stats[table].inserted += result.inserted
    stats[table].skipped += result.skipped
    stats[table].errors.push(...result.errors)
    batchCount++
    if (batchCount % 20 === 0) {
      process.stdout.write(`\r  [${table}] inserted=${stats[table].inserted} skipped=${stats[table].skipped} batches=${batchCount}   `)
    }
    pendingRows = []
  }

  // Regex to detect the INSERT line header: INSERT INTO `tablename` (`col1`, ...) VALUES
  const INSERT_HEADER_RE = /^INSERT INTO `([^`]+)` \(([^)]+)\) VALUES$/i
  // A values row line ends with either ); or ),
  const ROW_LINE_RE = /^\(.*\)[,;]\s*$/

  for await (const rawLine of rl) {
    linesProcessed++
    const line = rawLine.trim()

    // Skip empty / comment lines
    if (!line || line.startsWith('--') || line.startsWith('/*') || line.startsWith('*/') || line.startsWith('/*!')) {
      continue
    }

    // Detect INSERT header
    const headerMatch = line.match(INSERT_HEADER_RE)
    if (headerMatch) {
      // flush any pending rows from previous INSERT block
      await flushBatch()

      const mysqlTable = headerMatch[1]
      const family = getTableFamily(mysqlTable)
      if (!family) {
        currentFamily = null
        continue
      }

      currentFamily = family
      colMap = getColMap(family)
      // Parse column names from header
      currentMysqlCols = headerMatch[2]
        .split(',')
        .map(c => c.trim().replace(/^`|`$/g, ''))

      lineBuffer = ''
      continue
    }

    // If we're inside an INSERT block, accumulate value lines
    if (!currentFamily) continue

    // Accumulate the line into buffer (handles multi-line rows)
    lineBuffer += (lineBuffer ? ' ' : '') + line

    // Try to extract complete rows from the buffer
    // A row is: (field,...) followed by , or );
    while (true) {
      const rowMatch = lineBuffer.match(/^(\((?:[^()']|'(?:[^'\\]|\\.)*')*\))[,;](.*)$/)
      if (!rowMatch) break

      const rowStr = rowMatch[1]
      lineBuffer = rowMatch[2].trim()

      const parsed = parseValuesSection(rowStr)
      if (parsed.length > 0) {
        pendingRows.push(...parsed)
      }

      if (pendingRows.length >= BATCH_SIZE) {
        const toFlush = pendingRows.splice(0, BATCH_SIZE)
        const table = currentFamily!
        const result = await upsertBatch(table, currentFamily, colMap, currentMysqlCols, toFlush)
        stats[table].inserted += result.inserted
        stats[table].skipped += result.skipped
        stats[table].errors.push(...result.errors)
        batchCount++
        if (batchCount % 20 === 0) {
          process.stdout.write(`\r  [${table}] inserted=${stats[table].inserted} skipped=${stats[table].skipped} batches=${batchCount}   `)
        }
      }

      // If line ended with ; the INSERT block is done
      if (rowMatch[0].includes(');')) {
        await flushBatch()
        currentFamily = null
        lineBuffer = ''
        break
      }
    }
  }

  // Flush any remaining rows
  await flushBatch()

  console.log('\n\n=== Import Complete ===')
  console.log(`Total lines processed: ${linesProcessed.toLocaleString()}`)
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

  // Sample verification queries
  console.log('\n=== Sample Verification ===')
  for (const table of ['door', 'dpur', 'inloc', 'product', 'arsalesp'] as const) {
    const { data: sampleData, error } = await supabase
      .from(table)
      .select('id')
      .limit(1)
    const count = sampleData !== null ? 'present' : 0
    if (error) {
      console.log(`  ${table}: ERROR - ${error.message}`)
    } else {
      console.log(`  ${table}: ${count?.toLocaleString() ?? 0} total rows in Supabase`)
    }
  }

  const hasErrors = Object.values(stats).some(s => s.errors.length > 0)
  if (hasErrors) {
    console.log('\nStatus: DONE_WITH_CONCERNS')
    process.exit(1)
  } else {
    console.log('\nStatus: DONE')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
