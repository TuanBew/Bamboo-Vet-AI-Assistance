import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyOwnership(userId: string, convId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('conversations')
    .select('id')
    .eq('id', convId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const svc = createServiceClient()
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    svc.from('conversations').select('*').eq('id', id).single(),
    svc.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  ])

  return Response.json({ conversation, messages })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const { title } = await request.json()
  if (!title || typeof title !== 'string') {
    return Response.json({ error: 'title required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('conversations')
    .update({ title: title.slice(0, 100) })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const svc = createServiceClient()
  // Messages cascade-deleted by FK constraint
  const { error } = await svc.from('conversations').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
