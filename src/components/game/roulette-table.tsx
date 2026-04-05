'use client'

import { type MutableRefObject, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import {
  AnimatedButton,
  RoomCodeBadge,
  StatusPill,
  FunDeckShuffle,
} from '@/components/ui'
import { ArrowLeft, Coins, Trash2, RotateCcw, Check, Clock } from 'lucide-react'
import Link from 'next/link'
import type { RouletteState, RoulettePlayer, RouletteBetDef, RouletteBetType } from '@/types'
import type { GameWebSocket } from '@/lib/websocket/client'
import { cn, formatChips } from '@/lib/utils'

// ── Constants ───────────────────────────────────────────────────

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
]

function getColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

const BG: Record<string, string> = {
  red: 'bg-gradient-to-br from-red-600 to-red-800',
  black: 'bg-gradient-to-br from-[#1c1c30] to-[#111122]',
  green: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
}

const CHIP_DENOMS = [1, 5, 10, 25, 50, 100, 500]
const CHIP_STYLES: Record<number, { bg: string; glow: string }> = {
  1:   { bg: 'from-slate-300 to-slate-500 border-slate-200/50', glow: 'rgba(148,163,184,0.35)' },
  5:   { bg: 'from-red-500 to-red-700 border-red-400/50', glow: 'rgba(239,68,68,0.35)' },
  10:  { bg: 'from-blue-500 to-blue-700 border-blue-400/50', glow: 'rgba(59,130,246,0.35)' },
  25:  { bg: 'from-emerald-500 to-emerald-700 border-emerald-400/50', glow: 'rgba(16,185,129,0.35)' },
  50:  { bg: 'from-purple-500 to-purple-700 border-purple-400/50', glow: 'rgba(139,92,246,0.35)' },
  100: { bg: 'from-amber-500 to-amber-700 border-amber-400/50', glow: 'rgba(245,158,11,0.35)' },
  500: { bg: 'from-pink-500 to-pink-700 border-pink-400/50', glow: 'rgba(236,72,153,0.35)' },
}

