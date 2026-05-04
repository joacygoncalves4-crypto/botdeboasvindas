import { supabaseAdmin } from './supabase'
import { evolutionApi } from './evolution'

type GroupInstanceWithInstance = {
  id: string
  group_id: string
  instance_id: string
  position: number
  messages_sent_in_batch: number
  is_current: boolean
  instance: {
    id: string
    evolution_instance_name: string
    status: string
    name: string
  }
}

export async function processDispatchQueue() {
  const now = new Date().toISOString()

  // Get all active groups
  const { data: activeGroups } = await supabaseAdmin
    .from('groups')
    .select('*')
    .eq('is_active', true)

  if (!activeGroups?.length) return { processed: 0, followups: 0, failed: 0 }

  let processed = 0
  let followups = 0
  let failed = 0

  for (const group of activeGroups) {
    const instances = await fetchConnectedInstances(group.id)
    if (!instances.length) continue

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
      // Re-fetch fresh state from DB on each iteration to keep counters accurate
      const freshInstances = await fetchConnectedInstances(group.id)
      if (!freshInstances.length) break

      const currentInstance = await pickCurrentInstance(group.id, freshInstances)
      if (!currentInstance) break

      try {
        await supabaseAdmin
          .from('dispatch_queue')
          .update({ status: 'processing', assigned_instance_id: currentInstance.instance_id })
          .eq('id', item.id)

        await evolutionApi.sendText(
          currentInstance.instance.evolution_instance_name,
          item.participant_phone,
          group.welcome_message ?? 'Bem vindo!'
        )

        await supabaseAdmin
          .from('dispatch_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            assigned_instance_id: currentInstance.instance_id,
          })
          .eq('id', item.id)

        await supabaseAdmin.from('followup_tracking').insert({
          dispatch_id: item.id,
          group_id: group.id,
          participant_phone: item.participant_phone,
          instance_id: currentInstance.instance_id,
          first_message_sent_at: new Date().toISOString(),
          status: 'waiting_reply',
        })

        processed++
      } catch (err) {
        console.error('Error sending message to', item.participant_phone, err)
        await supabaseAdmin
          .from('dispatch_queue')
          .update({ status: 'failed', assigned_instance_id: currentInstance.instance_id })
          .eq('id', item.id)
        failed++
      }

      // Always advance batch counter (success or failure) to keep rotation moving
      await advanceBatchCounter(group.id, currentInstance, group.batch_size, freshInstances)
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
      } catch (err: any) {
        console.error('Error sending followup to', ft.participant_phone, err)
        // Mark as ignored to avoid retry loop on permanent errors (e.g. number doesn't exist)
        await supabaseAdmin
          .from('followup_tracking')
          .update({ status: 'ignored' })
          .eq('id', ft.id)
      }
    }
  }

  return { processed, followups, failed }
}

async function fetchConnectedInstances(groupId: string): Promise<GroupInstanceWithInstance[]> {
  const { data } = await supabaseAdmin
    .from('group_instances')
    .select('*, instance:instances(*)')
    .eq('group_id', groupId)
    .order('position', { ascending: true })

  return (data ?? []).filter((gi: any) => gi.instance?.status === 'connected') as GroupInstanceWithInstance[]
}

async function pickCurrentInstance(
  groupId: string,
  connectedInstances: GroupInstanceWithInstance[]
): Promise<GroupInstanceWithInstance | null> {
  if (!connectedInstances.length) return null

  let current = connectedInstances.find((gi) => gi.is_current)

  // If current is not connected anymore or doesn't exist, fall back to first connected
  if (!current) {
    current = connectedInstances[0]
    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: false })
      .eq('group_id', groupId)
    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: true })
      .eq('id', current.id)
  }

  return current
}

async function advanceBatchCounter(
  groupId: string,
  current: GroupInstanceWithInstance,
  batchSize: number,
  connectedInstances: GroupInstanceWithInstance[]
) {
  const newCount = current.messages_sent_in_batch + 1

  if (newCount >= batchSize) {
    // Rotate to next connected instance
    const currentIndex = connectedInstances.findIndex((gi) => gi.id === current.id)
    const nextIndex = (currentIndex + 1) % connectedInstances.length
    const next = connectedInstances[nextIndex]

    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: false, messages_sent_in_batch: 0 })
      .eq('id', current.id)

    await supabaseAdmin
      .from('group_instances')
      .update({ is_current: true, messages_sent_in_batch: 0 })
      .eq('id', next.id)
  } else {
    await supabaseAdmin
      .from('group_instances')
      .update({ messages_sent_in_batch: newCount })
      .eq('id', current.id)
  }
}

/**
 * Adds a participant to the dispatch queue.
 * Returns true if added, false if duplicate (already in queue for this group).
 *
 * The unique partial index `idx_dispatch_queue_active_dedupe` on
 * (group_id, participant_phone) where status IN (pending, processing)
 * is the ultimate guard against race conditions when multiple bot
 * instances forward the same join event.
 */
export async function addToQueue(
  groupId: string,
  participantPhone: string,
  delaySeconds: number,
  positionInQueue: number
): Promise<boolean> {
  const scheduledAt = new Date(Date.now() + positionInQueue * delaySeconds * 1000)

  const { error } = await supabaseAdmin.from('dispatch_queue').insert({
    group_id: groupId,
    participant_phone: participantPhone,
    status: 'pending',
    scheduled_at: scheduledAt.toISOString(),
  })

  if (error) {
    // 23505 = unique_violation — this is the dedupe constraint catching a
    // race condition (multiple instances firing webhook simultaneously).
    // Silent skip is the desired behavior.
    if (error.code === '23505') return false
    throw error
  }
  return true
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

  // Make sure it's from the same instance that sent the welcome
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
