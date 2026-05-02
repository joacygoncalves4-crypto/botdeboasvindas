'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Download, Trash2, Wifi, WifiOff, QrCode, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Instance } from '@/types'

const statusLabel: Record<string, string> = {
  connected: 'Conectado',
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  qr_code: 'Aguardando QR',
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [availableToImport, setAvailableToImport] = useState<any[]>([])
  const [selectedToImport, setSelectedToImport] = useState<string[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [qrDialog, setQrDialog] = useState<{ instanceId: string; qr: string } | null>(null)
  const [qrPolling, setQrPolling] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/instances')
    const data = await res.json()
    setInstances(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Poll status for connecting/qr_code instances
  useEffect(() => {
    const needPoll = instances.filter((i) => i.status === 'connecting' || i.status === 'qr_code')
    if (!needPoll.length) return
    const timer = setInterval(async () => {
      for (const inst of needPoll) {
        const res = await fetch(`/api/instances/${inst.id}/status`)
        const data = await res.json()
        if (data.status === 'connected') {
          setInstances((prev) => prev.map((i) => i.id === inst.id ? { ...i, status: 'connected', qr_code: null } : i))
          if (qrDialog?.instanceId === inst.id) setQrDialog(null)
        }
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [instances, qrDialog])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setCreating(false); return }
    setInstances((prev) => [...prev, data])
    setNewName('')
    setShowCreate(false)
    setCreating(false)
    // Auto-open QR
    handleShowQr(data.id)
  }

  async function handleShowQr(id: string) {
    const res = await fetch(`/api/instances/${id}/qr`)
    const data = await res.json()
    if (data.qr_code) {
      setQrDialog({ instanceId: id, qr: data.qr_code })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover essa instancia?')) return
    await fetch(`/api/instances/${id}`, { method: 'DELETE' })
    setInstances((prev) => prev.filter((i) => i.id !== id))
  }

  async function openImport() {
    setImportLoading(true)
    setShowImport(true)
    const res = await fetch('/api/instances/import')
    const data = await res.json()
    setAvailableToImport(Array.isArray(data) ? data : [])
    setImportLoading(false)
  }

  async function handleImport() {
    if (!selectedToImport.length) return
    setImportLoading(true)
    const res = await fetch('/api/instances/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceNames: selectedToImport }),
    })
    await res.json()
    setShowImport(false)
    setSelectedToImport([])
    load()
    setImportLoading(false)
  }

  function toggleImportSelect(name: string) {
    setSelectedToImport((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Instancias</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie suas conexoes WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openImport}>
            <Download className="w-4 h-4" />
            Importar
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Nova Instancia
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Smartphone className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-medium">Nenhuma instancia cadastrada</p>
            <p className="text-sm mt-1">Crie ou importe instancias para comecar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <Card key={inst.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{inst.name}</CardTitle>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">{inst.evolution_instance_name}</p>
                  </div>
                  <Badge variant={inst.status as any}>{statusLabel[inst.status] ?? inst.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {inst.phone_number && (
                  <p className="text-sm text-zinc-400 mb-3">{inst.phone_number}</p>
                )}
                <div className="flex gap-2">
                  {inst.status !== 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleShowQr(inst.id)}
                    >
                      <QrCode className="w-3 h-3" />
                      QR Code
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetch(`/api/instances/${inst.id}/status`).then(load)}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(inst.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instancia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome da instancia</Label>
              <Input
                placeholder="ex: Bot Principal"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <p className="text-xs text-zinc-500">
                Nome tecnico sera: {newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '...'}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Instancias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {importLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              </div>
            ) : availableToImport.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-4">
                Nenhuma instancia conectada disponivel para importar.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableToImport.map((inst: any) => (
                  <label
                    key={inst.instanceName}
                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedToImport.includes(inst.instanceName)}
                      onChange={() => toggleImportSelect(inst.instanceName)}
                      className="accent-green-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{inst.instanceName}</p>
                      {inst.owner && <p className="text-xs text-zinc-500">{inst.owner}</p>}
                    </div>
                    <Badge variant="connected" className="ml-auto">Conectado</Badge>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!selectedToImport.length || importLoading}>
                <Download className="w-4 h-4" />
                Importar ({selectedToImport.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={() => setQrDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            {qrDialog?.qr ? (
              <img
                src={qrDialog.qr}
                alt="QR Code"
                className="w-64 h-64 rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            )}
            <p className="text-sm text-zinc-400 text-center">
              Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
            </p>
            <p className="text-xs text-zinc-500">Atualizando automaticamente...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Smartphone({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}
