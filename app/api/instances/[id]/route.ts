import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('instances').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: instance } = await supabaseAdmin.from('instances').select('*').eq('id', id).single()
  if (!instance) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    await evolutionApi.deleteInstance(instance.evolution_instance_name).catch(console.error)
  } catch {}

  await supabaseAdmin.from('instances').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
