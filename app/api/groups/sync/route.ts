import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { evolutionApi } from '@/lib/evolution'

export async function POST() {
  // Get all connected instances
  const { data: instances } = await supabaseAdmin
    .from('instances')
    .select('*')
    .eq('status', 'connected')

  if (!instances?.length) {
    return NextResponse.json({ error: 'No connected instances' }, { status: 400 })
  }

  const seen = new Set<string>()
  let synced = 0

  for (const instance of instances) {
    try {
      const groups = await evolutionApi.getGroups(instance.evolution_instance_name)

      for (const group of groups) {
        if (seen.has(group.id)) continue
        seen.add(group.id)

        await supabaseAdmin
          .from('groups')
          .upsert({
            group_jid: group.id,
            name: group.subject,
            description: group.desc ?? null,
            participant_count: group.size ?? 0,
          }, { onConflict: 'group_jid', ignoreDuplicates: false })

        synced++
      }
    } catch (err) {
      console.error(`Error syncing groups from ${instance.evolution_instance_name}:`, err)
    }
  }

  return NextResponse.json({ synced })
}
