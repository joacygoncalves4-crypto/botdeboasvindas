'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { RefreshCw, Settings, Loader2, Users, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GroupWithInstances } from '@/types'

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithInstances[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)

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

  async function handleDelete(groupId: string) {
    if (!confirm('Apagar esse grupo? Essa acao nao pode ser desfeita.')) return
    const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      setSelected((prev) => { const n = new Set(prev); n.delete(groupId); return n })
    }
  }

  async function handleDeleteSelected() {
    if (!selected.size) return
    if (!confirm(`Apagar ${selected.size} grupo(s) selecionado(s)?`)) return
    setDeleting(true)
    const res = await fetch('/api/groups/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    const data = await res.json()
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => !selected.has(g.id)))
      setSelected(new Set())
      alert(`${data.deleted} grupo(s) apagado(s)`)
    } else {
      alert(data.error)
    }
    setDeleting(false)
  }

  async function handleDeleteAll() {
    setDeleting(true)
    const res = await fetch('/api/groups/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    const data = await res.json()
    if (res.ok) {
      setGroups([])
      setSelected(new Set())
      setShowDeleteAll(false)
      alert(`${data.deleted} grupo(s) apagado(s)`)
    } else {
      alert(data.error)
    }
    setDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups.filter((g) => g.name?.toLowerCase().includes(q) || g.group_jid?.toLowerCase().includes(q))
  }, [groups, search])

  function selectAllVisible() {
    setSelected(new Set(filtered.map((g) => g.id)))
  }

  const connectedInstances = (group: GroupWithInstances) =>
    group.group_instances?.filter((gi) => gi.instance?.status === 'connected').length ?? 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Grupos</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {groups.length} grupo(s) {search && `• ${filtered.length} no filtro`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar
          </Button>
          {groups.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteAll(true)}>
              <Trash2 className="w-4 h-4" />
              Apagar todos
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Buscar grupo por nome..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-300">{selected.size} selecionado(s)</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar
          </Button>
          <Button size="sm" variant="ghost" onClick={selectAllVisible}>
            Selecionar todos visiveis
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Apagar selecionados
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Users className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">Nenhum grupo encontrado</p>
            <p className="text-sm mt-1">Clique em &quot;Sincronizar&quot; para buscar seus grupos</p>
            <Button className="mt-4" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar agora
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-sm">Nenhum grupo encontrado para &quot;{search}&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => {
            const connected = connectedInstances(group)
            const total = group.group_instances?.length ?? 0
            const isReady = group.welcome_message && total > 0
            const isSelected = selected.has(group.id)

            return (
              <Card
                key={group.id}
                className={`${group.is_active ? 'border-green-600/30' : ''} ${isSelected ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(group.id)}
                    className="accent-blue-500 w-4 h-4 cursor-pointer"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-zinc-100 truncate">{group.name}</h3>
                      {!isReady && (
                        <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                          Configurar
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {group.participant_count}
                      </span>
                      <span>{connected}/{total} conectadas</span>
                      {group.batch_size > 0 && <span>Batch: {group.batch_size}</span>}
                      {group.delay_between_messages > 0 && <span>Delay: {group.delay_between_messages}s</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                      <span className={`text-xs w-12 ${group.is_active ? 'text-green-400' : 'text-zinc-500'}`}>
                        {group.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <Link href={`/groups/${group.id}`}>
                      <Button variant="outline" size="sm">
                        <Settings className="w-3 h-3" />
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete all dialog */}
      <Dialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar TODOS os grupos?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-300">
              Isso vai apagar <span className="font-bold text-red-400">{groups.length} grupo(s)</span> e
              toda a fila/follow-up de cada um.
            </p>
            <p className="text-sm text-zinc-400">
              As instancias nao serao apagadas. Esta acao nao pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteAll(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteAll} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Apagar todos os {groups.length} grupos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
