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

  // Normalize event name: lowercase, replace . and - with single separator
  const normalizedEvent = String(event ?? '').toLowerCase().replace(/[._-]/g, '.')

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
  if (normalizedEvent === 'connection.update') {
    const state = (data as any)?.state ?? (data as any)?.status
    const mapped =
      state === 'open' ? 'connected' :
      state === 'connecting' ? 'connecting' :
      state === 'close' ? 'disconnected' :
      null

    if (mapped) {
      const update: Record<string, unknown> = { status: mapped }
      if (mapped === 'connected') {
        update.qr_code = null
        // Record connection time so we can ignore false-positive group joins
        // that fire when WhatsApp Web syncs after a fresh login.
        update.connected_at = new Date().toISOString()
      }

      await supabaseAdmin
        .from('instances')
        .update(update)
        .eq('evolution_instance_name', instanceName)

      // If all instances in a group disconnected, cancel their queues
      if (mapped === 'disconnected') {
        await checkAndCancelQueuesForDisconnectedGroups(instanceName)
      }
    }
    return NextResponse.json({ ok: true })
  }

  // New participant joined a group
  // Evolution v2 sends as 'group-participants.update' (with dash). Older as 'group.participants.update'
  if (normalizedEvent === 'group.participants.update') {
    const eventData = data as any
    const action = eventData?.action ?? eventData?.type
    const groupJid = eventData?.id ?? eventData?.groupJid

    if (action !== 'add') return NextResponse.json({ ok: true })

    // Reconnection guard: when a fresh login happens (e.g. user scans new QR
    // or replaces the bot phone), WhatsApp Web syncs all groups and Evolution
    // forwards a flood of `add` events for users who were ALREADY in the group.
    // Ignore for the first 120s after the instance came online.
    const { data: instance } = await supabaseAdmin
      .from('instances')
      .select('connected_at')
      .eq('evolution_instance_name', instanceName)
      .maybeSingle()

    if (instance?.connected_at) {
      const ageMs = Date.now() - new Date(instance.connected_at).getTime()
      if (ageMs < 120_000) {
        return NextResponse.json({
          ok: true,
          ignored: 'instance reconnected recently — likely sync flood',
        })
      }
    }

    // Check if group is active
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, is_active, delay_between_messages, welcome_message')
      .eq('group_jid', groupJid)
      .eq('is_active', true)
      .single()

    if (!group) return NextResponse.json({ ok: true })

    // Extract phone numbers — Evolution v2 sends participants as objects with phoneNumber field
    // Older format may send array of strings.
    const rawParticipants: any[] = Array.isArray(eventData?.participants)
      ? eventData.participants
      : eventData?.participant
        ? [eventData.participant]
        : []

    const phones: string[] = rawParticipants
      .map((p) => extractPhone(p))
      .filter((p): p is string => !!p)

    if (!phones.length) return NextResponse.json({ ok: true })

    // Get current queue size to calculate delay offset
    const { count } = await supabaseAdmin
      .from('dispatch_queue')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('status', 'pending')

    const currentQueueSize = count ?? 0

    // Dedupe window: 24h. Avoid sending welcome twice when multiple bot
    // instances are in the same group (each one fires its own webhook).
    const dedupeSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    let added = 0
    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i]

      // Skip if any entry (pending/processing/sent/failed) exists for this
      // phone+group within the last 24h. We dedupe even on failed because
      // we don't want to retry just because another instance fired late.
      const { data: existing } = await supabaseAdmin
        .from('dispatch_queue')
        .select('id, status')
        .eq('group_id', group.id)
        .eq('participant_phone', phone)
        .in('status', ['pending', 'processing', 'sent', 'failed'])
        .gte('created_at', dedupeSince)
        .limit(1)
        .maybeSingle()

      if (existing) continue

      await addToQueue(group.id, phone, group.delay_between_messages, currentQueueSize + added)
      added++
    }

    return NextResponse.json({ ok: true, received: phones.length, queued: added })
  }

  // Incoming message (potential followup trigger)
  if (normalizedEvent === 'messages.upsert') {
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

/**
 * Extracts a clean phone number from Evolution participant data.
 * Evolution v2 sends participants as objects: { id: "...@lid", phoneNumber: "5511999999999@s.whatsapp.net" }
 * Older format sends array of strings: "5511999999999@s.whatsapp.net"
 * @lid IDs are anonymized identities - we need the real phone number, never the @lid
 */
function extractPhone(p: any): string | null {
  if (!p) return null

  // String format (older Evolution)
  if (typeof p === 'string') {
    const cleaned = p.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '')
    // @lid IDs are NOT phone numbers, skip them
    if (p.includes('@lid')) return null
    return cleaned || null
  }

  // Object format (Evolution v2)
  // Try phoneNumber first (real number), fall back to id only if it's not a @lid
  const phoneStr =
    typeof p.phoneNumber === 'string' ? p.phoneNumber :
    typeof p.id === 'string' && !p.id.includes('@lid') ? p.id :
    null

  if (!phoneStr) return null

  return phoneStr.replace('@s.whatsapp.net', '').replace('@g.us', '') || null
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
