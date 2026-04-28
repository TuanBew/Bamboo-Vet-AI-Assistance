import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import http from 'http'
import { startServer } from '../src/index.js'
import { generateToken } from '../src/auth.js'
import { resetForTesting } from '../src/rate-limiter.js'

const TEST_PORT = 3199
let server: http.Server

beforeAll(async () => {
  process.env.MCP_JWT_SECRET = 'integration-test-secret-that-is-long-enough-32chars'
  process.env.MCP_PORT = String(TEST_PORT)
  process.env.RAGFLOW_BASE_URL = 'http://127.0.0.1'
  process.env.RAGFLOW_API_KEY = 'test-key'

  server = startServer(TEST_PORT)
  await new Promise<void>(resolve => server.once('listening', resolve))
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

function httpPost(
  body: unknown,
  authHeader?: string
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
            headers: res.headers,
          })
        )
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

const MCP_LIST_TOOLS = { jsonrpc: '2.0', method: 'tools/list', id: 1 }

describe('auth guard', () => {
  it('returns 401 with no Authorization header', async () => {
    const result = await httpPost(MCP_LIST_TOOLS)
    expect(result.status).toBe(401)
    const parsed = JSON.parse(result.body)
    expect(parsed).toMatchObject({ error: expect.any(String) })
  })

  it('returns 401 with invalid token', async () => {
    const result = await httpPost(MCP_LIST_TOOLS, 'Bearer not.a.valid.jwt')
    expect(result.status).toBe(401)
  })

  it('returns non-401 with valid token', async () => {
    const token = generateToken('test-client')
    const result = await httpPost(MCP_LIST_TOOLS, `Bearer ${token}`)
    expect(result.status).not.toBe(401)
  })
})

describe('rate limiter', () => {
  it('returns 429 after 60 requests and includes Retry-After header', async () => {
    resetForTesting()
    const token = generateToken('rate-limit-sub')
    const auth = `Bearer ${token}`

    // Mock fetch so ragflow calls don't fail during rate limit test
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
      body: null,
    } as unknown as Response)

    for (let i = 0; i < 60; i++) {
      await httpPost(MCP_LIST_TOOLS, auth)
    }

    const result = await httpPost(MCP_LIST_TOOLS, auth)
    expect(result.status).toBe(429)
    expect(result.headers['retry-after']).toBeDefined()

    vi.restoreAllMocks()
  })
})

describe('response headers', () => {
  it('sets X-Accel-Buffering: no on authenticated responses', async () => {
    const token = generateToken('header-test')
    const result = await httpPost(MCP_LIST_TOOLS, `Bearer ${token}`)
    expect(result.headers['x-accel-buffering']).toBe('no')
  })
})
