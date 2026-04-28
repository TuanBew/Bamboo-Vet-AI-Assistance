import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/check-distributor', () => ({ getCheckDistributorData: vi.fn() }))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import { getCheckDistributorData } from '@/lib/admin/services/check-distributor'
import { GET } from '@/app/api/admin/check-distributor/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetData = vi.mocked(getCheckDistributorData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/check-distributor')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/check-distributor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getCheckDistributorData with parsed filters', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({ distributors: [], total: 0 } as never)
    await GET(makeRequest({ year: '2025', metric: 'revenue', brand: 'BrandX', page: '2' }))
    expect(mockGetData).toHaveBeenCalledWith(expect.objectContaining({
      year: 2025,
      metric: 'revenue',
      brand: 'BrandX',
      page: 2,
    }))
  })

  it('defaults metric to "revenue" and page to 1', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({} as never)
    await GET(makeRequest())
    expect(mockGetData).toHaveBeenCalledWith(expect.objectContaining({
      metric: 'revenue',
      page: 1,
    }))
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
