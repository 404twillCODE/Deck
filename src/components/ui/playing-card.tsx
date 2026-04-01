'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Card } from '@/types'

interface PlayingCardProps {
  card?: Card
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  delay?: number
  dealing?: boolean
}

const suitSymbols: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
}

const isRed = (suit: string) => suit === 'hearts' || suit === 'diamonds'

const sizeConfig = {
  sm: {
    card: 'w-[3.25rem] h-[4.75rem] md:w-[4rem] md:h-[5.75rem] rounded-lg md:rounded-xl',
    rank: 'text-[11px] md:text-sm leading-none font-extrabold',
    pipSmall: 'text-[9px] md:text-[11px] leading-none',
    center: 'text-xl md:text-2xl',
    padding: 'p-1 md:p-1.5',
  },
  md: {
    card: 'w-[4.25rem] h-[6.25rem] md:w-[5.5rem] md:h-[8rem] lg:w-[6rem] lg:h-[8.75rem] rounded-xl',
    rank: 'text-sm md:text-base lg:text-lg leading-none font-extrabold',
    pipSmall: 'text-[11px] md:text-sm leading-none',
    center: 'text-2xl md:text-3xl lg:text-4xl',
    padding: 'p-1.5 md:p-2',
  },
  lg: {
    card: 'w-[5.5rem] h-[8rem] md:w-[7rem] md:h-[10rem] lg:w-[7.5rem] lg:h-[10.75rem] rounded-xl md:rounded-2xl',
    rank: 'text-base md:text-xl lg:text-2xl leading-none font-extrabold',
    pipSmall: 'text-sm md:text-base leading-none',
    center: 'text-3xl md:text-4xl lg:text-5xl',
    padding: 'p-2 md:p-2.5 lg:p-3',
  },
  xl: {
    card: 'w-[7rem] h-[10rem] md:w-[8rem] md:h-[11.5rem] lg:w-[9rem] lg:h-[13rem] rounded-2xl',
    rank: 'text-xl md:text-2xl lg:text-3xl leading-none font-extrabold',
    pipSmall: 'text-base md:text-lg leading-none',
    center: 'text-4xl md:text-5xl lg:text-6xl',
    padding: 'p-2.5 md:p-3 lg:p-4',
  },
}

export function PlayingCard({ card, faceUp = true, size = 'md', className, delay = 0, dealing = false }: PlayingCardProps) {
  const isVisible = card && faceUp
  const cfg = sizeConfig[size]

  return (
    <motion.div
      className={cn('relative select-none', cfg.card, className)}
      initial={dealing ? { opacity: 0, y: -60, x: 20, rotateY: 180, rotateZ: -8, scale: 0.7 } : false}
      animate={dealing ? { opacity: 1, y: 0, x: 0, rotateY: 0, rotateZ: 0, scale: 1 } : undefined}
      transition={{
        type: 'spring',
        stiffness: 80,
        damping: 14,
        mass: 0.8,
        delay: delay * 1.6,
      }}
      style={{ perspective: 1000 }}
    >
      {isVisible ? (
        <div
          className={cn(
            'absolute inset-0 overflow-hidden flex flex-col',
            cfg.card, cfg.padding,
            'bg-gradient-to-br from-[#1c1c30] via-[#181828] to-[#121220]',
            'border border-white/[0.1]',
            'shadow-[0_2px_8px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]',
          )}
        >
          <div className={cn(
            'flex flex-col items-start gap-0',
            isRed(card.suit) ? 'text-red-400' : 'text-white/80',
          )}>
            <span className={cfg.rank}>{card.rank}</span>
            <span className={cfg.pipSmall}>{suitSymbols[card.suit]}</span>
          </div>

          <div className={cn(
            'flex-1 flex items-center justify-center',
            isRed(card.suit) ? 'text-red-400' : 'text-white/80',
          )}>
            <span className={cn(cfg.center, 'opacity-70 drop-shadow-sm')}>
              {suitSymbols[card.suit]}
            </span>
          </div>

          <div className={cn(
            'flex flex-col items-end gap-0 rotate-180',
            isRed(card.suit) ? 'text-red-400' : 'text-white/80',
          )}>
            <span className={cfg.rank}>{card.rank}</span>
            <span className={cfg.pipSmall}>{suitSymbols[card.suit]}</span>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'absolute inset-0 overflow-hidden',
            cfg.card,
            'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800',
            'border border-indigo-400/30',
            'shadow-[0_2px_8px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.2)]',
          )}
        >
          <div className="absolute inset-[3px] md:inset-1 rounded-[inherit] border border-white/10 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, white 4px, white 5px),
                  repeating-linear-gradient(-45deg, transparent, transparent 4px, white 4px, white 5px)`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[50%] h-[50%] rounded-full border border-white/10 flex items-center justify-center bg-white/[0.03]">
                <span className="text-white/20 font-black text-base md:text-xl lg:text-2xl">D</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