function numbersForBet(type: RouletteBetType, key: string): number[] {
  switch (type) {
    case 'red': return [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
    case 'black': return [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]
    case 'even': return Array.from({length: 18}, (_, i) => (i + 1) * 2)
    case 'odd': return Array.from({length: 18}, (_, i) => i * 2 + 1)
    case 'low': return Array.from({length: 18}, (_, i) => i + 1)
    case 'high': return Array.from({length: 18}, (_, i) => i + 19)
    case 'dozen': { const d = parseInt(key); return Array.from({length: 12}, (_, i) => (d - 1) * 12 + i + 1) }
    case 'column': { const c = parseInt(key); return Array.from({length: 12}, (_, i) => c + i * 3) }
    case 'straight': return [parseInt(key)]
    case 'basket': return [0, 1, 2, 3]
    default: return []
  }
}

// ── Wheel ───────────────────────────────────────────────────────

const SPIN_ANIM_MS = 4500

function RouletteWheel({ winningNumber, spinning, phase, size = 280 }: {
  winningNumber: number | null; spinning: boolean; phase: string; size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const targetAngleRef = useRef(0)
  const isAnimating = useRef(false)
  const animFrameRef = useRef(0)
  const prevWinning = useRef<number | null>(null)
  const spinStartTime = useRef(0)

  useEffect(() => {
    if (spinning && winningNumber !== null && winningNumber !== prevWinning.current) {
      prevWinning.current = winningNumber
      const idx = WHEEL_ORDER.indexOf(winningNumber)
      const sliceAngle = (2 * Math.PI) / 37

      // Pointer is at the top of the canvas = -π/2 in canvas coords.
      // We need slice center for idx to align with -π/2.
      // Slice i is drawn at: angle + i * sliceAngle, center at angle + (i + 0.5) * sliceAngle
      // We want: currentAngle + (idx + 0.5) * sliceAngle ≡ -π/2 (mod 2π)
      // => targetAngle = -π/2 - (idx + 0.5) * sliceAngle
      const desiredAngle = -Math.PI / 2 - (idx + 0.5) * sliceAngle

      // Normalize so we always spin forward (positive direction) with extra full spins
      const currentNorm = angleRef.current % (2 * Math.PI)
      let delta = desiredAngle - currentNorm
      // Ensure positive direction
      while (delta > 0) delta -= 2 * Math.PI
      while (delta < -2 * Math.PI) delta += 2 * Math.PI
      // Add 7 full spins for drama
      const fullSpins = 7 * 2 * Math.PI
      targetAngleRef.current = angleRef.current + delta - fullSpins

      isAnimating.current = true
      spinStartTime.current = performance.now()
    }
  }, [spinning, winningNumber])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cx = size / 2
    const cy = size / 2
    const outerR = size / 2 - 4
    const innerR = outerR * 0.62
    const textR = (outerR + innerR) / 2
    const centerR = innerR * 0.55
    const sliceAngle = (2 * Math.PI) / 37
    const fontSize = Math.max(9, Math.round(size * 0.04))

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, size, size)
      const angle = angleRef.current

      ctx.beginPath()
      ctx.arc(cx, cy, outerR + 2, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 3
      ctx.stroke()

      for (let i = 0; i < 37; i++) {
        const num = WHEEL_ORDER[i]
        const start = angle + i * sliceAngle
        const end = start + sliceAngle
        const color = getColor(num)

        ctx.beginPath()
        ctx.arc(cx, cy, outerR, start, end)
        ctx.arc(cx, cy, innerR, end, start, true)
        ctx.closePath()

        const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
        if (color === 'red') {
          grad.addColorStop(0, '#b91c1c')
          grad.addColorStop(1, '#dc2626')
        } else if (color === 'green') {
          grad.addColorStop(0, '#047857')
          grad.addColorStop(1, '#059669')
        } else {
          grad.addColorStop(0, '#0f0f1e')
          grad.addColorStop(1, '#1a1a2e')
        }
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 0.8
        ctx.stroke()

        const mid = start + sliceAngle / 2
        ctx.save()
        ctx.translate(cx + Math.cos(mid) * textR, cy + Math.sin(mid) * textR)
        ctx.rotate(mid + Math.PI / 2)
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 2
        ctx.fillText(num.toString(), 0, 0)
        ctx.shadowBlur = 0
        ctx.restore()
      }

      // Inner ring
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR)
      innerGrad.addColorStop(0, '#12121e')
      innerGrad.addColorStop(0.7, '#0a0a14')
      innerGrad.addColorStop(1, '#080812')
      ctx.fillStyle = innerGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Center
      ctx.beginPath()
      ctx.arc(cx, cy, centerR, 0, 2 * Math.PI)
      const cGrad = ctx.createRadialGradient(cx, cy - centerR * 0.3, 0, cx, cy, centerR)
      cGrad.addColorStop(0, '#1e1e36')
      cGrad.addColorStop(1, '#0a0a14')
      ctx.fillStyle = cGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Pointer at top
      const pSize = Math.max(6, size * 0.025)
      ctx.beginPath()
      ctx.moveTo(cx, 2)
      ctx.lineTo(cx - pSize, pSize * 2.3)
      ctx.lineTo(cx + pSize, pSize * 2.3)
      ctx.closePath()
      const pGrad = ctx.createLinearGradient(cx, 2, cx, pSize * 2.3)
      pGrad.addColorStop(0, '#fcd34d')
      pGrad.addColorStop(1, '#f59e0b')
      ctx.fillStyle = pGrad
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    let running = true
    function animate() {
      if (!running) return

      if (isAnimating.current) {
        const elapsed = performance.now() - spinStartTime.current
        const progress = Math.min(elapsed / SPIN_ANIM_MS, 1)
        // Smooth cubic ease-out
        const ease = 1 - Math.pow(1 - progress, 4)
        const startAngle = targetAngleRef.current + 7 * 2 * Math.PI + (2 * Math.PI)
        angleRef.current = startAngle + (targetAngleRef.current - startAngle) * ease

        if (progress >= 1) isAnimating.current = false
      }

      draw()
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => { running = false; cancelAnimationFrame(animFrameRef.current) }
  }, [spinning, size])

  return <canvas ref={canvasRef} className="relative z-10" style={{ width: size, height: size }} />
}

// ── Results Strip ───────────────────────────────────────────────

