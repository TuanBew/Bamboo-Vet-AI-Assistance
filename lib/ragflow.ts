export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Call RAGflow and return a ReadableStream of SSE chunks.
// Throws if the request fails.
export async function callRagflow(messages: Message[]): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = process.env.RAGFLOW_BASE_URL!
  const apiKey  = process.env.RAGFLOW_API_KEY!
  const chatId  = process.env.RAGFLOW_CHAT_ID!

  const response = await fetch(
    `${baseUrl}/api/v1/chats_openai/${chatId}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'model',
        messages,
        stream: true,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`RAGflow ${response.status}: ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('RAGflow returned empty response body')
  }

  return response.body
}

// Parse delta content from an SSE data line.
// Returns the text token or null if not a content chunk.
export function parseSseLine(line: string): string | null {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    return json?.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}
