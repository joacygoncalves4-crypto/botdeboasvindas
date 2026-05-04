import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { addToQueue, handleIncomingMessage } from '@/lib/queue'
import { WebhookPayload } from '@/types'

export async function POST(req: Request, { params }: { params: Promise<{ instanceName: string }> }) {
  const { instanceName } = await params

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, data } = payload

  // Log every webhook for debugging
  try {
    await supabaseAdmin.from('webhook_logs').insert({
      instance_name: instanceName,
      event: event,
      payload: payload as any,
    })
  } catch (e) {
    console.error('webhook log error:', e)
  }

  // Update instance status on connection events
  if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
    const state = (data as any)?.state ?? (data as any)?.status
    const mapped =
      state === 'open' ? 'connected' :
      state === 'connecting' ? 'connecting' :
      state === 'close' ? 'disconnected' :
      null

    if (mapped) {
      await supabaseAdmin
        .from('instances')
        .update({ status: mapped, qr_code: mapped === 'connected' ? null : undefined })
        .eq('evolution_instance_name', instanceName)

      // If all instances in a group disconnected, cancel their queues
      if (mapped === 'disconnected') {
        await checkAndCancelQueuesForDisconnectedGroups(instanceName)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // New participant joined a group
  if (event === 'group.participants.update' || event === 'GROUP_PARTICIPANTS_UPDATE') {
    const eventData = data as any
    const action = eventData?.action ?? eventData?.type
    const groupJid = eventData?.id ?? eventData?.groupJid

    if (action !== 'add') return NextResponse.json({ ok: true })

    // Check if group is active
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, is_active, delay_between_messages, welcome_message')
      .eq('group_jid', groupJid)
      .eq('is_active', true)
      .single()

    if (!group) return NextResponse.json({ ok: true })

    // Get participants who joined
    const participants: string[] = Array.isArray(eventData?.participants)
      ? eventData.participants
      : eventData?.participant
        ? [eventData.participant]
        : []

    if (!participants.length) return NextResponse.json({ ok: true })

    // Get current queue size to calculate delay offset
    const { count } = await supabaseAdmin
      .from('dispatch_queue')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('status', 'pending')

    const currentQueueSize = count ?? 0

    for (let i = 0; i < participants.length; i++) {
      const phone = participants[i].replace('@s.whatsapp.net', '').replace('@g.us', '')
      if (!phone) continue

      // Skip if already in queue for this group
      const { data: existing } = await supabaseAdmin
        .from('dispatch_queue')
        .select('id')
        .eq('group_id', group.id)
        .eq('participant_phone', phone)
        .eq('status', 'pending')
        .maybeSingle()

      if (existing) continue

      await addToQueue(group.id, phone, group.delay_between_messages, currentQueueSize + i)
    }

    return NextResponse.json({ ok: true })
  }

  // Incoming message (potential followup trigger)
  if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
    const messages = (data as any)?.messages ?? [(data as any)]

    for (const msg of messages) {
      // Only process messages received (not sent by us)
      if (msg?.key?.fromMe) continue
      // Only private messages (not groups)
      const remoteJid: string = msg?.key?.remoteJid ?? ''
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue

      const senderPhone = remoteJid.replace('@s.whatsapp.net', '')
      if (!senderPhone) continue

      await handleIncomingMessage(instanceName, senderPhone).catch(console.error)
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}

async function checkAndCancelQueuesForDisconnectedGroups(instanceName: string) {
  const { data: instance } = await supabaseAdmin
    .from('instances')
    .select('id')
    .eq('evolution_instance_name', instanceName)
    .single()

  if (!instance) return

  // Get all groups that use this instance
  const { data: groupInstances } = await supabaseAdmin
    .from('group_instances')
    .select('group_id')
    .eq('instance_id', instance.id)

  if (!groupInstances?.length) return

  for (const gi of groupInstances) {
    // Check if all instances for this group are disconnected
    const { data: allGI } = await supabaseAdmin
      .from('group_instances')
      .select('instance:instances(status)')
      .eq('group_id', gi.group_id)

    const anyConnected = allGI?.some((x: any) => x.instance?.status === 'connected')
    if (!anyConnected) {
      await supabaseAdmin
        .from('dispatch_queue')
        .update({ status: 'cancelled' })
        .eq('group_id', gi.group_id)
        .eq('status', 'pending')
    }
  }
}
