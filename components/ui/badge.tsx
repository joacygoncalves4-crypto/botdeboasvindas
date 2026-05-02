import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-green-600 text-white',
        secondary: 'border-transparent bg-zinc-700 text-zinc-100',
        destructive: 'border-transparent bg-red-600 text-white',
        outline: 'text-zinc-100 border-zinc-600',
        connected: 'border-transparent bg-green-600/20 text-green-400 border-green-600/30',
        disconnected: 'border-transparent bg-red-600/20 text-red-400 border-red-600/30',
        connecting: 'border-transparent bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
        qr_code: 'border-transparent bg-blue-600/20 text-blue-400 border-blue-600/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
