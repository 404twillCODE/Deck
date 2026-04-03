'use client'

import { type MutableRefObject, useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import {
  AnimatedButton,
  PlayingCard,
  ChipStack,
  RoomCodeBadge,
  StatusPill,
  FunDeckShuffle,
} from '@/components/ui'
import { ArrowLeft, Coins } from 'lucide-react'
import Link from 'next/link'
import type { BlackjackState, BlackjackPlayer, Card } from '@/types'
import type { GameWebSocket } from '@/lib/websocket/client'
import { cn, formatChips } from '@/lib/utils'

function DealerHand({ cards, value, phase }: { cards: Card[]; value: number; phase: string }) {
  const [tapped, setTapped] = useState(false)
  const showValue = phase !== 'waiting' && phase !== 'betting'
  const faceUpCards = cards.filter((c) => c.faceUp)
  const cardNames = faceUpCards.map((c) => {
    const suitSymbol: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
    return `${c.rank}${suitSymbol[c.suit] || ''}`
  })
  const hasHidden = cards.some((c) => !c.faceUp)

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <div className="flex items-center gap-3">
        <span className="text-xs md:text-sm font-semibold text-text-tertiary uppercase tracking-widest">
          Dealer
        </span>
        {showValue && (
          <span className="text-sm md:text-lg font-mono font-bold text-text-primary">
            {value}
          </span>
        )}
      </div>
      <button
        className="flex gap-3 md:gap-4 cursor-pointer"
        onClick={() => cards.length > 0 && setTapped((v) => !v)}
      >
        {cards.map((card, i) => (
          <PlayingCard
            key={`dealer-${i}`}
            card={card}
            faceUp={card.faceUp}
            size="lg"
            dealing
            delay={i * 0.2}
          />
        ))}
        {cards.length === 0 && (
          <>
            <div className="w-[5.5rem] h-[8rem] md:w-[7rem] md:h-[10rem] lg:w-[7.5rem] lg:h-[10.75rem] rounded-xl md:rounded-2xl border-2 border-dashed border-white/[0.06]" />
            <div className="w-[5.5rem] h-[8rem] md:w-[7rem] md:h-[10rem] lg:w-[7.5rem] lg:h-[10.75rem] rounded-xl md:rounded-2xl border-2 border-dashed border-white/[0.06]" />
          </>
        )}
      </button>
      <AnimatePresence>
        {tapped && cards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="flex items-center gap-2 text-xs md:text-sm text-text-secondary"
          >
            <span className="font-mono font-semibold">{cardNames.join(' + ')}</span>
            {hasHidden && <span className="text-text-tertiary">+ hidden</span>}
            <span className="text-text-tertiary">=</span>
            <span className="font-mono font-bold text-text-primary">{value}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PlayerHand({
  player,
  isCurrentUser,
  isCurrentTurn,
}: {
  player: BlackjackPlayer
  isCurrentUser: boolean
  isCurrentTurn: boolean
}) {
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center gap-3 md:gap-4 lg:gap-5 p-4 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl transition-colors',
        'min-w-[150px] md:min-w-[220px] lg:min-w-[260px]',
        isCurrentTurn
          ? 'ring-2 ring-accent/50 bg-accent/[0.04]'
          : 'bg-white/[0.02]',
      )}
      animate={isCurrentTurn ? {
        boxShadow: [
          '0 0 20px rgba(99,102,241,0)',
          '0 0 30px rgba(99,102,241,0.12)',
          '0 0 20px rgba(99,102,241,0)',
        ],
      } : undefined}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="flex items-center gap-2.5 md:gap-3">
        <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-sm md:text-base font-bold text-accent-light">
            {player.displayName?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm md:text-base font-semibold text-text-primary">
            {isCurrentUser ? 'You' : player.displayName}
          </span>
          <span className="text-[11px] md:text-xs text-text-tertiary">
            {formatChips(player.chips)} chips
          </span>
        </div>
        {player.result && (
          <span className={cn(
            'text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full',
            player.result === 'win' || player.result === 'blackjack'
              ? 'bg-emerald-500/15 text-emerald-400'
              : player.result === 'push'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-red-500/15 text-red-400',
          )}>
            {player.result === 'blackjack' ? 'BLACKJACK!' : player.result.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex gap-2.5 md:gap-3">
        {player.hand.cards.map((card, i) => (
          <PlayingCard
            key={`${player.id}-${i}`}
            card={card}
            faceUp={card.faceUp}
            size="md"
            dealing
            delay={i * 0.2}
          />
        ))}
        {player.hand.cards.length === 0 && (
          <div className="w-[4.25rem] h-[6.25rem] md:w-[5.5rem] md:h-[8rem] lg:w-[6rem] lg:h-[8.75rem] rounded-xl border-2 border-dashed border-white/[0.06]" />
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {player.hand.value > 0 && (
          <span className="text-sm md:text-lg font-mono font-bold text-text-primary">
            {player.hand.value}
          </span>
        )}
        {player.hand.bet > 0 && (
          <ChipStack amount={player.hand.bet} size="sm" />
        )}
        {player.payout && player.payout > 0 && player.result !== 'lose' && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs md:text-sm font-bold text-emerald-400"
          >
            +{formatChips(player.payout)}
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

interface BlackjackTableProps {
  wsRef: MutableRefObject<GameWebSocket | null>
}

export function BlackjackTable({ wsRef }: BlackjackTableProps) {
  const roomState = useGameStore((s) => s.roomState)
  const { user } = useAuthStore()

  const gameState = roomState?.gameState as BlackjackState | undefined
  const [betAmount, setBetAmount] = useState(gameState?.minimumBet || 50)
  const [showShuffle, setShowShuffle] = useState(false)
  const [shuffleSpeed, setShuffleSpeed] = useState<'slow' | 'fast'>('slow')
  const prevPhaseRef = useRef<string>('')
  const hasSeenFirstDeal = useRef(false)

  const currentPlayer = gameState?.players?.find((p) => p.id === user?.id) as BlackjackPlayer | undefined
  const isSpectating = gameState != null && gameState.phase !== 'waiting' && !currentPlayer
  const isMyTurn = gameState?.phase === 'playing' && gameState.currentPlayerIndex >= 0 &&
    gameState.players[gameState.currentPlayerIndex]?.id === user?.id

  const onShuffleComplete = useCallback(() => {
    setShowShuffle(false)
  }, [])

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    const curPhase = gameState?.phase || ''

    if (curPhase === 'betting' && prevPhase !== 'betting') {
      if (!hasSeenFirstDeal.current) {
        setShuffleSpeed('slow')
        hasSeenFirstDeal.current = true
      } else {
        setShuffleSpeed('fast')
      }
      setShowShuffle(true)
    }

    prevPhaseRef.current = curPhase
  }, [gameState?.phase])

  function send(type: string, payload?: Record<string, unknown>) {
    wsRef.current?.send(payload ? { type, payload } as any : { type } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  const phaseLabel: Record<string, string> = {
    betting: 'Place Your Bets',
    dealing: 'Dealing Cards...',
    playing: isMyTurn ? 'Your Turn' : 'Waiting for Player...',
    dealer_turn: 'Dealer is Playing',
    resolving: 'Results',
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

      {/* Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 md:px-10 lg:px-14 py-8 md:py-12 lg:py-16 gap-8 md:gap-12 lg:gap-16">
        {/* Dealer */}
        <DealerHand
          cards={gameState?.dealerHand || []}
          value={gameState?.dealerValue || 0}
          phase={gameState?.phase || 'waiting'}
        />

        {/* Phase Indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={gameState?.phase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="text-center"
          >
            <span className="text-sm md:text-base font-semibold text-accent-light uppercase tracking-widest">
              {phaseLabel[gameState?.phase || 'waiting'] || gameState?.phase}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Divider */}
        <div className="w-full max-w-2xl lg:max-w-4xl border-t border-white/[0.04]" />

        {/* Players */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 lg:gap-8 max-w-7xl w-full">
          {gameState?.players?.map((player, index) => (
            <PlayerHand
              key={player.id}
              player={player}
              isCurrentUser={player.id === user?.id}
              isCurrentTurn={gameState.phase === 'playing' && gameState.currentPlayerIndex === index}
            />
          ))}
        </div>
      </main>

      {/* Spectating Banner */}
      <AnimatePresence>
        {isSpectating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-2xl glass border border-amber-500/20 bg-amber-500/[0.06] shadow-xl"
          >
            <p className="text-sm font-semibold text-amber-400 text-center">
              You&apos;re out of chips — Spectating
            </p>
            <p className="text-[11px] text-amber-400/60 text-center mt-0.5">
              Chips will reset when all players are out
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Bar */}
      <div className="sticky bottom-0 glass border-t border-white/[0.04] p-4 md:p-6">
        <div className="max-w-xl lg:max-w-2xl mx-auto">
          {isSpectating && (
            <div className="text-center text-sm text-text-tertiary py-2">
              Watching the round...
            </div>
          )}

          {!isSpectating && gameState?.phase === 'betting' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Current bet display */}
              <div className="flex items-center justify-center gap-3">
                <Coins className="h-5 w-5 text-amber-400" />
                <span className="text-xl md:text-2xl font-mono font-bold text-text-primary">
                  {formatChips(betAmount)}
                </span>
              </div>

              {/* Chip buttons */}
              <div className="flex justify-center gap-2 md:gap-3">
                {[1, 2, 5, 10, 20].map((mult) => {
                  const val = gameState.minimumBet * mult
                  if (val > (currentPlayer?.chips || 0)) return null
                  const chipColor =
                    mult <= 1 ? 'from-blue-500 to-blue-700 border-blue-400/40'
                    : mult <= 2 ? 'from-emerald-500 to-emerald-700 border-emerald-400/40'
                    : mult <= 5 ? 'from-red-500 to-red-700 border-red-400/40'
                    : mult <= 10 ? 'from-purple-500 to-purple-700 border-purple-400/40'
                    : 'from-amber-500 to-amber-700 border-amber-400/40'
                  return (
                    <motion.button
                      key={mult}
                      onClick={() => setBetAmount(val)}
                      whileHover={{ scale: 1.1, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className={cn(
                        'w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-b border-2 flex items-center justify-center shadow-lg shadow-black/30',
                        chipColor,
                        betAmount === val && 'ring-2 ring-white/40 ring-offset-2 ring-offset-[#050507]',
                      )}
                    >
                      <div className="rounded-full border border-dashed border-white/30 w-[72%] h-[72%] flex items-center justify-center">
                        <span className="text-[10px] md:text-xs font-bold text-white drop-shadow">
                          {formatChips(val)}
                        </span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* Custom amount slider (collapsed by default) */}
              <details className="group">
                <summary className="text-center text-xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors">
                  Custom amount
                </summary>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="range"
                    min={gameState.minimumBet}
                    max={currentPlayer?.chips || 1000}
                    step={gameState.minimumBet}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="flex-1 accent-accent h-2"
                  />
                </div>
              </details>

              {/* Place bet */}
              <AnimatedButton
                className="w-full"
                onClick={() => send('bj_place_bet', { amount: betAmount })}
              >
                Place Bet — {formatChips(betAmount)}
              </AnimatedButton>
            </motion.div>
          )}

          {!isSpectating && gameState?.phase === 'playing' && isMyTurn && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 md:gap-4"
            >
              <AnimatedButton
                className="flex-1 text-sm md:text-base py-3"
                onClick={() => send('bj_hit')}
              >
                Hit
              </AnimatedButton>
              <AnimatedButton
                variant="secondary"
                className="flex-1 text-sm md:text-base py-3"
                onClick={() => send('bj_stand')}
              >
                Stand
              </AnimatedButton>
              {currentPlayer?.hand.cards.length === 2 && (
                <AnimatedButton
                  variant="ghost"
                  className="flex-1 text-sm md:text-base"
                  onClick={() => send('bj_double')}
                  disabled={(currentPlayer?.chips || 0) < (currentPlayer?.hand.bet || 0)}
                >
                  Double
                </AnimatedButton>
              )}
            </motion.div>
          )}

          {!isSpectating && (gameState?.phase === 'waiting' || gameState?.phase === 'complete') && (
            <div className="text-center text-sm md:text-base text-text-tertiary py-2">
              {gameState.phase === 'complete' ? 'Next round starting...' : 'Waiting for game to start'}
            </div>
          )}

          {!isSpectating && gameState?.phase === 'playing' && !isMyTurn && (
            <div className="text-center text-sm md:text-base text-text-tertiary py-2">
              Waiting for other player...
            </div>
          )}

          {!isSpectating && (gameState?.phase === 'dealer_turn' || gameState?.phase === 'dealing' || gameState?.phase === 'resolving') && (
            <div className="text-center text-sm md:text-base text-text-tertiary py-2">
              {phaseLabel[gameState.phase]}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
