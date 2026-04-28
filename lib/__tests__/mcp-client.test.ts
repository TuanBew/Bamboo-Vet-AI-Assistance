import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('MCP_SERVER_URL', 'http://localhost:3100')
vi.stubEnv('MCP_JWT_TOKEN', 'test-token')
vi.stubEnv('MCP_CHAT_ID', 'chat-123')

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { callMcpRelay } from '../mcp-client'

const messages = [{ role: 'user' as const, content: 'hello' }]

function makeStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(text)); c.close() },
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('callMcpRelay()', () => {
  it('calls /relay with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: makeStream('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'),
    })

    await callMcpRelay(messages)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3100/relay',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ messages, chat_id: 'chat-123' }),
      })
    )
  })

  it('returns the response body as a ReadableStream', async () => {
    const stream = makeStream('data: [DONE]\n\n')
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body: stream })

    const result = await callMcpRelay(messages)
    expect(result).toBe(stream)
  })

  it('throws on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, body: null })
    await expect(callMcpRelay(messages)).rejects.toThrow('MCP auth failed (401)')
  })

  it('throws on 429', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, body: null })
    await expect(callMcpRelay(messages)).rejects.toThrow('MCP server rate limit exceeded')
  })

  it('throws on 502', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, body: null })
    await expect(callMcpRelay(messages)).rejects.toThrow('MCP relay error: HTTP 502')
  })

  it('throws when response body is null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body: null })
    await expect(callMcpRelay(messages)).rejects.toThrow('empty response body')
  })

  it('throws when server is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await expect(callMcpRelay(messages)).rejects.toThrow('MCP server unreachable')
  })

  it('throws when env vars are missing', async () => {
    vi.stubEnv('MCP_SERVER_URL', '')
    await expect(callMcpRelay(messages)).rejects.toThrow('must be set')
    vi.stubEnv('MCP_SERVER_URL', 'http://localhost:3100')
  })
})
