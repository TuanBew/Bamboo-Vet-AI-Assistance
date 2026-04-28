const REDACTED_KEYS = new Set([
  'jwt_secret', 'mcp_jwt_secret',
  'ragflow_api_key', 'api_key',
  'password', 'token', 'secret', 'authorization',
])

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [
      k,
      REDACTED_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v,
    ])
  )
}

function write(level: string, msg: string, meta?: Record<string, unknown>) {
  const entry = { level, msg, ts: new Date().toISOString(), ...sanitize(meta ?? {}) }
  if (level === 'error') {
    process.stderr.write(JSON.stringify(entry) + '\n')
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n')
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
}
