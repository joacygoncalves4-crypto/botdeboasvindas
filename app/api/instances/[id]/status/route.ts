import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: instance } = await supabaseAdmin.from('instances').select('*').eq('id', id).single()
  if (!instance) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    const statusData = await evolutionApi.getInstanceStatus(instance.evolution_instance_name)
    const state = statusData?.instance?.state

    const mappedStatus =
      state === 'open' ? 'connected' :
      state === 'connecting' ? 'connecting' :
      'disconnected'

    await supabaseAdmin
      .from('instances')
      .update({ status: mappedStatus })
      .eq('id', id)

    return NextResponse.json({ status: mappedStatus })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
