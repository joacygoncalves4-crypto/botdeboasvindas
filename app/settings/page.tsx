'use client'
import { useState } from 'react'
import { Save, Loader2, Terminal, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const [cronResult, setCronResult] = useState<string | null>(null)
  const [cronRunning, setCronRunning] = useState(false)

  const evolutionUrl = process.env.NEXT_PUBLIC_EVOLUTION_API_URL ?? ''

  async function runCronManual() {
    setCronRunning(true)
    setCronResult(null)
    const res = await fetch('/api/cron/process-queue', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? 'wppbot_cron_secret_2024'}` },
    })
    const data = await res.json()
    setCronResult(JSON.stringify(data, null, 2))
    setCronRunning(false)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Configuracoes</h1>
        <p className="text-zinc-400 text-sm mt-1">Informacoes do sistema</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolution API</CardTitle>
            <CardDescription>Credenciais configuradas via variaveis de ambiente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input value={evolutionUrl} readOnly className="opacity-60 cursor-default" />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input value="••••••••••••••••••••••••••••••••" readOnly className="opacity-60 cursor-default" />
            </div>
            <p className="text-xs text-zinc-500">
              Para alterar, edite as variaveis de ambiente no Vercel (NEXT_PUBLIC_EVOLUTION_API_URL e EVOLUTION_API_KEY)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase</CardTitle>
            <CardDescription>Banco de dados configurado via variaveis de ambiente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Supabase</Label>
              <Input
                value={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
                readOnly
                className="opacity-60 cursor-default"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Para alterar, edite NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="w-4 h-4 text-green-500" />
              Processador de Fila
            </CardTitle>
            <CardDescription>
              No Vercel o cron roda automaticamente a cada minuto. Aqui voce pode acionar manualmente para testar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runCronManual} disabled={cronRunning} variant="outline">
              {cronRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Processar Fila Agora
            </Button>
            {cronResult && (
              <pre className="text-xs bg-zinc-800 rounded-lg p-4 overflow-auto text-green-400">
                {cronResult}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como configurar o Webhook</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-3">
              O webhook e configurado automaticamente ao criar ou importar uma instancia. O formato e:
            </p>
            <code className="text-xs bg-zinc-800 px-3 py-2 rounded block text-green-400 break-all">
              https://SEU-DOMINIO.vercel.app/api/webhook/[nome-da-instancia]
            </code>
            <p className="text-sm text-zinc-400 mt-3">
              Eventos escutados: <span className="text-zinc-300">GROUP_PARTICIPANTS_UPDATE, MESSAGES_UPSERT, CONNECTION_UPDATE</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setup do Banco de Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-3">
              Execute o arquivo <code className="text-green-400">supabase/schema.sql</code> no SQL Editor do seu Supabase para criar as tabelas.
            </p>
            <p className="text-sm text-zinc-400 mb-3">
              Tambem crie um bucket publico chamado <code className="text-green-400">followup-media</code> no Supabase Storage para uploads de midia.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
