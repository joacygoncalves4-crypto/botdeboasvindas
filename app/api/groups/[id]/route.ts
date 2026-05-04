import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select(`*, group_instances(*, instance:instances(*))`)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const allowedFields = [
    'welcome_message',
    'followup_message',
    'followup_media_url',
    'followup_media_type',
    'followup_links',
    'delay_between_messages',
    'followup_delay',
    'batch_size',
  ]

  const update: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) update[field] = body[field]
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Cleanup related data first (FKs cascade should handle this, but explicit for safety)
  await supabaseAdmin.from('followup_tracking').delete().eq('group_id', id)
  await supabaseAdmin.from('dispatch_queue').delete().eq('group_id', id)
  await supabaseAdmin.from('group_instances').delete().eq('group_id', id)

  const { error } = await supabaseAdmin.from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
