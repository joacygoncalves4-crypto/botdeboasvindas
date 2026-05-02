import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('group_instances')
    .select('*, instance:instances(*)')
    .eq('group_id', id)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Set instances for a group (replaces all)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { instanceIds } = await req.json() as { instanceIds: string[] }

  if (!Array.isArray(instanceIds) || instanceIds.length > 5) {
    return NextResponse.json({ error: 'Provide 1-5 instance IDs' }, { status: 400 })
  }

  // Delete existing
  await supabaseAdmin.from('group_instances').delete().eq('group_id', id)

  if (!instanceIds.length) return NextResponse.json([])

  // Insert new
  const rows = instanceIds.map((instanceId, i) => ({
    group_id: id,
    instance_id: instanceId,
    position: i + 1,
    messages_sent_in_batch: 0,
    is_current: i === 0,
  }))

  const { data, error } = await supabaseAdmin
    .from('group_instances')
    .insert(rows)
    .select('*, instance:instances(*)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
