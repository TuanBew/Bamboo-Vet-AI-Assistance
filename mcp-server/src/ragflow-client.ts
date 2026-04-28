function getConfig() {
  return {
    baseUrl: process.env.RAGFLOW_BASE_URL ?? 'http://127.0.0.1',
    apiKey: process.env.RAGFLOW_API_KEY ?? '',
  }
}

interface ChatParams {
  message: string
  chatId: string
  conversationId?: string
}

export interface Chat {
  id: string
  name: string
  description?: string
}

export async function* streamChat(params: ChatParams): AsyncGenerator<string> {
  const { baseUrl, apiKey } = getConfig()

  const response = await fetch(
    `${baseUrl}/api/v1/chats_openai/${params.chatId}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'ragflow',
        messages: [{ role: 'user', content: params.message }],
        stream: true,
        ...(params.conversationId ? { conversation_id: params.conversationId } : {}),
      }),
    }
  )

  if (!response.ok || !response.body) {
    throw new Error(`RAGflow error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const token = json.choices?.[0]?.delta?.content
          if (token) yield token
        } catch {
          // skip malformed SSE line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function listChats(): Promise<Chat[]> {
  const { baseUrl, apiKey } = getConfig()

  const response = await fetch(`${baseUrl}/api/v1/chats`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!response.ok) {
    throw new Error(`RAGflow error: ${response.status}`)
  }

  const data = (await response.json()) as { data?: Chat[] }
  return data.data ?? []
}
