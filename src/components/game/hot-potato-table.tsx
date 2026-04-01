'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import { AnimatedButton } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { HotPotatoState } from '@/types'
import type { GameWebSocket } from '@/lib/websocket/client'

interface HotPotatoTableProps {
  wsRef: React.MutableRefObject<GameWebSocket | null>
}

function useElapsed(startedAt: number, active: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active || !startedAt) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [startedAt, active])
  return elapsed
}

export function HotPotatoTable({ wsRef }: HotPotatoTableProps) {
  const roomState = useGameStore((s) => s.roomState)
  const { user } = useAuthStore()
  const prevPassCount = useRef(0)
  const [shake, setShake] = useState(false)

  const gameState = roomState?.gameState as HotPotatoState | undefined
  const alivePlayers = gameState?.players.filter((p) => p.isAlive) ?? []
  const holder = alivePlayers[gameState?.holderIndex ?? 0]
  const isMyTurn = holder?.id === user?.id && gameState?.phase === 'passing'
  const myPlayer = gameState?.players.find((p) => p.id === user?.id)
  const amAlive = myPlayer?.isAlive ?? true

  const elapsed = useElapsed(gameState?.roundStartedAt ?? 0, gameState?.phase === 'passing')
  const intensity = Math.min(1, elapsed / 18000)

  useEffect(() => {
    if (!gameState) return
    if (gameState.passCount !== prevPassCount.current && gameState.phase === 'passing') {
      setShake(true)
      const t = setTimeout(() => setShake(false), 300)
      prevPassCount.current = gameState.passCount
      return () => clearTimeout(t)
    }
  }, [gameState?.passCount, gameState?.phase, gameState])

  const handlePass = useCallback(() => {
    if (!isMyTurn) return
    wsRef.current?.send({ type: 'hp_pass' })
  }, [isMyTurn, wsRef])

  if (!gameState) return null

  const eliminatedPlayer = gameState.lastEliminatedId
    ? gameState.players.find((p) => p.id === gameState.lastEliminatedId)
    : null

  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null

  return (
    <div className="min-h-dvh flex flex-col overflow-hidden">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-sm font-semibold text-text-primary">Hot Potato</span>
            {gameState.roundNumber > 0 && (
              <span className="text-xs text-text-tertiary">Round {gameState.roundNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>{alivePlayers.length} alive</span>
            <span className="text-white/10">|</span>
            <span>{gameState.players.length} total</span>
          </div>
        </div>
      </header>

      {/* Dynamic background glow based on intensity */}
      {gameState.phase === 'passing' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(239, 68, 68, ${intensity * 0.15}) 0%, transparent 70%)`,
          }}
        />
      )}

      <div className={cn(
        'flex-1 flex flex-col items-center justify-center p-4 relative z-10 transition-transform',
        shake && 'animate-[shake_0.3s_ease-in-out]',
      )}>

        {/* Countdown phase */}
        <AnimatePresence mode="wait">
          {gameState.phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 2 }}
              className="text-center"
            >
              <p className="text-text-secondary text-lg mb-2">Round {gameState.roundNumber}</p>
              <motion.p
                className="text-6xl font-black text-gradient"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                Get Ready!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active passing phase */}
        {gameState.phase === 'passing' && (
          <div className="w-full max-w-lg flex flex-col items-center gap-8">
            {/* Potato */}
            <motion.div
              key={`potato-${holder?.id}`}
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: [1, 1.05 + intensity * 0.1, 1],
                rotate: 0,
              }}
              transition={{
                scale: { duration: 0.4 + (1 - intensity) * 0.4, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 0.3 },
              }}
              className="relative"
            >
              <div className={cn(
                'text-8xl select-none',
                isMyTurn && 'drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]',
              )}>
                🥔
              </div>
              <motion.div
                className="absolute -top-2 -right-2 text-3xl"
                animate={{ scale: [0.8, 1.2, 0.8], rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.3 + (1 - intensity) * 0.3, repeat: Infinity }}
              >
                🔥
              </motion.div>
            </motion.div>

            {/* Holder indicator */}
            <motion.p
              key={holder?.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'text-xl font-bold text-center',
                isMyTurn ? 'text-red-400' : 'text-text-primary',
              )}
            >
              {isMyTurn ? 'YOU have the potato!' : `${holder?.displayName} has it`}
            </motion.p>

            {/* Pass button (only for holder) */}
            {isMyTurn && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xs"
              >
                <motion.button
                  onClick={handlePass}
                  className="w-full py-6 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-white font-black text-2xl shadow-xl shadow-red-500/30 active:scale-95 transition-transform"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  animate={{
                    boxShadow: [
                      '0 10px 30px rgba(239,68,68,0.3)',
                      `0 10px ${30 + intensity * 30}px rgba(239,68,68,${0.3 + intensity * 0.4})`,
                      '0 10px 30px rgba(239,68,68,0.3)',
                    ],
                  }}
                  transition={{ boxShadow: { duration: 0.5, repeat: Infinity } }}
                >
                  PASS IT! 🔥
                </motion.button>
              </motion.div>
            )}

            {/* Waiting message (if not holder) */}
            {!isMyTurn && amAlive && (
              <p className="text-text-tertiary text-sm animate-pulse">
                Wait for it...
              </p>
            )}

            {/* Spectator message */}
            {!amAlive && (
              <div className="glass rounded-xl px-4 py-2 text-sm text-text-tertiary">
                You&apos;re eliminated — watching the chaos unfold
              </div>
            )}

            {/* Pass counter */}
            <p className="text-xs text-text-tertiary">
              {gameState.passCount} pass{gameState.passCount !== 1 ? 'es' : ''} this round
            </p>
          </div>
        )}

        {/* Explosion phase */}
        <AnimatePresence>
          {gameState.phase === 'exploded' && eliminatedPlayer && (
            <motion.div
              key="exploded"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              <motion.p
                className="text-7xl"
                animate={{ scale: [1, 1.5, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                💥
              </motion.p>
              <h2 className="text-3xl font-black text-red-400">BOOM!</h2>
              <p className="text-xl text-text-primary">
                {eliminatedPlayer.id === user?.id
                  ? "You blew up!"
                  : `${eliminatedPlayer.displayName} blew up!`}
              </p>
              <p className="text-text-tertiary text-sm">Next round starting soon...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game complete */}
        <AnimatePresence>
          {gameState.phase === 'complete' && winner && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <motion.p
                className="text-7xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                🏆
              </motion.p>
              <h2 className="text-3xl font-black text-gradient">
                {winner.id === user?.id ? 'You Win!' : `${winner.displayName} Wins!`}
              </h2>
              <p className="text-text-secondary">Last one standing!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player ring */}
        {(gameState.phase === 'passing' || gameState.phase === 'exploded') && (
          <div className="mt-10 flex flex-wrap justify-center gap-3 max-w-xl">
            {gameState.players.map((p) => {
              const isHolder = holder?.id === p.id && gameState.phase === 'passing'
              return (
                <motion.div
                  key={p.id}
                  layout
                  className={cn(
                    'relative rounded-xl px-4 py-3 text-center min-w-[90px] transition-all border',
                    !p.isAlive
                      ? 'bg-white/[0.02] border-white/[0.04] opacity-40'
                      : isHolder
                        ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/10'
                        : 'glass border-white/[0.06]',
                    p.id === user?.id && p.isAlive && 'ring-1 ring-accent/30',
                  )}
                >
                  {isHolder && (
                    <motion.span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.3, repeat: Infinity }}
                    >
                      🥔
                    </motion.span>
                  )}
                  <p className={cn(
                    'text-sm font-medium',
                    p.isAlive ? 'text-text-primary' : 'text-text-tertiary line-through',
                  )}>
                    {p.displayName}
                    {p.id === user?.id && <span className="text-text-tertiary text-[10px] ml-1">(you)</span>}
                  </p>
                  {!p.isAlive && (
                    <p className="text-[10px] text-red-400/60 mt-0.5">💀 Round {p.eliminatedRound}</p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Elimination order in complete */}
        {gameState.phase === 'complete' && gameState.eliminationOrder.length > 0 && (
          <div className="mt-8 glass rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-sm font-semibold text-text-secondary mb-3 text-center">Elimination Order</h3>
            <div className="space-y-2">
              {gameState.eliminationOrder.map((id, i) => {
                const p = gameState.players.find((pl) => pl.id === id)
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="text-text-tertiary w-5 text-right">{i + 1}.</span>
                    <span className="text-red-400/80">💥</span>
                    <span className="text-text-primary">{p?.displayName ?? 'Unknown'}</span>
                  </div>
                )
              })}
              {winner && (
                <div className="flex items-center gap-3 text-sm pt-1 border-t border-white/[0.06]">
                  <span className="text-text-tertiary w-5 text-right">🏆</span>
                  <span>👑</span>
                  <span className="text-accent-light font-semibold">{winner.displayName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px) rotate(-0.5deg); }
          40% { transform: translateX(4px) rotate(0.5deg); }
          60% { transform: translateX(-3px) rotate(-0.3deg); }
          80% { transform: translateX(3px) rotate(0.3deg); }
        }
      `}</style>
    </div>
  )
}
