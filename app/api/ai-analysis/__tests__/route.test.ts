import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/mysql/client', () => ({ query: vi.fn() }))
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { requireAdmin } from '@/lib/admin/auth'
import { query } from '@/lib/mysql/client'
import { POST } from '@/app/api/ai-analysis/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockQuery = vi.mocked(query)

function makeRequest() {
  return new NextRequest('http://localhost/api/ai-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

describe('POST /api/ai-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-api-key'
  })

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns HTML from Gemini on success', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    mockQuery.mockResolvedValue([])
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '<b>Analysis</b>' }] } }]
      }),
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { html: string }
    expect(body.html).toContain('<b>Analysis</b>')
  })

  it('strips markdown wrapper from Gemini response', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    mockQuery.mockResolvedValue([])
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '```html\n<b>Wrapped</b>\n```' }] } }]
      }),
    })
    const res = await POST(makeRequest())
    const body = await res.json() as { html: string }
    expect(body.html).toBe('<b>Wrapped</b>')
    expect(body.html).not.toContain('```')
  })

  it('returns 500 when Gemini API fails', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    mockQuery.mockResolvedValue([])
    mockFetch.mockResolvedValue({ ok: false, status: 429 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    mockQuery.mockResolvedValue([])
    const originalKey = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    if (originalKey) process.env.GEMINI_API_KEY = originalKey
  })
})
