/**
 * Performance Audit Script
 *
 * Checks the codebase for performance optimization patterns:
 * - SSE stream safety (timeouts, abort handling, cleanup)
 * - React memoization (React.memo, useMemo, useCallback)
 * - API caching headers (Cache-Control, ETag)
 * - Component sizes (flag >500 lines)
 * - Bundle-sensitive imports (dynamic imports for heavy libs)
 *
 * Usage: npx tsx scripts/perf-audit.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(import.meta.dirname ?? __dirname, '..')
const PASS = '\x1b[32mPASS\x1b[0m'
const WARN = '\x1b[33mWARN\x1b[0m'
const FAIL = '\x1b[31mFAIL\x1b[0m'
const INFO = '\x1b[36mINFO\x1b[0m'

interface AuditResult {
  category: string
  status: 'pass' | 'warn' | 'fail' | 'info'
  message: string
  file?: string
}

const results: AuditResult[] = []

function readFile(path: string): string {
  return readFileSync(join(ROOT, path), 'utf-8')
}

function findFiles(dir: string, ext: string): string[] {
  const files: string[] = []
  function walk(d: string) {
    try {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
            walk(full)
          } else if (entry.endsWith(ext)) {
            files.push(relative(ROOT, full).replace(/\\/g, '/'))
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(join(ROOT, dir))
  return files
}

// =============================================
// 1. SSE Stream Safety Audit
// =============================================
function auditSSEStreaming() {
  const chatRoute = readFile('app/api/chat/route.ts')

  const checks = [
    { pattern: /AbortController|request\.signal/, name: 'Client disconnect detection' },
    { pattern: /setTimeout.*timeout/i, name: 'Stream timeout' },
    { pattern: /reader\.cancel/i, name: 'Reader cancellation' },
    { pattern: /reader\.releaseLock/i, name: 'Reader lock release' },
    { pattern: /safeClose|controller\.close/, name: 'Safe stream close' },
    { pattern: /catch\s*[\({]/, name: 'Error handling in stream' },
    { pattern: /finally\s*\{/, name: 'Finally cleanup block' },
  ]

  for (const check of checks) {
    const found = check.pattern.test(chatRoute)
    results.push({
      category: 'SSE Streaming',
      status: found ? 'pass' : 'fail',
      message: `${check.name}: ${found ? 'implemented' : 'MISSING'}`,
      file: 'app/api/chat/route.ts',
    })
  }
}

// =============================================
// 2. React Memoization Audit
// =============================================
function auditMemoization() {
  const clientFiles = findFiles('app/admin', '.tsx').filter(f => f.includes('Client'))
  const sharedComponents = findFiles('components/admin', '.tsx')

  // Check shared components for React.memo
  for (const file of sharedComponents) {
    const content = readFile(file)
    const hasUseMemo = /useMemo/.test(content)
    const hasUseCallback = /useCallback/.test(content)
    const hasReactMemo = /React\.memo|memo\(/.test(content)
    const lineCount = content.split('\n').length

    if (lineCount > 100) {
      results.push({
        category: 'Memoization',
        status: hasUseMemo || hasUseCallback ? 'pass' : 'warn',
        message: `${file} (${lineCount} lines): useMemo=${hasUseMemo}, useCallback=${hasUseCallback}, React.memo=${hasReactMemo}`,
        file,
      })
    }
  }

  // Check client page components
  for (const file of clientFiles) {
    const content = readFile(file)
    const lineCount = content.split('\n').length
    const hasUseMemo = /useMemo/.test(content)
    const hasUseCallback = /useCallback/.test(content)

    results.push({
      category: 'Memoization',
      status: hasUseMemo ? 'pass' : (lineCount > 300 ? 'warn' : 'info'),
      message: `${file} (${lineCount} lines): useMemo=${hasUseMemo}, useCallback=${hasUseCallback}`,
      file,
    })
  }
}

// =============================================
// 3. API Caching Headers Audit
// =============================================
function auditCachingHeaders() {
  const apiRoutes = findFiles('app/api/admin', '.ts').filter(f => f.includes('route'))

  for (const file of apiRoutes) {
    const content = readFile(file)
    const hasCacheControl = /Cache-Control/i.test(content)
    const hasETag = /ETag/i.test(content)
    const hasNextRevalidate = /revalidate/i.test(content)

    results.push({
      category: 'API Caching',
      status: hasCacheControl || hasNextRevalidate ? 'pass' : 'info',
      message: `${file}: Cache-Control=${hasCacheControl}, ETag=${hasETag}, revalidate=${hasNextRevalidate}`,
      file,
    })
  }
}

// =============================================
// 4. Component Size Audit
// =============================================
function auditComponentSizes() {
  const allTsx = [
    ...findFiles('app/admin', '.tsx'),
    ...findFiles('components/admin', '.tsx'),
  ]

  const large: { file: string; lines: number }[] = []
  for (const file of allTsx) {
    const content = readFile(file)
    const lines = content.split('\n').length
    if (lines > 400) {
      large.push({ file, lines })
    }
  }

  large.sort((a, b) => b.lines - a.lines)

  if (large.length === 0) {
    results.push({
      category: 'Component Size',
      status: 'pass',
      message: 'No components exceed 400 lines',
    })
  } else {
    for (const { file, lines } of large) {
      results.push({
        category: 'Component Size',
        status: lines > 600 ? 'warn' : 'info',
        message: `${file}: ${lines} lines${lines > 600 ? ' (consider splitting)' : ''}`,
        file,
      })
    }
  }
}

// =============================================
// 5. Dynamic Import Audit (heavy libs)
// =============================================
function auditDynamicImports() {
  const heavyLibs = ['xlsx', 'jspdf', 'leaflet', 'recharts']
  const clientFiles = findFiles('app/admin', '.tsx').filter(f => f.includes('Client'))
  const sharedFiles = findFiles('components/admin', '.tsx')

  for (const file of [...clientFiles, ...sharedFiles]) {
    const content = readFile(file)
    for (const lib of heavyLibs) {
      const staticImport = new RegExp(`^import\\s.*from\\s+['"]${lib}`, 'm')
      const dynamicImport = new RegExp(`import\\(['"]${lib}`)

      if (staticImport.test(content)) {
        results.push({
          category: 'Bundle',
          status: dynamicImport.test(content) ? 'pass' : 'info',
          message: `${file}: static import of '${lib}'${dynamicImport.test(content) ? ' (also has dynamic)' : ''}`,
          file,
        })
      }
    }
  }
}

// =============================================
// Run all audits
// =============================================
console.log('\n=== Bamboo Vet Performance Audit ===\n')

auditSSEStreaming()
auditMemoization()
auditCachingHeaders()
auditComponentSizes()
auditDynamicImports()

// Print results grouped by category
const categories = [...new Set(results.map(r => r.category))]
let passCount = 0
let warnCount = 0
let failCount = 0

for (const cat of categories) {
  console.log(`\n--- ${cat} ---`)
  const catResults = results.filter(r => r.category === cat)
  for (const r of catResults) {
    const icon = r.status === 'pass' ? PASS : r.status === 'warn' ? WARN : r.status === 'fail' ? FAIL : INFO
    console.log(`  ${icon} ${r.message}`)
    if (r.status === 'pass') passCount++
    else if (r.status === 'warn') warnCount++
    else if (r.status === 'fail') failCount++
  }
}

console.log(`\n=== Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail ===\n`)

// Exit with code 1 if any failures
if (failCount > 0) process.exit(1)
