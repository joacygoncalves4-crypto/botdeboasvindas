import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'

export const metadata: Metadata = {
  title: 'WPP Bot - Automacao WhatsApp',
  description: 'Plataforma de automacao de mensagens WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
