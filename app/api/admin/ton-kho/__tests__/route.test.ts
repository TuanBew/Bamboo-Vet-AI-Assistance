import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/ton-kho', () => ({ getTonKhoData: vi.fn() }))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import { getTonKhoData } from '@/lib/admin/services/ton-kho'
import { GET } from '@/app/api/admin/ton-kho/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetData = vi.mocked(getTonKhoData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/ton-kho')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/ton-kho', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getTonKhoData with correct filters', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({ products: [] } as never)
    await GET(makeRequest({ npp: 'NPP2', brand: 'BrandA', search: 'test' }))
    expect(mockGetData).toHaveBeenCalledWith(expect.objectContaining({
      npp: 'NPP2', brand: 'BrandA', search: 'test',
    }))
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
