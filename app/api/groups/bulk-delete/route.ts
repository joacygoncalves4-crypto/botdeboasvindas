import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const NULL_ID = '00000000-0000-0000-0000-000000000000'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { ids, all } = body as { ids?: string[]; all?: boolean }

  if (all === true) {
    // Delete EVERYTHING from groups (cleanup related first)
    await supabaseAdmin.from('followup_tracking').delete().neq('id', NULL_ID)
    await supabaseAdmin.from('dispatch_queue').delete().neq('id', NULL_ID)
    await supabaseAdmin.from('group_instances').delete().neq('id', NULL_ID)
    const { error, count } = await supabaseAdmin
      .from('groups')
      .delete({ count: 'exact' })
      .neq('id', NULL_ID)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: count ?? 0 })
  }

  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: 'ids[] required (or all:true)' }, { status: 400 })
  }

  await supabaseAdmin.from('followup_tracking').delete().in('group_id', ids)
  await supabaseAdmin.from('dispatch_queue').delete().in('group_id', ids)
  await supabaseAdmin.from('group_instances').delete().in('group_id', ids)
  const { error, count } = await supabaseAdmin
    .from('groups')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count ?? 0 })
}
