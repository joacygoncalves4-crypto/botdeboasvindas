import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { cancelGroupQueue } from '@/lib/queue'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: group } = await supabaseAdmin.from('groups').select('is_active').eq('id', id).single()
  if (!group) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const newActive = !group.is_active

  // If deactivating, cancel all pending queue items
  if (!newActive) {
    await cancelGroupQueue(id)
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .update({ is_active: newActive })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
