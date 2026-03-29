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

  // Stream timeout: 60 seconds max for the entire SSE relay
  const STREAM_TIMEOUT_MS = 60_000
  // Per-chunk read timeout: 15 seconds max waiting for next chunk
  const CHUNK_TIMEOUT_MS = 15_000

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = ragflowStream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let closed = false

      // Helper: safely close the controller exactly once
      const safeClose = () => {
        if (!closed) {
          closed = true
          try { controller.close() } catch { /* already closed */ }
        }
      }

      // Helper: safely enqueue — returns false if stream is already closed
      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (closed) return false
        try {
          controller.enqueue(chunk)
          return true
        } catch {
          // Client disconnected or stream closed
          closed = true
          return false
        }
      }

      // Global timeout for the entire stream
      const streamTimeout = setTimeout(() => {
        console.warn('[chat] Stream timeout reached (60s), cancelling reader')
        reader.cancel('stream_timeout').catch(() => {})
      }, STREAM_TIMEOUT_MS)

      // Listen for client disconnect via request abort signal
      const onAbort = () => {
        console.info('[chat] Client disconnected, cancelling reader')
        reader.cancel('client_disconnect').catch(() => {})
      }
      request.signal.addEventListener('abort', onAbort, { once: true })

      try {
        while (true) {
          // Per-chunk timeout: race reader.read() against a timeout
          const chunkTimeout = new Promise<{ done: true; value: undefined }>(
            (_, reject) => setTimeout(() => reject(new Error('chunk_timeout')), CHUNK_TIMEOUT_MS)
          )

          let done: boolean
          let value: Uint8Array | undefined
          try {
            const result = await Promise.race([reader.read(), chunkTimeout])
            done = result.done
            value = result.value
          } catch (err) {
            // Chunk timeout or read error — cancel reader and stop
            const reason = err instanceof Error ? err.message : 'read_error'
            console.warn(`[chat] Reader error: ${reason}, closing stream`)
            await reader.cancel(reason).catch(() => {})
            break
          }

          if (done) break

          // Check if client already disconnected
          if (request.signal.aborted) {
            await reader.cancel('client_disconnect').catch(() => {})
            break
          }

          // Forward raw chunk to browser
          if (value && !safeEnqueue(value)) {
            // Client gone — cancel upstream reader
            await reader.cancel('enqueue_failed').catch(() => {})
            break
          }

          // Also accumulate decoded text for DB save
          if (value) {
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const token = parseSseLine(line)
              if (token) fullText += token
            }
          }
        }
      } catch (err) {
        // Catch-all for unexpected errors in the streaming loop
        console.error('[chat] Unexpected streaming error:', err)
        await reader.cancel('unexpected_error').catch(() => {})
      } finally {
        clearTimeout(streamTimeout)
        request.signal.removeEventListener('abort', onAbort)

        // Always cancel + release the reader to prevent connection leaks
        await reader.cancel('cleanup').catch(() => {})
        reader.releaseLock()

        safeClose()

        // 7. Save to DB if authenticated (fire-and-forget, don't block cleanup)
        if (svc && user && verifiedConversationId && fullText) {
          const userMessage = sanitizedMessages[sanitizedMessages.length - 1]

          try {
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
          } catch (dbErr) {
            console.error('[chat] DB save error:', dbErr)
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
