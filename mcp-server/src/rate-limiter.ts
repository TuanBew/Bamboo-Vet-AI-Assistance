const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

const store = new Map<string, number[]>()

export function checkRateLimit(sub: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const timestamps = (store.get(sub) ?? []).filter(t => now - t < WINDOW_MS)

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0]
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    store.set(sub, timestamps)
    return { allowed: false, retryAfter }
  }

  timestamps.push(now)
  store.set(sub, timestamps)
  return { allowed: true }
}

export function resetForTesting() {
  store.clear()
}
