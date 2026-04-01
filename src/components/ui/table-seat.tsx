'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import type { Player } from '@/types'
import { ChipStack } from './chip-stack'

interface TableSeatProps {
  player?: Player
  isCurrentUser?: boolean
  isCurrentTurn?: boolean
  position: 'top' | 'left' | 'right' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
  children?: React.ReactNode
}

const positionStyles: Record<string, string> = {
  top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  'top-left': 'top-[15%] left-[10%] -translate-x-1/2',
  'top-right': 'top-[15%] right-[10%] translate-x-1/2',
  'bottom-left': 'bottom-[15%] left-[10%] -translate-x-1/2',
  'bottom-right': 'bottom-[15%] right-[10%] translate-x-1/2',
}

export function TableSeat({ player, isCurrentUser, isCurrentTurn, position, className, children }: TableSeatProps) {
  return (
    <motion.div
      className={cn(
        'absolute z-10',
        positionStyles[position],
        className
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="flex flex-col items-center gap-1.5">
        {children}
        <motion.div
          className={cn(
            'glass rounded-xl px-3 py-2 flex items-center gap-2 min-w-[100px]',
            isCurrentTurn && 'ring-2 ring-accent/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]',
            isCurrentUser && 'border-accent/30',
            !player && 'opacity-40'
          )}
          animate={isCurrentTurn ? { boxShadow: ['0 0 20px rgba(99,102,241,0.1)', '0 0 30px rgba(99,102,241,0.2)', '0 0 20px rgba(99,102,241,0.1)'] } : undefined}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            player ? 'bg-accent/20' : 'bg-white/[0.04]'
          )}>
            {player ? (
              <span className="text-xs font-bold text-accent-light">
                {player.displayName?.charAt(0).toUpperCase() || '?'}
              </span>
            ) : (
              <User className="h-3.5 w-3.5 text-text-tertiary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">
              {player?.displayName || 'Empty Seat'}
            </p>
            {player && (
              <div className="flex items-center gap-1">
                <ChipStack amount={player.chips} size="sm" animate={false} className="scale-50 origin-left" />
                <span className="text-[10px] text-text-secondary">{player.chips}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
