'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Smartphone, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/groups', label: 'Grupos', icon: Users },
  { href: '/instances', label: 'Instancias', icon: Smartphone },
  { href: '/settings', label: 'Configuracoes', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">WPP Bot</p>
            <p className="text-xs text-zinc-500">Automacao WhatsApp</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-green-600/20 text-green-400 font-medium'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">v1.0.0</p>
      </div>
    </aside>
  )
}
