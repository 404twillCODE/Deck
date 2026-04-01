'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatusPillProps {
  status: 'online' | 'offline' | 'playing' | 'waiting' | 'ready'
  label?: string
  className?: string
}

const statusConfig = {
  online: { color: 'bg-success', ring: 'ring-success/20', text: 'Online' },
  offline: { color: 'bg-text-tertiary', ring: 'ring-text-tertiary/20', text: 'Offline' },
  playing: { color: 'bg-accent', ring: 'ring-accent/20', text: 'Playing' },
  waiting: { color: 'bg-warning', ring: 'ring-warning/20', text: 'Waiting' },
  ready: { color: 'bg-success', ring: 'ring-success/20', text: 'Ready' },
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const config = statusConfig[status]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-white/[0.04] border border-white/[0.06]',
        className
      )}
    >
      <motion.span
        className={cn('h-2 w-2 rounded-full ring-4', config.color, config.ring)}
        animate={status === 'playing' || status === 'waiting' ? { opacity: [1, 0.4, 1] } : undefined}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-xs font-medium text-text-secondary">
        {label || config.text}
      </span>
    </div>
  )
}