function ResultsStrip({ results }: { results: number[] }) {
  if (results.length === 0) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none">
      {results.map((n, i) => {
        const c = getColor(n)
        return (
          <motion.div
            key={`${n}-${i}`}
            initial={i === 0 ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              'w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md',
              BG[c],
              i === 0
                ? 'border-2 border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                : 'border border-white/10',
            )}
          >
            {n}
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Betting Board ───────────────────────────────────────────────

const ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
]

function BetChipMarker({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="absolute bottom-0.5 right-0.5 z-30 min-w-[16px] h-[16px] rounded-full bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300/50 flex items-center justify-center shadow-md shadow-amber-500/25"
    >
      <span className="text-[7px] font-extrabold text-amber-950 leading-none px-0.5">
        {amount >= 1000 ? `${Math.round(amount / 1000)}K` : amount}
      </span>
    </motion.div>
  )
}

function BettingBoard({ onBet, bets, disabled }: {
  onBet: (type: RouletteBetType, key: string) => void; bets: RouletteBetDef[]; disabled: boolean
}) {
  const [hoverNums, setHoverNums] = useState<Set<number>>(new Set())

  const betAmountByNumber = useMemo(() => {
    const map = new Map<number, number>()
    for (const b of bets) {
      for (const n of b.numbers) {
        map.set(n, (map.get(n) || 0) + Math.round(b.amount / b.numbers.length))
      }
    }
    return map
  }, [bets])

  const bet = useCallback((type: RouletteBetType, key: string) => { if (!disabled) onBet(type, key) }, [disabled, onBet])

  const cell = cn(
    'relative flex items-center justify-center font-bold text-xs md:text-sm border border-white/[0.06] select-none',
    'transition-all duration-150 ease-out',
  )
  const sz = 'w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11'

  function cellClass(color: string, num: number) {
    const hover = hoverNums.has(num)
    return cn(
      cell, sz, BG[color],
      !disabled && 'cursor-pointer',
      hover && !disabled && 'brightness-125 scale-[1.08] z-10 shadow-[0_0_16px_rgba(255,255,255,0.08)]',
      disabled && 'opacity-50 cursor-not-allowed',
    )
  }

  function outsideClass(isActive?: boolean) {
    return cn(
      cell, 'bg-white/[0.04] backdrop-blur-sm',
      !disabled && 'cursor-pointer hover:bg-white/[0.1] hover:shadow-[0_0_12px_rgba(255,255,255,0.04)]',
      isActive && !disabled && 'bg-white/[0.1]',
      disabled && 'opacity-50 cursor-not-allowed',
    )
  }

  return (
    <div className="w-full overflow-x-auto" style={{ '--zero-w': '2.25rem', '--cell-w': '2.25rem' } as React.CSSProperties}>
      <div className="inline-flex flex-col gap-0 min-w-fit sm:[--zero-w:2.5rem] sm:[--cell-w:2.5rem] md:[--zero-w:2.75rem] md:[--cell-w:2.75rem] p-px">
        {/* Main number grid: zero | 12 numbers per row | column bet */}
        <div className="grid overflow-visible" style={{ gridTemplateColumns: `var(--zero-w) repeat(12, var(--cell-w)) var(--cell-w)` }}>
          {/* Zero spanning 3 rows */}
          <motion.button
            className={cn(cell, 'rounded-l-xl', BG.green, !disabled && 'cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', hoverNums.has(0) && !disabled && 'brightness-125 shadow-[0_0_20px_rgba(16,185,129,0.2)]')}
            style={{ gridRow: 'span 3' }}
            onClick={() => bet('straight', '0')}
            onMouseEnter={() => setHoverNums(new Set([0]))}
            onMouseLeave={() => setHoverNums(new Set())}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
          >
            <span className="text-base md:text-lg font-bold text-white">0</span>
            <AnimatePresence>
              {betAmountByNumber.has(0) && <BetChipMarker amount={betAmountByNumber.get(0)!} />}
            </AnimatePresence>
          </motion.button>

          {/* Row 1 (3,6,...,36) + col 3 */}
          {ROWS[0].map((num) => {
            const c = getColor(num); const amt = betAmountByNumber.get(num)
            return (
              <motion.button key={num} className={cellClass(c, num)} style={{ height: 'var(--cell-w)' }}
                onClick={() => bet('straight', num.toString())}
                onMouseEnter={() => setHoverNums(new Set([num]))}
                onMouseLeave={() => setHoverNums(new Set())}
                whileTap={!disabled ? { scale: 0.92 } : undefined}
              >
                <span className="text-white">{num}</span>
                <AnimatePresence>{amt !== undefined && <BetChipMarker amount={amt} />}</AnimatePresence>
              </motion.button>
            )
          })}
          <motion.button className={cn(outsideClass())} style={{ height: 'var(--cell-w)' }}
            onClick={() => bet('column', '3')}
            onMouseEnter={() => setHoverNums(new Set(Array.from({length: 12}, (_, i) => 3 + i * 3)))}
            onMouseLeave={() => setHoverNums(new Set())}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
          >
            <span className="text-[10px] md:text-xs text-text-secondary font-semibold">2:1</span>
          </motion.button>

          {/* Row 2 (2,5,...,35) + col 2 */}
          {ROWS[1].map((num) => {
            const c = getColor(num); const amt = betAmountByNumber.get(num)
            return (
              <motion.button key={num} className={cellClass(c, num)} style={{ height: 'var(--cell-w)' }}
                onClick={() => bet('straight', num.toString())}
                onMouseEnter={() => setHoverNums(new Set([num]))}
                onMouseLeave={() => setHoverNums(new Set())}
                whileTap={!disabled ? { scale: 0.92 } : undefined}
              >
                <span className="text-white">{num}</span>
                <AnimatePresence>{amt !== undefined && <BetChipMarker amount={amt} />}</AnimatePresence>
              </motion.button>
            )
          })}
          <motion.button className={cn(outsideClass())} style={{ height: 'var(--cell-w)' }}
            onClick={() => bet('column', '2')}
            onMouseEnter={() => setHoverNums(new Set(Array.from({length: 12}, (_, i) => 2 + i * 3)))}
            onMouseLeave={() => setHoverNums(new Set())}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
          >
            <span className="text-[10px] md:text-xs text-text-secondary font-semibold">2:1</span>
          </motion.button>

          {/* Row 3 (1,4,...,34) + col 1 */}
          {ROWS[2].map((num) => {
            const c = getColor(num); const amt = betAmountByNumber.get(num)
            return (
              <motion.button key={num} className={cellClass(c, num)} style={{ height: 'var(--cell-w)' }}
                onClick={() => bet('straight', num.toString())}
                onMouseEnter={() => setHoverNums(new Set([num]))}
                onMouseLeave={() => setHoverNums(new Set())}
                whileTap={!disabled ? { scale: 0.92 } : undefined}
              >
                <span className="text-white">{num}</span>
                <AnimatePresence>{amt !== undefined && <BetChipMarker amount={amt} />}</AnimatePresence>
              </motion.button>
            )
          })}
          <motion.button className={cn(outsideClass())} style={{ height: 'var(--cell-w)' }}
            onClick={() => bet('column', '1')}
            onMouseEnter={() => setHoverNums(new Set(Array.from({length: 12}, (_, i) => 1 + i * 3)))}
            onMouseLeave={() => setHoverNums(new Set())}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
          >
            <span className="text-[10px] md:text-xs text-text-secondary font-semibold">2:1</span>
          </motion.button>
        </div>

        {/* Dozens — grid aligned to number columns */}
        <div className="grid" style={{ gridTemplateColumns: `var(--zero-w) repeat(3, calc(4 * var(--cell-w))) var(--cell-w)`, gap: 0 }}>
          <div />
          {[1, 2, 3].map((d) => (
            <motion.button
              key={d}
              className={cn(outsideClass(), 'h-8 sm:h-9 md:h-10')}
              onClick={() => bet('dozen', d.toString())}
              onMouseEnter={() => setHoverNums(new Set(Array.from({length: 12}, (_, i) => (d-1)*12+i+1)))}
              onMouseLeave={() => setHoverNums(new Set())}
              whileTap={!disabled ? { scale: 0.97 } : undefined}
            >
              <span className="text-[10px] sm:text-xs md:text-sm text-text-secondary font-medium">{d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12'}</span>
            </motion.button>
          ))}
          <div />
        </div>

        {/* Outside bets — grid aligned to number columns */}
        <div className="grid" style={{ gridTemplateColumns: `var(--zero-w) repeat(6, calc(2 * var(--cell-w))) var(--cell-w)`, gap: 0 }}>
          <div />
          {([
            { type: 'low' as const, label: '1–18', key: 'low' },
            { type: 'even' as const, label: 'EVEN', key: 'even' },
            { type: 'red' as const, label: 'RED', key: 'red', color: true },
            { type: 'black' as const, label: 'BLK', key: 'black', color: true },
            { type: 'odd' as const, label: 'ODD', key: 'odd' },
            { type: 'high' as const, label: '19–36', key: 'high' },
          ] as const).map((b) => (
            <motion.button
              key={b.key}
              className={cn(
                cell, 'h-8 sm:h-9 md:h-10',
                b.key === 'red' ? 'bg-gradient-to-r from-red-700/80 to-red-600/80' :
                b.key === 'black' ? 'bg-gradient-to-r from-[#15152a] to-[#1a1a2e]' :
                'bg-white/[0.04] backdrop-blur-sm',
                !disabled && 'cursor-pointer hover:brightness-125',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              onClick={() => bet(b.type, b.key)}
              onMouseEnter={() => setHoverNums(new Set(numbersForBet(b.type, b.key)))}
              onMouseLeave={() => setHoverNums(new Set())}
              whileTap={!disabled ? { scale: 0.96 } : undefined}
            >
              <span className={cn('text-[10px] sm:text-xs md:text-sm font-semibold', b.key === 'red' || b.key === 'black' ? 'text-white' : 'text-text-secondary')}>{b.label}</span>
            </motion.button>
          ))}
          <div />
        </div>

        {/* Basket */}
        <div className="flex mt-1.5">
          <motion.button
            className={cn(outsideClass(), 'h-8 md:h-9 px-4 rounded-lg text-xs')}
            onClick={() => bet('basket', '0123')}
            onMouseEnter={() => setHoverNums(new Set([0, 1, 2, 3]))}
            onMouseLeave={() => setHoverNums(new Set())}
            whileTap={!disabled ? { scale: 0.96 } : undefined}
          >
            <span className="text-text-secondary">0-1-2-3 <span className="text-text-tertiary">(8:1)</span></span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ── Chips ────────────────────────────────────────────────────────

function ChipSelector({ selected, onSelect, maxChips }: { selected: number; onSelect: (v: number) => void; maxChips: number }) {
  return (
    <div className="flex gap-2 md:gap-3 flex-wrap justify-center">
      {CHIP_DENOMS.filter((d) => d <= Math.max(maxChips, 1)).map((denom) => {
        const s = CHIP_STYLES[denom]
        const isSelected = selected === denom
        const tooExpensive = denom > maxChips
        return (
          <motion.button
            key={denom}
            onClick={() => !tooExpensive && onSelect(denom)}
            whileHover={!tooExpensive ? { scale: 1.15, y: -4 } : undefined}
            whileTap={!tooExpensive ? { scale: 0.9 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={cn(
              'w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-b border-2 flex items-center justify-center shadow-lg',
              s.bg,
              tooExpensive && 'opacity-30 cursor-not-allowed',
              !tooExpensive && 'cursor-pointer',
            )}
            style={{
              boxShadow: isSelected
                ? `0 0 0 3px rgba(255,255,255,0.15), 0 0 24px ${s.glow}, 0 4px 12px rgba(0,0,0,0.4)`
                : `0 4px 12px rgba(0,0,0,0.4)`,
            }}
          >
            <div className={cn(
              'rounded-full border border-dashed w-[70%] h-[70%] flex items-center justify-center',
              isSelected ? 'border-white/50' : 'border-white/25',
            )}>
              <span className="text-[10px] md:text-xs font-bold text-white drop-shadow-sm">
                {denom >= 1000 ? `${denom / 1000}K` : denom}
              </span>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Player Row ──────────────────────────────────────────────────

function PlayerRow({ player, isYou }: { player: RoulettePlayer; isYou: boolean }) {
  return (
    <motion.div
      layout
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors',
        isYou ? 'bg-accent/[0.06] border border-accent/10' : 'bg-white/[0.02]',
      )}
    >
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
        <span className="text-xs font-bold text-accent-light">
          {player.displayName?.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {isYou ? 'You' : player.displayName}
        </p>
        <p className="text-[11px] text-text-tertiary">
          {formatChips(player.chips)} chips
          {player.totalBet > 0 && <span className="text-amber-400/80 ml-1">&middot; Bet {formatChips(player.totalBet)}</span>}
        </p>
      </div>
      <AnimatePresence>
        {player.result && player.result !== 'none' && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              player.result === 'win' || player.result === 'mixed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
            )}
          >
            {player.result === 'lose' ? 'LOST' : `+${formatChips(player.winnings)}`}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Countdown ───────────────────────────────────────────────────

function useCountdown(bettingEndsAt: number | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!bettingEndsAt) { setSecondsLeft(null); return }

    function tick() {
      const remaining = Math.max(0, Math.ceil((bettingEndsAt! - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [bettingEndsAt])

  return secondsLeft
}

function CountdownTimer({ secondsLeft }: { secondsLeft: number | null }) {
  if (secondsLeft === null) return null

  const total = 30
  const fraction = Math.min(secondsLeft / total, 1)
  const isUrgent = secondsLeft <= 10
  const isCritical = secondsLeft <= 5
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - fraction)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-2"
    >
      <div className="relative w-11 h-11 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22" cy="22" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
          />
          <circle
            cx="22" cy="22" r={radius}
            fill="none"
            stroke={isCritical ? '#ef4444' : isUrgent ? '#f59e0b' : '#6366f1'}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <motion.span
          key={secondsLeft}
          initial={{ scale: 1.2, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'text-sm font-bold font-mono z-10',
            isCritical ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-text-primary',
          )}
        >
          {secondsLeft}
        </motion.span>
      </div>
      <span className={cn(
        'text-xs font-medium hidden sm:block',
        isCritical ? 'text-red-400/70' : isUrgent ? 'text-amber-400/70' : 'text-text-tertiary',
      )}>
        {isCritical ? 'Closing!' : isUrgent ? 'Hurry up' : 'Time left'}
      </span>
    </motion.div>
  )
}

// ── Main ────────────────────────────────────────────────────────

interface RouletteTableProps { wsRef: MutableRefObject<GameWebSocket | null> }

export function RouletteTable({ wsRef }: RouletteTableProps) {
  const roomState = useGameStore((s) => s.roomState)
  const { user } = useAuthStore()

  const gameState = roomState?.gameState as RouletteState | undefined
  const phase = gameState?.phase || 'waiting'
  const [selectedChip, setSelectedChip] = useState(10)
  const [localBets, setLocalBets] = useState<RouletteBetDef[]>([])
  const [showShuffle, setShowShuffle] = useState(false)
  const [shuffleSpeed, setShuffleSpeed] = useState<'slow' | 'fast'>('slow')
  const prevPhaseRef = useRef<string>('')
  const hasSeenFirstRound = useRef(false)
  const [previousBets, setPreviousBets] = useState<RouletteBetDef[]>([])
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [wheelZoomed, setWheelZoomed] = useState(false)

  const currentPlayer = gameState?.players?.find((p) => p.id === user?.id)
  const isBettingOpen = phase === 'betting'
  const isSpinning = phase === 'spinning' || phase === 'no_more_bets'
  const secondsLeft = useCountdown(isBettingOpen ? (gameState?.bettingEndsAt ?? null) : null)

  const serverChips = currentPlayer?.chips ?? 0
  const totalLocalBet = useMemo(() => localBets.reduce((sum, b) => sum + b.amount, 0), [localBets])

  const onShuffleComplete = useCallback(() => setShowShuffle(false), [])

  useEffect(() => {
    const cur = phase
    const prev = prevPhaseRef.current

    if (cur === 'betting' && prev !== 'betting') {
      if (!hasSeenFirstRound.current) { setShuffleSpeed('slow'); hasSeenFirstRound.current = true }
      else setShuffleSpeed('fast')
      setShowShuffle(true)
      setLocalBets([])
      setIsConfirmed(false)
    }

    // Zoom wheel in when spinning starts
    if ((cur === 'no_more_bets' || cur === 'spinning') && prev === 'betting') {
      setWheelZoomed(true)
    }

    // Zoom wheel out when round resolves, with a small delay for effect
    if (cur === 'complete' && (prev === 'resolved' || prev === 'spinning')) {
      const timer = setTimeout(() => setWheelZoomed(false), 1200)
      return () => clearTimeout(timer)
    }

    if (cur === 'complete' && prev !== 'complete' && currentPlayer?.bets?.length) {
      setPreviousBets(currentPlayer.bets)
    }

    prevPhaseRef.current = cur
  }, [phase, currentPlayer?.bets])

  function send(type: string, payload?: Record<string, unknown>) {
    wsRef.current?.send(payload ? { type, payload } as never : { type } as never)
  }

  function handlePlaceBet(type: RouletteBetType, key: string) {
    if (!isBettingOpen || isConfirmed) return
    if (selectedChip > serverChips) return

    const nums = numbersForBet(type, key)
    if (nums.length === 0) return

    const updated = [...localBets, { type, numbers: nums, amount: selectedChip }]
    setLocalBets(updated)
    send('rl_place_bet', { bets: updated })
  }

  function handleClearBets() {
    setLocalBets([])
    setIsConfirmed(false)
    send('rl_clear_bets')
  }

  function handleRepeatBets() {
    if (!isBettingOpen || previousBets.length === 0 || isConfirmed) return
    const totalPrev = previousBets.reduce((s, b) => s + b.amount, 0)
    if (totalPrev > serverChips + (currentPlayer?.totalBet ?? 0)) return
    setLocalBets(previousBets)
    send('rl_place_bet', { bets: previousBets })
  }

  function handleConfirm() {
    if (totalLocalBet === 0 || isConfirmed) return
    setIsConfirmed(true)
    send('rl_confirm_bets')
  }

  const phaseLabels: Record<string, string> = {
    betting: 'Place Your Bets',
    no_more_bets: 'No More Bets',
    spinning: 'Spinning...',
    resolved: 'Results',
    complete: 'Round Complete',
    waiting: 'Waiting for Players',
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-transparent via-emerald-950/[0.03] to-transparent">
      <FunDeckShuffle show={showShuffle} speed={shuffleSpeed} onComplete={onShuffleComplete} />

      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
            <RoomCodeBadge code={roomState?.roomCode || ''} />
          </div>
          <div className="flex items-center gap-3">
            {currentPlayer && (
              <div className="hidden md:flex items-center gap-2 text-sm text-text-secondary">
                <Coins className="h-4 w-4" />
                <span className="font-mono font-semibold text-text-primary">{formatChips(currentPlayer.chips)}</span>
              </div>
            )}
            <StatusPill status="playing" label={`Round ${gameState?.roundNumber || 1}`} />
          </div>
        </div>
      </header>

      {/* Game */}
      <main className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto w-full">
        {/* Full-screen wheel overlay during spin */}
        <AnimatePresence>
          {wheelZoomed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                className="relative flex flex-col items-center gap-4"
              >
                {/* Glow behind wheel */}
                <div className={cn(
                  'absolute rounded-full transition-all duration-1000',
                  isSpinning
                    ? 'w-[420px] h-[420px] shadow-[0_0_120px_rgba(251,191,36,0.25)]'
                    : 'w-[420px] h-[420px] shadow-[0_0_80px_rgba(99,102,241,0.15)]',
                )} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

                <RouletteWheel
                  winningNumber={gameState?.winningNumber ?? null}
                  spinning={isSpinning}
                  phase={phase}
                  size={Math.min(400, typeof window !== 'undefined' ? window.innerWidth - 48 : 400)}
                />

                <AnimatePresence mode="wait">
                  <motion.p
                    key={phase}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-lg font-semibold text-white uppercase tracking-widest"
                  >
                    {phase === 'no_more_bets' ? 'No More Bets' : phase === 'spinning' ? 'Spinning...' : phase === 'resolved' ? 'Result!' : ''}
                  </motion.p>
                </AnimatePresence>

                {/* Win/result in overlay */}
                <AnimatePresence>
                  {(phase === 'resolved' || phase === 'complete') && gameState?.winningNumber !== null && gameState?.winningNumber !== undefined && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                      className={cn(
                        'w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl border-2 border-white/30 shadow-xl',
                        BG[getColor(gameState.winningNumber)],
                      )}
                    >
                      {gameState.winningNumber}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {(phase === 'resolved' || phase === 'complete') && currentPlayer && currentPlayer.winnings > 0 && (
                    <motion.p
                      initial={{ y: 8, opacity: 0, scale: 0.9 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-emerald-400 font-bold text-2xl"
                    >
                      +{formatChips(currentPlayer.winnings)}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left — Wheel + Info */}
        <div className="flex flex-col items-center gap-5 lg:w-[340px] w-full lg:sticky lg:top-20">
          <div className="relative flex items-center justify-center">
            <div className={cn(
              'absolute rounded-full transition-all duration-1000',
              'w-[296px] h-[296px] shadow-[0_0_40px_rgba(99,102,241,0.08)]',
            )} />
            <RouletteWheel winningNumber={gameState?.winningNumber ?? null} spinning={isSpinning} phase={phase} />
          </div>

          <div className="flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="text-sm md:text-base font-semibold text-accent-light uppercase tracking-widest text-center"
              >
                {phaseLabels[phase] || phase}
              </motion.p>
            </AnimatePresence>
            <AnimatePresence>
              {isBettingOpen && <CountdownTimer secondsLeft={secondsLeft} />}
            </AnimatePresence>
          </div>

          {/* Win announcement */}
          <AnimatePresence>
            {(phase === 'resolved' || phase === 'complete') && currentPlayer && currentPlayer.winnings > 0 && (
              <motion.p
                initial={{ y: 8, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-emerald-400 font-bold text-xl"
              >
                +{formatChips(currentPlayer.winnings)}
              </motion.p>
            )}
          </AnimatePresence>

          {/* History */}
          <div className="w-full glass rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[10px] text-text-tertiary mb-2 uppercase tracking-wider font-medium">Recent</p>
            <ResultsStrip results={gameState?.previousResults || []} />
            {!gameState?.previousResults?.length && <p className="text-xs text-text-tertiary">No spins yet</p>}
          </div>

          {/* Players */}
          <div className="w-full space-y-1.5">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">
              Players ({gameState?.players?.length || 0})
            </p>
            {gameState?.players?.map((p) => (
              <PlayerRow key={p.id} player={p} isYou={p.id === user?.id} />
            ))}
          </div>
        </div>

        {/* Right — Board + Controls */}
        <div className="flex-1 flex flex-col items-center gap-5 w-full min-w-0">
          {/* Board */}
          <div className="glass rounded-2xl p-3 sm:p-4 md:p-5 w-full overflow-x-auto overflow-y-visible border border-white/[0.04]">
            <BettingBoard onBet={handlePlaceBet} bets={localBets} disabled={!isBettingOpen || isConfirmed} />
          </div>

          {/* Controls */}
          <AnimatePresence>
            {isBettingOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="glass rounded-2xl p-3 sm:p-4 md:p-5 w-full space-y-4 border border-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Select Chip</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-text-secondary">
                      Available: <span className="font-mono font-semibold text-text-primary">{formatChips(serverChips)}</span>
                    </p>
                    <AnimatePresence>
                      {secondsLeft !== null && <CountdownTimer secondsLeft={secondsLeft} />}
                    </AnimatePresence>
                  </div>
                </div>

                <ChipSelector selected={selectedChip} onSelect={setSelectedChip} maxChips={serverChips} />

                <AnimatePresence>
                  {totalLocalBet > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center justify-center gap-2 overflow-hidden"
                    >
                      <Coins className="h-4 w-4 text-amber-400" />
                      <span className="text-lg font-mono font-bold text-text-primary">
                        Total: {formatChips(totalLocalBet)}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 sm:gap-3">
                  <AnimatedButton
                    variant="ghost"
                    className="flex-1 min-w-0 text-xs sm:text-sm"
                    onClick={handleClearBets}
                    disabled={localBets.length === 0 || isConfirmed}
                    icon={<Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  >
                    Clear
                  </AnimatedButton>
                  <AnimatedButton
                    variant="ghost"
                    className="flex-1 min-w-0 text-xs sm:text-sm"
                    onClick={handleRepeatBets}
                    disabled={previousBets.length === 0 || isConfirmed}
                    icon={<RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  >
                    Repeat
                  </AnimatedButton>
                  <AnimatedButton
                    className={cn('flex-1 min-w-0 text-xs sm:text-sm', isConfirmed && 'opacity-60')}
                    onClick={handleConfirm}
                    disabled={totalLocalBet === 0 || isConfirmed}
                    icon={<Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  >
                    {isConfirmed ? 'Confirmed' : 'Confirm'}
                  </AnimatedButton>
                </div>

                {isConfirmed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-xs text-emerald-400/70"
                  >
                    Bets locked in — waiting for other players...
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!isBettingOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-text-tertiary py-4"
            >
              {phase === 'no_more_bets' && 'No more bets — wheel is about to spin...'}
              {phase === 'spinning' && 'The wheel is spinning...'}
              {phase === 'resolved' && 'Payouts calculated!'}
              {phase === 'complete' && 'Next round starting soon...'}
              {phase === 'waiting' && 'Waiting for the game to start...'}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
