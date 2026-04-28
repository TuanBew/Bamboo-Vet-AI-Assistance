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

  // Anti-buffering header (prevents Cloudflare from buffering SSE)
  res.setHeader('X-Accel-Buffering', 'no')

  // 3. Route: /relay — SSE proxy for Next.js app streaming chat
  if (req.method === 'POST' && req.url === '/relay') {
    await handleRelay(res, body)
    return
  }

  // 4. Default: MCP protocol (for Claude Desktop / Claude Code / MCP clients)
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body.toString('utf8'))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  const server = createMcpServer()
  await server.connect(transport)
  await transport.handleRequest(req, res, parsedBody)
}

// /relay — authenticated SSE proxy to RAGflow for Next.js app.
// Accepts { messages, chat_id }, streams OpenAI-compatible SSE back.
// Same JWT auth + rate limiting as the MCP endpoint (applied in handleRequest).
async function handleRelay(
  res: http.ServerResponse,
  body: Buffer
): Promise<void> {
  interface RelayBody {
    messages: Array<{ role: string; content: string }>
    chat_id: string
  }

  let parsed: RelayBody
  try {
    parsed = JSON.parse(body.toString('utf8')) as RelayBody
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid_json' }))
    return
  }

  const { messages, chat_id } = parsed
  if (!Array.isArray(messages) || typeof chat_id !== 'string' || !chat_id) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'missing_fields' }))
    return
  }

  const baseUrl = process.env.RAGFLOW_BASE_URL ?? 'http://127.0.0.1'
  const apiKey  = process.env.RAGFLOW_API_KEY ?? ''

  let ragflowRes: Response
  try {
    ragflowRes = await fetch(
      `${baseUrl}/api/v1/chats_openai/${chat_id}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'ragflow', messages, stream: true }),
      }
    )
  } catch (err) {
    logger.error('relay: ragflow fetch failed', { err: String(err) })
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'ragflow_unavailable' }))
    return
  }

  if (!ragflowRes.ok || !ragflowRes.body) {
    logger.error('relay: ragflow error', { status: ragflowRes.status })
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'ragflow_unavailable' }))
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Pipe raw SSE bytes from RAGflow directly to client — zero transformation,
  // same OpenAI-compatible format that app/api/chat/route.ts already parses.
  const reader = ragflowRes.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const ok = res.write(value)
      if (!ok) {
        // Client disconnected — stop reading upstream
        await reader.cancel('client_disconnect').catch(() => {})
        break
      }
    }
  } catch (err) {
    logger.error('relay: stream error', { err: String(err) })
  } finally {
    reader.releaseLock()
    res.end()
  }
}

// Start server when run directly (not during tests)
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  startServer()
}
