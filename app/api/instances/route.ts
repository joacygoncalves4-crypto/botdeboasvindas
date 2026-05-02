import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('instances')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const evolutionInstanceName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  try {
    const result = await evolutionApi.createInstance(evolutionInstanceName)

    const { data, error } = await supabaseAdmin
      .from('instances')
      .insert({
        name,
        evolution_instance_name: evolutionInstanceName,
        status: 'connecting',
        qr_code: result.qrcode?.base64 ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Set webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/webhook/${evolutionInstanceName}`
    await evolutionApi.setWebhook(evolutionInstanceName, webhookUrl).catch(console.error)

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
