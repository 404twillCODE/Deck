'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DeckShuffleProps {
  show: boolean
  speed?: 'slow' | 'fast'
  onComplete?: () => void
  className?: string
}

const CARD_COUNT = 8
const CARD_W = 54
const CARD_H = 78

function ShuffleCard({ index, phase, speed }: { index: number; phase: number; speed: 'slow' | 'fast' }) {
  const isLeft = index % 2 === 0
  const halfIdx = Math.floor(index / 2)
  const dur = speed === 'slow' ? 0.35 : 0.15
  const stagger = speed === 'slow' ? 0.06 : 0.025

  const variants = {
    stacked: {
      x: 0,
      y: -index * 1.5,
      rotateZ: 0,
      scale: 1,
      zIndex: index,
    },
    split: {
      x: isLeft ? -42 : 42,
      y: -halfIdx * 3,
      rotateZ: isLeft ? -6 : 6,
      scale: 1,
      zIndex: index,
    },
    riffle: {
      x: 0,
      y: -index * 1.5,
      rotateZ: 0,
      scale: 1,
      zIndex: CARD_COUNT - index,
    },
  }

  const phaseKey = phase === 0 ? 'stacked' : phase === 1 ? 'split' : 'riffle'

  return (
    <motion.div
      className="absolute rounded-md md:rounded-lg overflow-hidden border border-indigo-400/20 shadow-lg"
      style={{ width: CARD_W, height: CARD_H }}
      variants={variants}
      animate={phaseKey}
      transition={{
        type: 'spring',
        stiffness: speed === 'slow' ? 200 : 400,
        damping: speed === 'slow' ? 18 : 22,
        mass: 0.5,
        delay: phase === 2 ? (CARD_COUNT - 1 - index) * stagger : halfIdx * stagger,
        duration: dur,
      }}
    >
      <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
        <div className="absolute inset-[2px] rounded-[inherit] border border-white/10 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 3px, white 3px, white 4px),
                repeating-linear-gradient(-45deg, transparent, transparent 3px, white 3px, white 4px)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[45%] h-[45%] rounded-full border border-white/10 flex items-center justify-center bg-white/[0.03]">
              <span className="text-white/15 font-black text-xs">D</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function DeckShuffle({ show, speed = 'slow', onComplete, className }: DeckShuffleProps) {
  const [phase, setPhase] = useState(0)
  const [cycles, setCycles] = useState(0)
  const maxCycles = speed === 'slow' ? 3 : 2

  const dur = speed === 'slow' ? 600 : 250

  const runCycle = useCallback(() => {
    setPhase(1)
    setTimeout(() => {
      setPhase(2)
      setTimeout(() => {
        setCycles((c) => c + 1)
      }, dur)
    }, dur)
  }, [dur])

  useEffect(() => {
    if (!show) {
      setPhase(0)
      setCycles(0)
      return
    }
    const t = setTimeout(runCycle, speed === 'slow' ? 400 : 150)
    return () => clearTimeout(t)
  }, [show, runCycle, speed])

  useEffect(() => {
    if (!show) return
    if (cycles > 0 && cycles < maxCycles) {
      setPhase(0)
      const t = setTimeout(runCycle, speed === 'slow' ? 200 : 80)
      return () => clearTimeout(t)
    }
    if (cycles >= maxCycles) {
      const t = setTimeout(() => onComplete?.(), speed === 'slow' ? 300 : 120)
      return () => clearTimeout(t)
    }
  }, [cycles, maxCycles, show, runCycle, onComplete, speed])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn(
            'fixed inset-0 z-[100] flex items-center justify-center',
            'bg-black/60 backdrop-blur-sm',
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="relative flex items-center justify-center"
            style={{ width: CARD_W + 100, height: CARD_H + 60 }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            {Array.from({ length: CARD_COUNT }).map((_, i) => (
              <ShuffleCard key={i} index={i} phase={phase} speed={speed} />
            ))}
          </motion.div>

          <motion.p
            className="absolute bottom-[35%] text-sm md:text-base font-semibold text-white/50 uppercase tracking-[0.25em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Shuffling
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
