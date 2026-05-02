import { EvolutionGroup, EvolutionInstance, EvolutionParticipant } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const evolutionApi = {
  // Instances
  async listInstances(): Promise<EvolutionInstance[]> {
    const data = await request<EvolutionInstance[]>('/instance/fetchInstances')
    return Array.isArray(data) ? data : []
  },

  async createInstance(instanceName: string): Promise<{ instance: EvolutionInstance; qrcode?: { base64: string } }> {
    return request('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })
  },

  async connectInstance(instanceName: string): Promise<{ base64: string; code: string }> {
    return request(`/instance/connect/${instanceName}`)
  },

  async getInstanceStatus(instanceName: string): Promise<{ instance: { instanceName: string; state: string } }> {
    return request(`/instance/connectionState/${instanceName}`)
  },

  async deleteInstance(instanceName: string): Promise<void> {
    await request(`/instance/delete/${instanceName}`, { method: 'DELETE' })
  },

  async logoutInstance(instanceName: string): Promise<void> {
    await request(`/instance/logout/${instanceName}`, { method: 'DELETE' })
  },

  // Webhooks
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    await request(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: [
            'GROUP_PARTICIPANTS_UPDATE',
            'MESSAGES_UPSERT',
            'CONNECTION_UPDATE',
          ],
        },
      }),
    })
  },

  // Groups
  async getGroups(instanceName: string): Promise<EvolutionGroup[]> {
    const data = await request<EvolutionGroup[]>(`/group/fetchAllGroups/${instanceName}?getParticipants=false`)
    return Array.isArray(data) ? data : []
  },

  async getGroupParticipants(instanceName: string, groupJid: string): Promise<EvolutionParticipant[]> {
    const data = await request<{ participants: EvolutionParticipant[] }>(
      `/group/participants/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`
    )
    return data?.participants ?? []
  },

  // Messages
  async sendText(instanceName: string, to: string, text: string): Promise<{ key: { id: string } }> {
    return request(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: to, text }),
    })
  },

  async sendMedia(
    instanceName: string,
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'video',
    caption: string
  ): Promise<{ key: { id: string } }> {
    return request(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: to,
        mediatype: mediaType,
        media: mediaUrl,
        caption,
      }),
    })
  },
}
