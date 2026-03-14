'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'
import MessageBubble, { type ChatMessage } from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import MessageInput from './MessageInput'

interface Props {
  conversationId?: string        // undefined for guest chat
  initialMessages?: ChatMessage[]
}

export default function ChatInterface({ conversationId, initialMessages = [] }: Props) {
  const t = useT()
  const router = useRouter()
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, asstMsg])
    setStreaming(true)

    const history = [...messages, userMsg].slice(-40).map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, conversationId }),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: 'unknown' }))
        if (apiError === 'too_long')          setError(t('error.tooLong'))
        else if (apiError === 'rate_limited') setError(t('error.rateLimit'))
        else                                  setError(t('error.generic'))
        setMessages(prev => prev.slice(0, -1)) // remove empty assistant msg
        setStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let doneReceived = false
      let interrupted = false

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
            if (data === '[DONE]') { doneReceived = true; continue }
            try {
              const json = JSON.parse(data)
              const token = json?.choices?.[0]?.delta?.content
              if (token) {
                fullText += token
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = { ...next[next.length - 1], content: fullText }
                  return next
                })
              }
            } catch {}
          }
        }
      } catch {
        interrupted = true
      }

      // Mark interrupted if: exception thrown OR stream closed cleanly without [DONE]
      if ((interrupted || !doneReceived) && fullText) {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], interrupted: true }
          return next
        })
      }

      // If this was an authenticated conversation, refresh sidebar conversation list
      if (conversationId) {
        router.refresh()
      }
    } catch {
      setError(t('error.generic'))
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, messages, conversationId, t, router])

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-20 text-sm">
              {t('chat.emptyState')}
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              streamInterruptedLabel={t('error.streamInterrupted')}
            />
          ))}
          {streaming && messages[messages.length - 1]?.content === '' && (
            <TypingIndicator />
          )}
          {error && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
                <button
                  onClick={() => { setError(null); setInput(messages[messages.length - 2]?.content ?? '') }}
                  className="ml-1 underline cursor-pointer hover:no-underline"
                >
                  {t('error.retry')}
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={streaming}
        placeholder={t('chat.placeholder')}
      />
    </div>
  )
}
