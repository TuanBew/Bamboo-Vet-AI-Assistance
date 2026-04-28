import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateToken } from '../src/auth.js'

// Load .env before generateToken() calls getSecret()
// (getSecret is lazy — reads process.env at call time, not at import time)
try {
  const envPath = resolve(process.cwd(), '.env')
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!(key in process.env)) process.env[key] = val
  }
} catch {
  // .env not found — rely on existing process.env
}

const sub = process.argv[2] ?? 'mcp-client'
const expiresIn = process.argv[3] ?? '30d'

const token = generateToken(sub, expiresIn)

console.log('\n=== MCP JWT Token ===')
console.log(`sub: ${sub}`)
console.log(`expires: ${expiresIn}`)
console.log(`\ntoken:\n${token}\n`)
console.log('Use as: Authorization: Bearer <token>')
console.log('====================\n')
