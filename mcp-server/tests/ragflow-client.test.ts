import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamChat, listChats } from '../src/ragflow-client.js'

beforeEach(() => {
  process.env.RAGFLOW_BASE_URL = 'http://127.0.0.1'
  process.env.RAGFLOW_API_KEY = 'test-api-key'
  vi.restoreAllMocks()
})

function makeSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

describe('streamChat', () => {
  it('yields tokens from SSE stream', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: makeSseStream(sseLines),
    } as unknown as Response)

    const tokens: string[] = []
    for await (const token of streamChat({ message: 'hi', chatId: 'chat-1' })) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Hello', ' world'])
  })

  it('throws when RAGflow returns non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      body: null,
    } as unknown as Response)

    await expect(async () => {
      for await (const _ of streamChat({ message: 'hi', chatId: 'chat-1' })) { /* drain */ }
    }).rejects.toThrow('RAGflow error: 503')
  })

  it('skips malformed SSE lines without throwing', async () => {
    const sseLines = [
      'data: not-valid-json\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: makeSseStream(sseLines),
    } as unknown as Response)

    const tokens: string[] = []
    for await (const token of streamChat({ message: 'hi', chatId: 'chat-1' })) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['ok'])
  })
})

describe('listChats', () => {
  it('returns the data array from RAGflow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'c1', name: 'Vet Assistant' }] }),
    } as unknown as Response)

    const result = await listChats()
    expect(result).toEqual([{ id: 'c1', name: 'Vet Assistant' }])
  })

  it('throws when RAGflow returns non-OK status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response)

    await expect(listChats()).rejects.toThrow('RAGflow error: 500')
  })
})
