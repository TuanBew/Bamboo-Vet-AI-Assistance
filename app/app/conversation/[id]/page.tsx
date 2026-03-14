import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat/ChatInterface'
import type { ChatMessage } from '@/components/chat/MessageBubble'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const svc = createServiceClient()

  // Verify ownership
  const { data: conv } = await svc
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) notFound()

  const { data: messages } = await svc
    .from('messages')
    .select('id, role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const initialMessages: ChatMessage[] = (messages ?? []).map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return (
    <ChatInterface
      conversationId={id}
      initialMessages={initialMessages}
    />
  )
}
