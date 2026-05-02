import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: instance } = await supabaseAdmin.from('instances').select('*').eq('id', id).single()
  if (!instance) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    const qr = await evolutionApi.connectInstance(instance.evolution_instance_name)

    await supabaseAdmin
      .from('instances')
      .update({ qr_code: qr.base64, status: 'qr_code' })
      .eq('id', id)

    return NextResponse.json({ qr_code: qr.base64, code: qr.code })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
