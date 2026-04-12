import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),  // should NOT be called after optimization
}))

import { requireAdmin } from '../auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'

describe('requireAdmin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns user when is_admin is true in app_metadata', async () => {
    const mockUser = {
      id: 'user-123',
      app_metadata: { is_admin: true },
    }
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    } as any)

    const result = await requireAdmin()
    expect(result).toEqual(mockUser)
    // CRITICAL: createServiceClient must NOT be called
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('returns null when user is not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any)

    const result = await requireAdmin()
    expect(result).toBeNull()
  })

  it('returns null when is_admin is false in app_metadata', async () => {
    const mockUser = { id: 'user-123', app_metadata: { is_admin: false } }
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    } as any)

    const result = await requireAdmin()
    expect(result).toBeNull()
  })

  it('returns null when app_metadata is missing', async () => {
    const mockUser = { id: 'user-123', app_metadata: {} }
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    } as any)

    const result = await requireAdmin()
    expect(result).toBeNull()
  })
})
