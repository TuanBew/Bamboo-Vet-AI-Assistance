import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { stripHtml } from 'string-strip-html'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callRagflow, parseSseLine, type Message } from '@/lib/ragflow'

const redis      = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const guestLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'bv:guest' })
const authLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'bv:auth' })

export async function POST(request: Request) {
  // 1. Parse session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1'
  const identifier = user ? `user_${user.id}` : `ip_${ip}`
  const limiter    = user ? authLimit : guestLimit
  const { success } = await limiter.limit(identifier)
  if (!success) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  // 3. Parse body
  let body: { messages: Message[]; conversationId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { messages, conversationId } = body

  // 4. Sanitize last user message
  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'user') {
    return Response.json({ error: 'missing_user_message' }, { status: 400 })
  }
  const cleanContent = stripHtml(lastMsg.content).result.trim()
  if (cleanContent.length === 0) {
    return Response.json({ error: 'empty_message' }, { status: 400 })
  }
  if (cleanContent.length > 2000) {
    return Response.json({ error: 'too_long' }, { status: 400 })
  }

  // Sanitize ALL messages (not just the last), replace last with cleanContent, truncate to 40
  const sanitizedMessages: Message[] = [
    ...messages.slice(0, -1).map(m => ({
      role: m.role as Message['role'],
      content: stripHtml(m.content).result.trim() || m.content,
    })),
    { role: 'user' as const, content: cleanContent },
  ].slice(-40)

  // 5. Call RAGflow + relay SSE stream
  let ragflowStream: ReadableStream<Uint8Array>
  try {
    ragflowStream = await callRagflow(sanitizedMessages)
  } catch {
    return Response.json({ error: 'ragflow_unavailable' }, { status: 502 })
  }

  // 6. Accumulate full text while relaying to browser
  let fullText = ''

  // Verify conversation ownership via the anon client (which respects RLS)
  let verifiedConversationId: string | undefined = undefined
  if (user && conversationId) {
    const { data: ownership } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()
    if (ownership) verifiedConversationId = conversationId
  }

  // Resolve service client before streaming — createServiceClient is synchronous
  // (no-op cookies) and must not be called after the response has started streaming.
  const svc = verifiedConversationId ? createServiceClient() : null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = ragflowStream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Forward raw chunk to browser
          controller.enqueue(value)

          // Also accumulate decoded text for DB save
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const token = parseSseLine(line)
            if (token) fullText += token
          }
        }
      } finally {
        controller.close()
        reader.releaseLock()

        // 7. Save to DB if authenticated
        if (svc && user && verifiedConversationId && fullText) {
          const userMessage = sanitizedMessages[sanitizedMessages.length - 1]

          const { error: msgError } = await svc.from('messages').insert([
            { conversation_id: verifiedConversationId, role: 'user',      content: userMessage.content },
            { conversation_id: verifiedConversationId, role: 'assistant', content: fullText },
          ])
          if (msgError) console.error('[chat] Failed to save messages:', msgError)

          // Set title from first user message if not yet set
          const { data: conv } = await svc
            .from('conversations')
            .select('title')
            .eq('id', verifiedConversationId)
            .single()

          if (conv?.title === 'New conversation') {
            const { error: convError } = await svc
              .from('conversations')
              .update({ title: userMessage.content.slice(0, 50) })
              .eq('id', verifiedConversationId)
            if (convError) console.error('[chat] Failed to update conversation title:', convError)
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
