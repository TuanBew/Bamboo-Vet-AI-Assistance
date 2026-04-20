import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('mysql2/promise', () => {
  const mockConn = {
    execute: vi.fn(),
    query: vi.fn(),
    release: vi.fn(),
  }
  const mockPool = {
    getConnection: vi.fn().mockResolvedValue(mockConn),
  }
  return {
    default: { createPool: vi.fn().mockReturnValue(mockPool) },
    createPool: vi.fn().mockReturnValue(mockPool),
  }
})

vi.mock('../audit-logger', () => ({
  logQuery: vi.fn(),
}))

beforeAll(() => {
  process.env.MYSQL_HOST = 'localhost'
})

import { query, callSp } from '../client'
import { SafetyError } from '../validator'
import { logQuery } from '../audit-logger'
import { getPool } from '../pool'

describe('query()', () => {
  let mockConn: { execute: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConn = await getPool().getConnection() as typeof mockConn
    mockConn.query.mockResolvedValue([])
    mockConn.execute.mockResolvedValue([[{ id: 1, name: 'test' }], []])
  })

  it('returns rows from execute', async () => {
    mockConn.execute.mockResolvedValue([[{ id: 1 }, { id: 2 }], []])
    const result = await query<{ id: number }>('SELECT `id` FROM `door`', [])
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('passes params to execute', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT * FROM `door` WHERE `id` = ?', [42])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'SELECT * FROM `door` WHERE `id` = ?',
      [42]
    )
  })

  it('sets read-only session before execute', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(mockConn.query).toHaveBeenCalledWith('SET SESSION TRANSACTION READ ONLY')
    const queryOrder = mockConn.query.mock.invocationCallOrder[0]
    const executeOrder = mockConn.execute.mock.invocationCallOrder[0]
    expect(queryOrder).toBeLessThan(executeOrder)
  })

  it('releases connection on success', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(mockConn.release).toHaveBeenCalled()
  })

  it('releases connection on error', async () => {
    mockConn.execute.mockRejectedValue(new Error('DB down'))
    await expect(query('SELECT 1', [])).rejects.toThrow('DB down')
    expect(mockConn.release).toHaveBeenCalled()
  })

  it('throws SafetyError for dangerous SQL', async () => {
    await expect(query('DROP TABLE door', [])).rejects.toThrow(SafetyError)
    expect(mockConn.execute).not.toHaveBeenCalled()
  })

  it('calls audit logger with sql and duration', async () => {
    mockConn.execute.mockResolvedValue([[], []])
    await query('SELECT 1', [])
    expect(logQuery).toHaveBeenCalledWith('SELECT 1', expect.any(Number))
  })
})

describe('callSp()', () => {
  let mockConn: { execute: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConn = await getPool().getConnection() as typeof mockConn
    mockConn.query.mockResolvedValue([])
  })

  it('builds CALL statement from name and params', async () => {
    mockConn.execute.mockResolvedValue([
      [[ { id: 1 } ], { affectedRows: 0 }],
      [],
    ])
    await callSp('sp_name', ['a', 42])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'CALL sp_name(?,?)',
      ['a', 42]
    )
  })

  it('handles empty params', async () => {
    mockConn.execute.mockResolvedValue([
      [[ { id: 1 } ], { affectedRows: 0 }],
      [],
    ])
    await callSp('dashboard_npp_list', [])
    expect(mockConn.execute).toHaveBeenCalledWith(
      'CALL dashboard_npp_list()',
      []
    )
  })

  it('extracts first result set from CALL response', async () => {
    const rows = [{ code: 'A', name: 'NPP A' }, { code: 'B', name: 'NPP B' }]
    mockConn.execute.mockResolvedValue([
      [rows, { affectedRows: 0 }],
      [],
    ])
    const result = await callSp<{ code: string; name: string }>('sp_name', [])
    expect(result).toEqual(rows)
  })

  it('returns empty array when SP returns no result set', async () => {
    mockConn.execute.mockResolvedValue([
      [{ affectedRows: 0 }],
      [],
    ])
    const result = await callSp('sp_name', [])
    expect(result).toEqual([])
  })

  it('throws SafetyError for invalid SP name', async () => {
    await expect(callSp("'; DROP TABLE", [])).rejects.toThrow(SafetyError)
    expect(mockConn.execute).not.toHaveBeenCalled()
  })
})
