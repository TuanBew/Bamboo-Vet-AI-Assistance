import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; conversationId: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { conversationId } = await params
  const db = createServiceClient()

  try {
    const { data: messages, error } = await db
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const result = (messages ?? []).map(m => ({
      id: m.id as string,
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      created_at: m.created_at as string,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
