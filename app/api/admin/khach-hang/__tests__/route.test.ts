import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/khach-hang', () => ({ getKhachHangData: vi.fn() }))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import { getKhachHangData } from '@/lib/admin/services/khach-hang'
import { GET } from '@/app/api/admin/khach-hang/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetData = vi.mocked(getKhachHangData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/khach-hang')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/khach-hang', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getKhachHangData with npp filter', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({ customers: [] } as never)
    await GET(makeRequest({ npp: 'NPP1' }))
    expect(mockGetData).toHaveBeenCalledWith({ npp: 'NPP1' })
  })

  it('defaults npp to empty string', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({} as never)
    await GET(makeRequest())
    expect(mockGetData).toHaveBeenCalledWith({ npp: '' })
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
