import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/check-customers', () => ({ getCheckCustomersData: vi.fn() }))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import { getCheckCustomersData } from '@/lib/admin/services/check-customers'
import { GET } from '@/app/api/admin/check-customers/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetData = vi.mocked(getCheckCustomersData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/check-customers')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/check-customers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getCheckCustomersData with all filters parsed', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({ customers: [], total: 0 } as never)
    await GET(makeRequest({ page: '2', page_size: '20', province: 'HN', search: 'abc' }))
    expect(mockGetData).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      page_size: 20,
      province: 'HN',
      search: 'abc',
    }))
  })

  it('defaults page to 1 and page_size to 10', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({} as never)
    await GET(makeRequest())
    expect(mockGetData).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 10 }))
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
