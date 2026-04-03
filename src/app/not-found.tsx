'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useState, useCallback } from 'react'
import { ArrowRight, ArrowLeft, Search, AlertTriangle } from 'lucide-react'
import { AnimatedButton } from '@/components/ui'
import { joinRoomByCode } from '@/lib/room-join'
import { normalizeRoomCodeInput, looksLikeRoomCode } from '@/lib/utils'

function FloatingCard({ suit, rank, className, delay }: { suit: string; rank: string; className?: string; delay?: number }) {
  const isRedSuit = suit === '♥' || suit === '♦'
  const color = isRedSuit ? 'text-red-400' : 'text-white/80'

  return (
    <div className={`absolute z-[5] pointer-events-none ${className || ''}`}>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{
          opacity: 1,
          y: [0, -10, 0],
          scale: 1,
          rotate: [0, 1.5, -1, 0],
        }}
        transition={{
          opacity: { delay: delay || 0, duration: 0.6 },
          scale: { delay: delay || 0, duration: 0.6 },
          y: { delay: (delay || 0) + 0.6, duration: 5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { delay: (delay || 0) + 0.6, duration: 7, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <motion.div
          className="w-20 h-28 md:w-24 md:h-36 cursor-pointer will-change-transform rounded-xl md:rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16162a] to-[#0f0f1e] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.4),0_12px_40px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] p-2 md:p-2.5 flex flex-col"
          style={{ perspective: 800 }}
          whileHover={{
            scale: 1.18,
            y: -14,
            rotateY: 10,
            rotateX: -6,
            boxShadow: isRedSuit
              ? '0 25px 50px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 25px 50px rgba(99,102,241,0.35), 0 0 40px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
          whileTap={{ scale: 1.08 }}
        >
          <div className={`flex flex-col items-start ${color}`}>
            <span className="text-sm md:text-base font-extrabold leading-none">{rank}</span>
            <span className="text-[10px] md:text-xs leading-none">{suit}</span>
          </div>

          <div className={`flex-1 flex items-center justify-center ${color}`}>
            <span className="text-2xl md:text-3xl opacity-70 drop-shadow-sm">{suit}</span>
          </div>

          <div className={`flex flex-col items-end rotate-180 ${color}`}>
            <span className="text-sm md:text-base font-extrabold leading-none">{rank}</span>
            <span className="text-[10px] md:text-xs leading-none">{suit}</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function NotFound() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)

  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_URL
  const codeQuery = looksLikeRoomCode(roomCode)

  const handleJoin = useCallback(async () => {
    const n = normalizeRoomCodeInput(roomCode)
    if (n.length < 4) return
    setJoining(true)
    try {
      await joinRoomByCode(n, router)
    } finally {
      setJoining(false)
    }
  }, [roomCode, router])

  return (
    <main className="relative min-h-dvh flex items-center justify-center overflow-hidden px-4">
      {/* Floating hero cards (same animation language as home) */}
      <FloatingCard suit="♠" rank="A" className="top-[12%] left-[7%] md:left-[16%] -rotate-12 opacity-60" delay={0.15} />
      <FloatingCard suit="♥" rank="K" className="top-[18%] right-[10%] md:right-[18%] rotate-6 opacity-50" delay={0.28} />
      <FloatingCard suit="♦" rank="Q" className="bottom-[25%] left-[12%] md:left-[22%] rotate-12 opacity-40" delay={0.4} />
      <FloatingCard suit="♣" rank="J" className="bottom-[20%] right-[10%] md:right-[15%] -rotate-6 opacity-50" delay={0.55} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="glass-strong rounded-2xl p-7 md:p-10 border border-white/[0.08]">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl glass border border-white/[0.08]">
              <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">404</h1>
              <h2 className="text-xl md:text-2xl font-semibold mt-1">Page not found</h2>
              <p className="text-sm md:text-base text-text-secondary mt-3 leading-relaxed">
                This page doesn&apos;t exist or may have moved. Don&apos;t worry — you can jump back into the action in seconds.
              </p>
            </div>
          </div>

          <div className="mt-7 grid sm:grid-cols-2 gap-3">
            <AnimatedButton href="/" size="md" className="w-full justify-center">
              Go home
              <ArrowRight className="h-4 w-4" />
            </AnimatedButton>
            <AnimatedButton
              onClick={() => router.back()}
              size="md"
              variant="secondary"
              className="w-full justify-center"
            >
              Go back
              <ArrowLeft className="h-4 w-4" />
            </AnimatedButton>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <AnimatedButton href="/#game-library" size="md" variant="ghost" className="w-full justify-center">
              Browse games
            </AnimatedButton>

            {discordUrl ? (
              <div className="w-full flex items-center justify-center">
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative inline-flex items-center justify-center font-medium rounded-xl h-11 px-6 text-sm gap-2 glass hover:bg-white/[0.08] text-text-primary transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 w-full sm:w-auto"
                >
                  Join Discord for support
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-6 glass rounded-2xl p-4 md:p-5 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              <p className="text-sm font-semibold text-text-primary">Quick join</p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-transparent glass text-text-primary placeholder:text-text-tertiary text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-accent/30"
                inputMode="text"
                aria-label="Room code"
              />
              <AnimatedButton
                onClick={handleJoin}
                disabled={!codeQuery || joining}
                loading={joining}
                size="md"
                variant="secondary"
                className="whitespace-nowrap"
              >
                Join Game
              </AnimatedButton>
            </div>

            <p className="text-xs text-text-tertiary mt-2">
              Tip: room codes are 6 characters. If you have a code, paste it and hit join.
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

