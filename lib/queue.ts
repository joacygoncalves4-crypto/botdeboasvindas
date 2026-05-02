import { supabaseAdmin } from './supabase'
import { evolutionApi } from './evolution'
import { Group, GroupInstance, DispatchQueue, FollowupTracking } from '@/types'

export async function processDispatchQueue() {
  const now = new Date().toISOString()

  // Get all active groups
  const { data: activeGroups } = await supabaseAdmin
    .from('groups')
    .select('*, group_instances(*, instance:instances(*))')
    .eq('is_active', true)

  if (!activeGroups?.length) return { processed: 0, followups: 0 }

  let processed = 0
  let followups = 0

  for (const group of activeGroups) {
    const instances: (GroupInstance & { instance: any })[] = group.group_instances ?? []
    const connectedInstances = instances
      .filter((gi) => gi.instance?.status === 'connected')
      .sort((a, b) => a.position - b.position)

    if (!connectedInstances.length) continue

    // Get pending items ready to be sent
    const { data: queueItems } = await supabaseAdmin
      .from('dispatch_queue')
      .select('*')
      .eq('group_id', group.id)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50)

    for (const item of queueItems ?? []) {
      const currentInstance = await getCurrentInstance(group.id, connectedInstances, group.batch_size)
      if (!currentInstance) break

      try {
        // Mark as processing
        await supabaseAdmin
          .from('dispatch_queue')
          .update({ status: 'processing', assigned_instance_id: currentInstance.instance_id })
          .eq('id', item.id)

        // Send welcome message
        await evolutionApi.sendText(
          currentInstance.instance.evolution_instance_name,
          item.participant_phone,
          group.welcome_message ?? 'Bem vindo!'
        )

        // Mark as sent
        await supabaseAdmin
          .from('dispatch_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), assigned_instance_id: currentInstance.instance_id })
          .eq('id', item.id)

        // Create followup tracking
        await supabaseAdmin.from('followup_tracking').insert({
          dispatch_id: item.id,
          group_id: group.id,
          participant_phone: item.participant_phone,
          instance_id: currentInstance.instance_id,
          first_message_sent_at: new Date().toISOString(),
          status: 'waiting_reply',
        })

        // Increment batch counter
        await incrementBatchCounter(group.id, currentInstance.instance_id, group.batch_size, connectedInstances)

        processed++
      } catch (err) {
        console.error('Error sending message to', item.participant_phone, err)
        await supabaseAdmin
          .from('dispatch_queue')
          .update({ status: 'failed' })
          .eq('id', item.id)
      }
    }

    // Process pending followups
    const { data: pendingFollowups } = await supabaseAdmin
      .from('followup_tracking')
      .select('*, instance:instances(*)')
      .eq('group_id', group.id)
      .eq('status', 'replied')
      .lte('followup_scheduled_at', now)
      .not('followup_scheduled_at', 'is', null)

    for (const ft of pendingFollowups ?? []) {
      if (!ft.instance || ft.instance.status !== 'connected') continue

      try {
        const hasMedia = group.followup_media_url && group.followup_media_type !== 'none'
        let message = group.followup_message ?? ''

        if (group.followup_links?.length) {
          message += '\n\n' + group.followup_links.join('\n')
        }

        if (hasMedia) {
          await evolutionApi.sendMedia(
            ft.instance.evolution_instance_name,
            ft.participant_phone,
            group.followup_media_url,
            group.followup_media_type,
            message
          )
        } else {
          await evolutionApi.sendText(ft.instance.evolution_instance_name, ft.participant_phone, message)
        }

        await supabaseAdmin
          .from('followup_tracking')
          .update({ status: 'followup_sent', followup_sent_at: new Date().toISOString() })
          .eq('id', ft.id)

        followups++
      } catch (err) {
        console.error('Error sending followup to', ft.participant_phone, err)
      }
    }
  }

  return { processed, followups }
}

async function getCurrentInstance(
  groupId: string,
  connectedInstances: (GroupInstance & { instance: any })[],
  batchSize: number
) {
  if (!connectedInstances.length) return null

  // Find the current active instance
  const current = connectedInstances.find((gi) => gi.is_current)
  if (!current) {
    // Set first as current
    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: true })
      .eq('id', connectedInstances[0].id)
    return connectedInstances[0]
  }

  return current
}

async function incrementBatchCounter(
  groupId: string,
  instanceId: string,
  batchSize: number,
  connectedInstances: (GroupInstance & { instance: any })[]
) {
  const current = connectedInstances.find((gi) => gi.instance_id === instanceId)
  if (!current) return

  const newCount = current.messages_sent_in_batch + 1

  if (newCount >= batchSize) {
    // Rotate to next instance
    const currentIndex = connectedInstances.findIndex((gi) => gi.instance_id === instanceId)
    const nextIndex = (currentIndex + 1) % connectedInstances.length
    const nextInstance = connectedInstances[nextIndex]

    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: false, messages_sent_in_batch: 0 })
      .eq('group_id', groupId)
      .eq('instance_id', instanceId)

    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: true, messages_sent_in_batch: 0 })
      .eq('group_id', groupId)
      .eq('instance_id', nextInstance.instance_id)
  } else {
    await supabaseAdmin
      .from('group_instances')
      .update({ messages_sent_in_batch: newCount })
      .eq('group_id', groupId)
      .eq('instance_id', instanceId)
  }
}

export async function addToQueue(groupId: string, participantPhone: string, delaySeconds: number, positionInQueue: number) {
  const scheduledAt = new Date(Date.now() + positionInQueue * delaySeconds * 1000)

  await supabaseAdmin.from('dispatch_queue').insert({
    group_id: groupId,
    participant_phone: participantPhone,
    status: 'pending',
    scheduled_at: scheduledAt.toISOString(),
  })
}

export async function cancelGroupQueue(groupId: string) {
  await supabaseAdmin
    .from('dispatch_queue')
    .update({ status: 'cancelled' })
    .eq('group_id', groupId)
    .eq('status', 'pending')
}

export async function handleIncomingMessage(instanceName: string, senderPhone: string) {
  // Find if this sender is waiting for a followup
  const { data: ft } = await supabaseAdmin
    .from('followup_tracking')
    .select('*, instance:instances(*)')
    .eq('participant_phone', senderPhone)
    .eq('status', 'waiting_reply')
    .limit(1)
    .maybeSingle()

  if (!ft) return

  // Make sure it's from the same instance
  if (ft.instance?.evolution_instance_name !== instanceName) return

  // Get group config for followup delay
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('followup_delay, is_active')
    .eq('id', ft.group_id)
    .single()

  if (!group?.is_active) return

  const followupScheduledAt = new Date(Date.now() + (group.followup_delay ?? 30) * 1000)

  await supabaseAdmin
    .from('followup_tracking')
    .update({
      status: 'replied',
      reply_received_at: new Date().toISOString(),
      followup_scheduled_at: followupScheduledAt.toISOString(),
    })
    .eq('id', ft.id)
}
