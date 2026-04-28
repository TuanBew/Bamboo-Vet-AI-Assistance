import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, resetForTesting } from '../src/rate-limiter.js'

describe('rate-limiter', () => {
  beforeEach(() => {
    resetForTesting()
    vi.useRealTimers()
  })

  it('allows the first request', () => {
    const result = checkRateLimit('user-a')
    expect(result.allowed).toBe(true)
  })

  it('allows up to 60 requests within 60 seconds', () => {
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit('user-b').allowed).toBe(true)
    }
  })

  it('blocks the 61st request within 60 seconds', () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit('user-c')
    }
    const result = checkRateLimit('user-c')
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('tracks limits independently per sub', () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit('user-d')
    }
    expect(checkRateLimit('user-d').allowed).toBe(false)
    expect(checkRateLimit('user-e').allowed).toBe(true)
  })

  it('allows requests again after the window slides', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 60; i++) {
      checkRateLimit('user-f')
    }
    expect(checkRateLimit('user-f').allowed).toBe(false)

    vi.advanceTimersByTime(61_000)
    expect(checkRateLimit('user-f').allowed).toBe(true)
  })
})
