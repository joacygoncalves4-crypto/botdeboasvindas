import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'
import { getAppUrl } from '@/lib/app-url'

export async function POST(req: Request) {
  const appUrl = getAppUrl(req)

  // If we're on localhost, refuse — webhooks must point to a publicly reachable URL
  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    return NextResponse.json(
      {
        error:
          'Endpoint chamado de localhost. Webhooks precisam apontar pra producao. Acesse via dominio publico (Vercel) e tente de novo.',
        currentUrl: appUrl,
      },
      { status: 400 }
    )
  }

  const { data: instances } = await supabaseAdmin
    .from('instances')
    .select('id, name, evolution_instance_name')

  if (!instances?.length) {
    return NextResponse.json({ error: 'Nenhuma instancia no banco' }, { status: 404 })
  }

  const results = []
  for (const inst of instances) {
    const webhookUrl = `${appUrl}/api/webhook/${inst.evolution_instance_name}`
    try {
      await evolutionApi.setWebhook(inst.evolution_instance_name, webhookUrl)
      results.push({ name: inst.name, webhookUrl, success: true })
    } catch (err: any) {
      results.push({ name: inst.name, webhookUrl, success: false, error: err.message })
    }
  }

  const ok = results.filter((r) => r.success).length
  return NextResponse.json({
    appUrl,
    fixed: ok,
    failed: results.length - ok,
    results,
  })
}
