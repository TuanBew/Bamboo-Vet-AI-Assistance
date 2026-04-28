import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/nhap-hang', () => ({ getNhapHangData: vi.fn() }))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import { getNhapHangData } from '@/lib/admin/services/nhap-hang'
import { GET } from '@/app/api/admin/nhap-hang/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetData = vi.mocked(getNhapHangData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/nhap-hang')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/nhap-hang', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getNhapHangData with parsed filters', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockResolvedValue({ orders: [] } as never)
    await GET(makeRequest({ npp: 'NPP1', year: '2025', month: '3' }))
    expect(mockGetData).toHaveBeenCalledWith({ npp: 'NPP1', year: 2025, month: 3 })
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetData.mockRejectedValue(new Error('DB error'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
