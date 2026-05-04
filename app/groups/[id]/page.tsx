'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, Upload, X,
  MessageSquare, Clock, Layers, Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { GroupWithInstances, Instance } from '@/types'

export default function GroupConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [group, setGroup] = useState<GroupWithInstances | null>(null)
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // Form state
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [followupMessage, setFollowupMessage] = useState('')
  const [followupMediaUrl, setFollowupMediaUrl] = useState('')
  const [followupMediaType, setFollowupMediaType] = useState<'image' | 'video' | 'none'>('none')
  const [delayBetween, setDelayBetween] = useState(10)
  const [followupDelay, setFollowupDelay] = useState(60)
  const [batchSize, setBatchSize] = useState(5)
  const [selectedInstances, setSelectedInstances] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${id}`).then((r) => r.json()),
      fetch('/api/instances').then((r) => r.json()),
    ]).then(([groupData, instancesData]) => {
      setGroup(groupData)
      setInstances(Array.isArray(instancesData) ? instancesData : [])

      // Pre-fill form
      setWelcomeMessage(groupData.welcome_message ?? '')
      setFollowupMessage(groupData.followup_message ?? '')
      setFollowupMediaUrl(groupData.followup_media_url ?? '')
      setFollowupMediaType(groupData.followup_media_type ?? 'none')
      setDelayBetween(groupData.delay_between_messages ?? 10)
      setFollowupDelay(groupData.followup_delay ?? 60)
      setBatchSize(groupData.batch_size ?? 5)
      setSelectedInstances(
        (groupData.group_instances ?? [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((gi: any) => gi.instance_id)
      )
      setLoading(false)
    })
  }, [id])

  async function handleSave() {
    setSaving(true)
    setSavedAt(null)

    try {
      const [groupRes, instancesRes] = await Promise.all([
        fetch(`/api/groups/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            welcome_message: welcomeMessage,
            followup_message: followupMessage,
            followup_media_url: followupMediaUrl || null,
            followup_media_type: followupMediaType,
            followup_links: [],
            delay_between_messages: delayBetween,
            followup_delay: followupDelay,
            batch_size: batchSize,
          }),
        }),
        fetch(`/api/groups/${id}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceIds: selectedInstances }),
        }),
      ])

      if (!groupRes.ok) {
        const err = await groupRes.json()
        alert('Erro ao salvar grupo: ' + (err.error ?? 'desconhecido'))
        return
      }
      if (!instancesRes.ok) {
        const err = await instancesRes.json()
        alert('Erro ao salvar instancias: ' + (err.error ?? 'desconhecido'))
        return
      }

      const updated = await groupRes.json()
      setGroup((prev) => prev ? { ...prev, ...updated } : prev)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    } catch (e: any) {
      alert('Erro de conexao: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMedia(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.url) {
      setFollowupMediaUrl(data.url)
      const isVideo = file.type.startsWith('video/')
      setFollowupMediaType(isVideo ? 'video' : 'image')
    } else {
      alert(data.error ?? 'Erro ao fazer upload')
    }
    setUploadingMedia(false)
  }

  function toggleInstance(instId: string) {
    setSelectedInstances((prev) => {
      if (prev.includes(instId)) return prev.filter((id) => id !== instId)
      if (prev.length >= 5) { alert('Maximo de 5 instancias por grupo'); return prev }
      return [...prev, instId]
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!group) return <div className="p-8 text-zinc-400">Grupo nao encontrado</div>

  const connectedInstances = instances.filter((i) => i.status === 'connected')

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{group.name}</h1>
          <p className="text-zinc-400 text-sm">{group.participant_count} membros</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {savedAt && (
            <span className="text-sm text-green-400 flex items-center gap-1">
              ✓ Salvo!
            </span>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Instancias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="w-4 h-4 text-green-500" />
              Instancias do Grupo
            </CardTitle>
            <CardDescription>Selecione ate 5 instancias. Todas devem estar no grupo.</CardDescription>
          </CardHeader>
          <CardContent>
            {connectedInstances.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nenhuma instancia conectada. Va em Instancias e conecte primeiro.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {connectedInstances.map((inst) => {
                  const selected = selectedInstances.includes(inst.id)
                  const position = selectedInstances.indexOf(inst.id) + 1
                  return (
                    <button
                      key={inst.id}
                      onClick={() => toggleInstance(inst.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        selected
                          ? 'border-green-600/50 bg-green-600/10 text-zinc-100'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0 font-bold">
                          {position}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inst.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{inst.evolution_instance_name}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {selectedInstances.length > 0 && (
              <p className="text-xs text-zinc-500 mt-3">
                Rotacao: {selectedInstances.length} instancia(s), {batchSize} msgs cada antes de rotacionar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Delays e batch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-green-500" />
              Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Delay entre msgs (seg)</Label>
              <Input
                type="number"
                min={1}
                value={delayBetween}
                onChange={(e) => setDelayBetween(Number(e.target.value))}
              />
              <p className="text-xs text-zinc-500">Espera entre cada disparo</p>
            </div>
            <div className="space-y-2">
              <Label>Batch size</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
              />
              <p className="text-xs text-zinc-500">Msgs por instancia antes de rotar</p>
            </div>
            <div className="space-y-2">
              <Label>Delay follow-up (seg)</Label>
              <Input
                type="number"
                min={1}
                value={followupDelay}
                onChange={(e) => setFollowupDelay(Number(e.target.value))}
              />
              <p className="text-xs text-zinc-500">Espera apos resposta</p>
            </div>
          </CardContent>
        </Card>

        {/* Mensagem de boas vindas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-green-500" />
              Mensagem de Boas Vindas
            </CardTitle>
            <CardDescription>Enviada quando novo membro entra no grupo</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Digite a mensagem de boas vindas..."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Follow-up */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Mensagem de Follow-up
            </CardTitle>
            <CardDescription>Enviada quando o lead responder a primeira mensagem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Midia */}
            <div className="space-y-2">
              <Label>Midia (imagem ou video)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="URL da midia ou faça upload"
                  value={followupMediaUrl}
                  onChange={(e) => setFollowupMediaUrl(e.target.value)}
                  className="flex-1"
                />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                  <Button variant="outline" size="sm" asChild disabled={uploadingMedia}>
                    <span>
                      {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
              {followupMediaUrl && (
                <div className="flex items-center gap-2">
                  <Select value={followupMediaType} onValueChange={(v) => setFollowupMediaType(v as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="none">Sem midia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500"
                    onClick={() => { setFollowupMediaUrl(''); setFollowupMediaType('none') }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Texto */}
            <div className="space-y-2">
              <Label>Texto / Legenda</Label>
              <Textarea
                placeholder="Texto que aparece junto com a midia (ou sozinho se sem midia)..."
                value={followupMessage}
                onChange={(e) => setFollowupMessage(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-zinc-500">
                Coloque links direto no texto (ex: https://exemplo.com)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
