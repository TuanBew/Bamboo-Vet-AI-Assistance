import jwt from 'jsonwebtoken'

function getSecret(): string {
  const secret = process.env.MCP_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('MCP_JWT_SECRET must be set and at least 32 characters')
  }
  return secret
}

export function verifyToken(
  authHeader: string | undefined
): { ok: true; sub: string } | { ok: false; status: 401; error: string } {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing_token' }
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, getSecret()) as { sub: string }
    if (typeof payload.sub !== 'string') {
      return { ok: false, status: 401, error: 'invalid_payload' }
    }
    return { ok: true, sub: payload.sub }
  } catch {
    return { ok: false, status: 401, error: 'invalid_token' }
  }
}

export function generateToken(sub: string, expiresIn: string = '30d'): string {
  return jwt.sign({ sub }, getSecret(), { algorithm: 'HS256', expiresIn } as jwt.SignOptions)
}
