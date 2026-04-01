'use client'

import { cn } from '@/lib/utils'

interface DeckLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function DeckLogo({ size = 'md', className }: DeckLogoProps) {
  const config = {
    sm: { container: 'w-7 h-7', card: 'w-3 h-[17px] text-[6px] rounded-[2px]' },
    md: { container: 'w-8 h-8', card: 'w-3.5 h-5 text-[8px] rounded-[3px]' },
    lg: { container: 'w-10 h-10', card: 'w-[18px] h-[26px] text-[10px] rounded-sm' },
  }
  const s = config[size]

  return (
    <div className={cn(s.container, 'rounded-xl bg-accent/20 flex items-center justify-center', className)}>
      <div
        className={cn(
          s.card,
          '-rotate-12 bg-gradient-to-br from-accent-light to-accent flex items-center justify-center shadow-sm',
        )}
      >
        <span className="font-bold text-white drop-shadow-sm">♠</span>
      </div>
    </div>
  )
}
