// MCP relay client — drop-in replacement for lib/ragflow.ts callRagflow().
// Calls the MCP server's /relay endpoint (JWT-authenticated SSE proxy)
// instead of hitting RAGflow directly. Same output: ReadableStream<Uint8Array>
// in OpenAI-compatible SSE format so parseSseLine still works unchanged.

export type { Message } from './ragflow'
export { parseSseLine } from './ragflow'

export async function callMcpRelay(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const serverUrl = process.env.MCP_SERVER_URL
  const token     = process.env.MCP_JWT_TOKEN
  const chatId    = process.env.MCP_CHAT_ID ?? process.env.RAGFLOW_CHAT_ID

  if (!serverUrl || !token || !chatId) {
    throw new Error('MCP_SERVER_URL, MCP_JWT_TOKEN, and MCP_CHAT_ID must be set')
  }

  let response: Response
  try {
    response = await fetch(`${serverUrl}/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, chat_id: chatId }),
      signal: AbortSignal.timeout(65_000),
    })
  } catch (err) {
    throw new Error(`MCP server unreachable: ${err}`)
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`MCP auth failed (${response.status}) — check MCP_JWT_TOKEN`)
  }

  if (response.status === 429) {
    throw new Error('MCP server rate limit exceeded')
  }

  if (!response.ok) {
    throw new Error(`MCP relay error: HTTP ${response.status}`)
  }

  if (!response.body) {
    throw new Error('MCP relay returned empty response body')
  }

  return response.body
}
