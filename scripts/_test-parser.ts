/**
 * Quick parser test — run with: npx tsx scripts/_test-parser.ts
 */
import fs from 'fs'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SQL_FILE = path.resolve(__dirname, '..', 'samples', 'dashboard_bamboovet.sql')

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

const INSERT_HEADER_RE = /^INSERT INTO `([^`]+)` \(([^)]+)\) VALUES$/i
const fileStream = fs.createReadStream(SQL_FILE, { encoding: 'utf8' })
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

let rowCount = 0
let inInsert = false
let cols: string[] = []
let tableName = ''
let lineNum = 0
const MAX_LINES = 500

for await (const rawLine of rl) {
  lineNum++
  if (lineNum > MAX_LINES) break
  const line = rawLine.trim()
  const match = line.match(INSERT_HEADER_RE)
  if (match) {
    if (rowCount > 0) console.log(`  => parsed ${rowCount} rows from ${tableName}`)
    rowCount = 0
    inInsert = true
    tableName = match[1]
    cols = match[2].split(',').map((c: string) => c.trim().replace(/^`|`$/g, ''))
    console.log(`\nINSERT table=${tableName}, cols=${cols.length}: [${cols.slice(0,3).join(', ')} ...]`)
    continue
  }
  if (!inInsert || !line.startsWith('(')) continue
  const fields = parseRow(line)
  if (fields) {
    rowCount++
    if (rowCount <= 2) {
      console.log(`  Row ${rowCount}: ${fields.length} fields, [0]=${fields[0]}, [-1]=${fields[fields.length-1]}`)
    }
  }
  if (line.endsWith(');')) { inInsert = false }
}
if (rowCount > 0) console.log(`  => parsed ${rowCount} rows from ${tableName}`)
console.log(`\nDone at line ${lineNum}`)
