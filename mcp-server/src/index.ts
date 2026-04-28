import http from 'http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './server.js'
import { verifyToken } from './auth.js'
import { checkRateLimit } from './rate-limiter.js'
import { logger } from './logger.js'

// Load .env if present (tsx does not auto-load it)
try {
  const lines = readFileSync(resolve(process.cwd(), '.env'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!(k in process.env)) process.env[k] = v
  }
} catch { /* .env not found — rely on existing process.env */ }

const PORT = parseInt(process.env.MCP_PORT ?? '3100', 10)

export function startServer(port = PORT): http.Server {
  const httpServer = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        await handleRequest(req, res, Buffer.concat(chunks))
      } catch (err) {
        logger.error('unhandled request error', { err: String(err) })
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'internal_error' }))
        }
      }
    })
  })

  httpServer.listen(port, () => {
    logger.info('MCP server listening', { port })
  })

  return httpServer
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: Buffer
): Promise<void> {
  // 1. Auth
  const auth = verifyToken(req.headers.authorization)
  if (!auth.ok) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: auth.error }))
    return
  }

  // 2. Rate limit
  const rl = checkRateLimit(auth.sub)
  if (!rl.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': String(rl.retryAfter ?? 60),
    })
    res.end(JSON.stringify({ error: 'rate_limited' }))
    return
  }

  logger.info('request', { sub: auth.sub, method: req.method, url: req.url })

  // 3. Parse body JSON (SDK expects a plain object, not a raw Buffer)
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body.toString('utf8'))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  // 4. Anti-buffering header (prevents Cloudflare from buffering SSE)
  res.setHeader('X-Accel-Buffering', 'no')

  // 5. MCP handler (fresh server+transport per stateless request)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  const server = createMcpServer()
  await server.connect(transport)
  await transport.handleRequest(req, res, parsedBody)
}

// Start server when run directly (not during tests)
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  startServer()
}
