'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { GameType } from '@/types'

interface GameCardProps {
  gameType: GameType
  title: string
  description: string
  icon: React.ReactNode
  playerCount?: string
  onClick?: () => void
  className?: string
}

export function GameCard({ gameType, title, description, icon, playerCount, onClick, className }: GameCardProps) {
  return (
    <motion.button
      className={cn(
        'group relative glass rounded-2xl p-6 text-left w-full overflow-hidden',
        'hover:bg-white/[0.06] transition-colors duration-300',
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/[0.06] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent-light">
            {icon}
          </div>
          {playerCount && (
            <span className="text-xs text-text-tertiary font-medium px-2.5 py-1 rounded-full bg-white/[0.04]">
              {playerCount}
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
      </div>
    </motion.button>
  )
}
