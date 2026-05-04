import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'
import { getAppUrl } from '@/lib/app-url'

// GET: list connected instances from Evolution (not yet imported)
export async function GET() {
  try {
    const allInstances = await evolutionApi.listInstances()
    const connected = allInstances.filter((i) => i.connectionStatus === 'open')

    // Get already imported instances
    const { data: existing } = await supabaseAdmin
      .from('instances')
      .select('evolution_instance_name')

    const existingNames = new Set(existing?.map((i) => i.evolution_instance_name) ?? [])
    const notImported = connected.filter((i) => !existingNames.has(i.name))

    return NextResponse.json(notImported)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: import selected instances
export async function POST(req: Request) {
  const { instanceNames } = await req.json() as { instanceNames: string[] }
  if (!instanceNames?.length) return NextResponse.json({ error: 'instanceNames required' }, { status: 400 })

  const results = []
  const appUrl = getAppUrl(req)

  for (const instanceName of instanceNames) {
    try {
      const { data } = await supabaseAdmin
        .from('instances')
        .upsert({
          name: instanceName,
          evolution_instance_name: instanceName,
          status: 'connected',
        }, { onConflict: 'evolution_instance_name' })
        .select()
        .single()

      // Set webhook
      const webhookUrl = `${appUrl}/api/webhook/${instanceName}`
      await evolutionApi.setWebhook(instanceName, webhookUrl).catch(console.error)

      results.push({ instanceName, success: true, data })
    } catch (err: any) {
      results.push({ instanceName, success: false, error: err.message })
    }
  }

  return NextResponse.json(results)
}
