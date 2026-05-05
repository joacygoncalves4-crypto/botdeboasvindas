import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

/**
 * Sincroniza phone_number e status de todas as instancias buscando da Evolution.
 * Util pra atualizar dados depois de conectar/reconectar.
 */
export async function POST() {
  try {
    const evolutionInstances = await evolutionApi.listInstances()

    const { data: dbInstances } = await supabaseAdmin
      .from('instances')
      .select('id, evolution_instance_name')

    if (!dbInstances?.length) {
      return NextResponse.json({ updated: 0, instances: [] })
    }

    const updates = []
    for (const dbInst of dbInstances) {
      const ev = evolutionInstances.find((e: any) => e.name === dbInst.evolution_instance_name)
      if (!ev) continue

      const ownerJid = (ev as any).ownerJid as string | undefined
      const phone = ownerJid ? ownerJid.replace('@s.whatsapp.net', '') : null
      const status =
        ev.connectionStatus === 'open' ? 'connected' :
        ev.connectionStatus === 'connecting' ? 'connecting' :
        'disconnected'

      const { data, error } = await supabaseAdmin
        .from('instances')
        .update({
          phone_number: phone,
          status: status,
        })
        .eq('id', dbInst.id)
        .select()
        .single()

      if (!error) {
        updates.push({ name: data.name, phone, status })
      }
    }

    return NextResponse.json({ updated: updates.length, instances: updates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
