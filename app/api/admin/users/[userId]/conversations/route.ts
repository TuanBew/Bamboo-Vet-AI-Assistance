import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId } = await params
  const db = createServiceClient()

  try {
    // Get conversations for this user
    const { data: conversations, error } = await db
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Get message counts for each conversation
    const convIds = (conversations ?? []).map(c => c.id as string)
    let countMap = new Map<string, number>()

    if (convIds.length > 0) {
      const { data: messageCounts } = await db
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)

      for (const m of messageCounts ?? []) {
        const cid = m.conversation_id as string
        countMap.set(cid, (countMap.get(cid) ?? 0) + 1)
      }
    }

    const result = (conversations ?? []).map(c => ({
      id: c.id as string,
      title: c.title as string,
      created_at: c.created_at as string,
      message_count: countMap.get(c.id as string) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('User conversations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
