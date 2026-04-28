import { describe, it, expect, beforeAll } from 'vitest'
import { generateToken, verifyToken } from '../src/auth.js'

beforeAll(() => {
  process.env.MCP_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
})

describe('verifyToken', () => {
  it('accepts a valid token', () => {
    const token = generateToken('client-1')
    const result = verifyToken(`Bearer ${token}`)
    expect(result).toEqual({ ok: true, sub: 'client-1' })
  })

  it('rejects missing Authorization header', () => {
    const result = verifyToken(undefined)
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects header without Bearer prefix', () => {
    const token = generateToken('client-1')
    const result = verifyToken(token)
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects an expired token', () => {
    const token = generateToken('client-1', '-1s')
    const result = verifyToken(`Bearer ${token}`)
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects a token signed with a different secret', async () => {
    const { default: jwt } = await import('jsonwebtoken')
    const bad = jwt.sign({ sub: 'client-1' }, 'wrong-secret', { algorithm: 'HS256' })
    const result = verifyToken(`Bearer ${bad}`)
    expect(result).toMatchObject({ ok: false, status: 401 })
  })

  it('rejects a malformed token', () => {
    const result = verifyToken('Bearer not.a.jwt')
    expect(result).toMatchObject({ ok: false, status: 401 })
  })
})
