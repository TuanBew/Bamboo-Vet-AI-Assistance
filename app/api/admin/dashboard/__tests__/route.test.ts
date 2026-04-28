import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/admin/services/dashboard', () => ({
  getDashboardData: vi.fn(),
  getCachedDashboardFastData: vi.fn(),
  getCachedDashboardSlowData: vi.fn(),
}))
vi.mock('@/lib/admin/cache-headers', () => ({
  jsonWithCache: vi.fn((_req: unknown, data: unknown) => Response.json(data)),
}))

import { requireAdmin } from '@/lib/admin/auth'
import {
  getDashboardData,
  getCachedDashboardFastData,
  getCachedDashboardSlowData,
} from '@/lib/admin/services/dashboard'
import { GET } from '@/app/api/admin/dashboard/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetAll = vi.mocked(getDashboardData)
const mockGetFast = vi.mocked(getCachedDashboardFastData)
const mockGetSlow = vi.mocked(getCachedDashboardSlowData)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/dashboard')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calls getDashboardData for layer=all', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetAll.mockResolvedValue({ kpis: [] } as never)
    await GET(makeRequest())
    expect(mockGetAll).toHaveBeenCalledOnce()
  })

  it('calls getCachedDashboardFastData for layer=fast', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetFast.mockResolvedValue({} as never)
    await GET(makeRequest({ layer: 'fast' }))
    expect(mockGetFast).toHaveBeenCalledOnce()
  })

  it('calls getCachedDashboardSlowData for layer=slow', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetSlow.mockResolvedValue({} as never)
    await GET(makeRequest({ layer: 'slow' }))
    expect(mockGetSlow).toHaveBeenCalledOnce()
  })

  it('returns 500 when service throws', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'u1' } as never)
    mockGetAll.mockRejectedValue(new Error('DB down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
