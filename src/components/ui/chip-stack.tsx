'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatChips } from '@/lib/utils'

interface ChipStackProps {
  amount: number
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
  className?: string
}

const chipColors = [
  'from-emerald-500/80 to-emerald-700/80',
  'from-blue-500/80 to-blue-700/80',
  'from-red-500/80 to-red-700/80',
  'from-purple-500/80 to-purple-700/80',
  'from-amber-500/80 to-amber-700/80',
]

const sizes = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
}

export function ChipStack({ amount, size = 'md', animate = true, className }: ChipStackProps) {
  const colorIndex = Math.floor(Math.log10(Math.max(amount, 1))) % chipColors.length

  return (
    <motion.div
      className={cn('relative flex flex-col items-center gap-1', className)}
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <div
        className={cn(
          'rounded-full bg-gradient-to-b flex items-center justify-center',
          'border-2 border-white/20 shadow-lg shadow-black/30',
          chipColors[colorIndex],
          sizes[size]
        )}
      >
        <div className="rounded-full border border-white/30 border-dashed w-[70%] h-[70%] flex items-center justify-center">
          <span className="font-bold text-white drop-shadow-sm">
            {formatChips(amount)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
