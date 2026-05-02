export type InstanceStatus = 'connected' | 'disconnected' | 'connecting' | 'qr_code'

export interface Instance {
  id: string
  name: string
  evolution_instance_name: string
  status: InstanceStatus
  qr_code: string | null
  phone_number: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  group_jid: string
  name: string
  description: string | null
  participant_count: number
  is_active: boolean
  welcome_message: string | null
  followup_message: string | null
  followup_media_url: string | null
  followup_media_type: 'image' | 'video' | 'none'
  followup_links: string[]
  delay_between_messages: number
  followup_delay: number
  batch_size: number
  created_at: string
  updated_at: string
}

export interface GroupInstance {
  id: string
  group_id: string
  instance_id: string
  position: number
  messages_sent_in_batch: number
  is_current: boolean
  instance?: Instance
}

export type QueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'

export interface DispatchQueue {
  id: string
  group_id: string
  participant_phone: string
  assigned_instance_id: string | null
  status: QueueStatus
  scheduled_at: string
  sent_at: string | null
  created_at: string
}

export type FollowupStatus = 'waiting_reply' | 'replied' | 'followup_sent' | 'ignored'

export interface FollowupTracking {
  id: string
  dispatch_id: string
  group_id: string
  participant_phone: string
  instance_id: string
  first_message_sent_at: string
  reply_received_at: string | null
  followup_scheduled_at: string | null
  followup_sent_at: string | null
  status: FollowupStatus
}

export interface GroupWithInstances extends Group {
  group_instances: (GroupInstance & { instance: Instance })[]
  pending_count?: number
  sent_today?: number
}

// Evolution API types
export interface EvolutionInstance {
  id: string
  name: string
  connectionStatus: string
  ownerJid?: string
  profileName?: string
  profilePicUrl?: string
  integration?: string
  token?: string
}

export interface EvolutionGroup {
  id: string
  subject: string
  subjectOwner?: string
  desc?: string
  size: number
  participants?: EvolutionParticipant[]
}

export interface EvolutionParticipant {
  id: string
  admin?: string | null
}

export interface WebhookPayload {
  event: string
  instance: string
  data: Record<string, unknown>
  date_time: string
  sender?: string
  server_url: string
  apikey: string
}
