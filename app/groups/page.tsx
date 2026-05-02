'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, Settings, Power, PowerOff, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { GroupWithInstances } from '@/types'

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithInstances[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/groups')
    const data = await res.json()
    setGroups(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    const res = await fetch('/api/groups/sync', { method: 'POST' })
    const data = await res.json()
    if (data.synced !== undefined) {
      await load()
    } else {
      alert(data.error ?? 'Erro ao sincronizar grupos')
    }
    setSyncing(false)
  }

  async function handleToggle(groupId: string) {
    setToggling(groupId)
    const res = await fetch(`/api/groups/${groupId}/toggle`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, is_active: data.is_active } : g))
    }
    setToggling(null)
  }

  const connectedInstances = (group: GroupWithInstances) =>
    group.group_instances?.filter((gi) => gi.instance?.status === 'connected').length ?? 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Grupos</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie os grupos monitorados</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Grupos
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Users className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">Nenhum grupo encontrado</p>
            <p className="text-sm mt-1">Clique em "Sincronizar Grupos" para buscar seus grupos</p>
            <Button className="mt-4" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar agora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const connected = connectedInstances(group)
            const total = group.group_instances?.length ?? 0
            const isReady = group.welcome_message && total > 0

            return (
              <Card key={group.id} className={group.is_active ? 'border-green-600/30' : ''}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-zinc-100 truncate">{group.name}</h3>
                      {!isReady && (
                        <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                          Configurar
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.participant_count} membros
                      </span>
                      <span>
                        {connected}/{total} instancias conectadas
                      </span>
                      {group.batch_size && (
                        <span>Batch: {group.batch_size} msgs</span>
                      )}
                      {group.delay_between_messages && (
                        <span>Delay: {group.delay_between_messages}s</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {toggling === group.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                      ) : (
                        <Switch
                          checked={group.is_active}
                          onCheckedChange={() => handleToggle(group.id)}
                          disabled={!isReady}
                        />
                      )}
                      <span className={`text-xs ${group.is_active ? 'text-green-400' : 'text-zinc-500'}`}>
                        {group.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <Link href={`/groups/${group.id}`}>
                      <Button variant="outline" size="sm">
                        <Settings className="w-3 h-3" />
                        Config
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
