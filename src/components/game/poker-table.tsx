'use client'

import { type MutableRefObject, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import {
  AnimatedButton,
  GlassPanel,
  PlayingCard,
  ChipStack,
  RoomCodeBadge,
  StatusPill,
  PremiumInput,
  DeckShuffle,
} from '@/components/ui'
import { ArrowLeft, Coins, TrendingUp, HelpCircle, X } from 'lucide-react'
import Link from 'next/link'
import type { PokerState, PokerPlayer, Card } from '@/types'
import { cn, formatChips } from '@/lib/utils'
import { evaluatePlayerHand, describeHoleCards } from '@/lib/poker-eval'
import type { GameWebSocket } from '@/lib/websocket/client'

function CommunityCards({ cards, phase }: { cards: Card[]; phase: string }) {
  const phaseNames: Record<string, string> = {
    preflop: 'Pre-Flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
    complete: 'Complete',
    waiting: 'Waiting',
  }

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <span className="text-xs md:text-sm font-semibold text-text-tertiary uppercase tracking-widest">
        {phaseNames[phase] || phase}
      </span>
      <div className="flex gap-2.5 md:gap-3.5 lg:gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            {cards[i] ? (
              <PlayingCard card={cards[i]} faceUp size="md" dealing delay={i * 0.18} />
            ) : (
              <div className="w-[4.25rem] h-[6.25rem] md:w-[5.5rem] md:h-[8rem] lg:w-[6rem] lg:h-[8.75rem] rounded-xl border-2 border-dashed border-white/[0.05] bg-white/[0.01]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface HandRank {
  name: string
  desc: string
  cards: { rank: string; suit: '♠' | '♥' | '♦' | '♣' }[]
}

const HAND_RANKINGS: HandRank[] = [
  { name: 'Royal Flush', desc: 'The best hand possible. A, K, Q, J, 10 all of the same suit.', cards: [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }, { rank: 'Q', suit: '♠' }, { rank: 'J', suit: '♠' }, { rank: '10', suit: '♠' }] },
  { name: 'Straight Flush', desc: 'Five cards in sequential order, all of the same suit.', cards: [{ rank: '9', suit: '♥' }, { rank: '8', suit: '♥' }, { rank: '7', suit: '♥' }, { rank: '6', suit: '♥' }, { rank: '5', suit: '♥' }] },
  { name: 'Four of a Kind', desc: 'Four cards of the same rank. The fifth card is a kicker.', cards: [{ rank: 'K', suit: '♣' }, { rank: 'K', suit: '♦' }, { rank: 'K', suit: '♥' }, { rank: 'K', suit: '♠' }, { rank: '3', suit: '♦' }] },
  { name: 'Full House', desc: 'Three of a kind combined with a pair. Ties go to the higher three.', cards: [{ rank: 'J', suit: '♠' }, { rank: 'J', suit: '♥' }, { rank: 'J', suit: '♦' }, { rank: '8', suit: '♣' }, { rank: '8', suit: '♠' }] },
  { name: 'Flush', desc: 'Any five cards of the same suit, not in sequence. Highest card wins ties.', cards: [{ rank: 'A', suit: '♦' }, { rank: 'J', suit: '♦' }, { rank: '8', suit: '♦' }, { rank: '5', suit: '♦' }, { rank: '2', suit: '♦' }] },
  { name: 'Straight', desc: 'Five cards in sequential order, any mix of suits. Ace can be high or low.', cards: [{ rank: '10', suit: '♣' }, { rank: '9', suit: '♦' }, { rank: '8', suit: '♠' }, { rank: '7', suit: '♥' }, { rank: '6', suit: '♣' }] },
  { name: 'Three of a Kind', desc: 'Three cards of the same rank. Remaining two are kickers.', cards: [{ rank: '7', suit: '♠' }, { rank: '7', suit: '♥' }, { rank: '7', suit: '♦' }, { rank: 'K', suit: '♣' }, { rank: '2', suit: '♠' }] },
  { name: 'Two Pair', desc: 'Two different pairs. The fifth card is a kicker for tiebreakers.', cards: [{ rank: 'A', suit: '♣' }, { rank: 'A', suit: '♦' }, { rank: '9', suit: '♠' }, { rank: '9', suit: '♥' }, { rank: '4', suit: '♦' }] },
  { name: 'Pair', desc: 'Two cards of the same rank. Higher pair wins. Kickers break ties.', cards: [{ rank: '10', suit: '♥' }, { rank: '10', suit: '♠' }, { rank: 'K', suit: '♦' }, { rank: '7', suit: '♣' }, { rank: '3', suit: '♠' }] },
  { name: 'High Card', desc: 'No matching cards. The highest card plays. If tied, next highest decides.', cards: [{ rank: 'A', suit: '♠' }, { rank: 'J', suit: '♦' }, { rank: '8', suit: '♣' }, { rank: '5', suit: '♥' }, { rank: '2', suit: '♠' }] },
]

function MiniCard({ rank, suit }: { rank: string; suit: '♠' | '♥' | '♦' | '♣' }) {
  const red = suit === '♥' || suit === '♦'
  return (
    <div className={cn(
      'w-7 h-10 md:w-8 md:h-11 rounded-[4px] md:rounded-md flex flex-col items-center justify-center gap-0',
      'bg-gradient-to-br from-[#1c1c30] to-[#121220] border border-white/[0.1]',
      'shadow-sm',
    )}>
      <span className={cn('text-[9px] md:text-[10px] font-bold leading-none', red ? 'text-red-400' : 'text-white/80')}>{rank}</span>
      <span className={cn('text-[8px] md:text-[9px] leading-none', red ? 'text-red-400' : 'text-white/60')}>{suit}</span>
    </div>
  )
}

function HandRankingsPanel({ open, onClose, playerHandRank }: { open: boolean; onClose: () => void; playerHandRank?: string }) {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md glass rounded-t-2xl md:rounded-2xl overflow-hidden"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Hand Rankings</h3>
                <p className="text-[11px] text-text-tertiary mt-0.5">Best to worst, top to bottom</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-tertiary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {playerHandRank && (
              <div className="px-5 py-3 bg-accent/[0.06] border-b border-accent/10">
                <p className="text-[11px] text-accent-light font-medium">
                  You have: <span className="font-bold">{playerHandRank}</span>
                </p>
              </div>
            )}

            <div className="px-3 py-3 space-y-1 max-h-[65vh] overflow-y-auto">
              {HAND_RANKINGS.map((h, i) => {
                const isYours = playerHandRank ? normalise(h.name) === normalise(playerHandRank) : false
                return (
                  <div
                    key={h.name}
                    className={cn(
                      'px-3 py-3 rounded-xl transition-colors',
                      isYours
                        ? 'bg-accent/[0.08] ring-1 ring-accent/30'
                        : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                        isYours ? 'bg-accent/30 text-accent-light' : 'bg-white/[0.06] text-text-tertiary',
                      )}>
                        {i + 1}
                      </span>
                      <span className={cn(
                        'text-xs font-semibold',
                        isYours ? 'text-accent-light' : 'text-text-primary',
                      )}>
                        {h.name}
                      </span>
                      {isYours && (
                        <span className="text-[9px] font-bold text-accent-light bg-accent/15 px-2 py-0.5 rounded-full ml-auto">
                          YOUR HAND
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mb-2 ml-7">
                      {h.cards.map((c, ci) => (
                        <MiniCard key={ci} rank={c.rank} suit={c.suit} />
                      ))}
                    </div>
                    <p className="text-[10px] md:text-[11px] text-text-tertiary ml-7 leading-relaxed">{h.desc}</p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PokerSeat({
  player,
  isCurrentUser,
  isCurrentTurn,
  isDealer,
}: {
  player: PokerPlayer
  isCurrentUser: boolean
  isCurrentTurn: boolean
  isDealer: boolean
}) {
  return (
    <motion.div
      className={cn(
        'relative flex flex-col items-center gap-2 md:gap-4 lg:gap-5 p-3 md:p-5 lg:p-6 rounded-xl md:rounded-3xl',
        'w-[calc(50%-0.75rem)] md:w-auto md:min-w-[200px] lg:min-w-[230px]',
        'transition-colors',
        isCurrentTurn
          ? 'ring-2 ring-accent/50 bg-accent/[0.04]'
          : player.isFolded
            ? 'opacity-40'
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
      {/* Avatar + Name */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs md:text-base font-bold text-accent-light">
            {player.displayName?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs md:text-base font-semibold text-text-primary truncate">
            {isCurrentUser ? 'You' : player.displayName}
          </p>
          <p className="text-[10px] md:text-xs text-text-tertiary font-mono">{formatChips(player.chips)}</p>
        </div>
      </div>

      {/* Hole cards */}
      <div className="flex gap-2 md:gap-2.5">
        {player.hand?.map((card, i) => (
          <PlayingCard
            key={`${player.id}-${i}`}
            card={card}
            faceUp={isCurrentUser || card.faceUp}
            size="sm"
            dealing
            delay={i * 0.2}
          />
        ))}
        {(!player.hand || player.hand.length === 0) && (
          <>
            <div className="w-[3.25rem] h-[4.75rem] md:w-[4rem] md:h-[5.75rem] rounded-lg md:rounded-xl border-2 border-dashed border-white/[0.05]" />
            <div className="w-[3.25rem] h-[4.75rem] md:w-[4rem] md:h-[5.75rem] rounded-lg md:rounded-xl border-2 border-dashed border-white/[0.05]" />
          </>
        )}
      </div>

      {/* Bet / status */}
      {player.currentBet > 0 && (
        <ChipStack amount={player.currentBet} size="sm" />
      )}
      {player.isFolded && (
        <span className="text-[10px] md:text-xs text-red-400 font-semibold uppercase tracking-wider">Folded</span>
      )}
      {player.isAllIn && (
        <span className="text-[10px] md:text-xs text-amber-400 font-bold uppercase tracking-wider">All In</span>
      )}
      {player.handRank && (
        <span className="text-[10px] md:text-xs text-accent-light font-semibold">{player.handRank}</span>
      )}
      {player.result && player.winnings && player.winnings > 0 && (
        <motion.span
          initial={{ opacity: 0, y: 5, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="text-xs md:text-sm text-emerald-400 font-bold"
        >
          +{formatChips(player.winnings)}
        </motion.span>
      )}
    </motion.div>
  )
}

interface PokerTableProps {
  wsRef: MutableRefObject<GameWebSocket | null>
}

export function PokerTable({ wsRef }: PokerTableProps) {
  const roomState = useGameStore((s) => s.roomState)
  const { user } = useAuthStore()
  const { addToast } = useUIStore()

  const gameState = roomState?.gameState as PokerState | undefined
  const [raiseAmount, setRaiseAmount] = useState('')
  const [showRaiseInput, setShowRaiseInput] = useState(false)
  const [showHandRankings, setShowHandRankings] = useState(false)
  const [showShuffle, setShowShuffle] = useState(false)
  const [shuffleSpeed, setShuffleSpeed] = useState<'slow' | 'fast'>('slow')
  const prevPhaseRef = useRef<string>('')
  const hasSeenFirstDeal = useRef(false)

  const currentPlayer = gameState?.players?.find((p) => p.id === user?.id) as PokerPlayer | undefined
  const isSpectating = gameState != null && gameState.phase !== 'waiting' && !currentPlayer
  const currentIdx = gameState?.currentPlayerIndex ?? -1
  const isMyTurn = gameState != null &&
    gameState.phase !== 'waiting' && gameState.phase !== 'showdown' &&
    gameState.phase !== 'complete' && currentIdx >= 0 &&
    gameState.players?.[currentIdx]?.id === user?.id

  const playerHandRank = useMemo(() => {
    if (!currentPlayer || currentPlayer.isFolded) return undefined
    if (currentPlayer.handRank) return currentPlayer.handRank

    const holeCards = currentPlayer.hand?.filter((c) => c.faceUp) ?? []
    const communityCards = gameState?.communityCards?.filter((c) => c.faceUp) ?? []

    if (holeCards.length + communityCards.length >= 5) {
      const result = evaluatePlayerHand(holeCards, communityCards)
      return result?.name ?? undefined
    }

    if (holeCards.length === 2) {
      return describeHoleCards(holeCards) ?? undefined
    }

    return undefined
  }, [currentPlayer, gameState?.communityCards])

  const currentBetToMatch = gameState?.players?.reduce(
    (max, p) => Math.max(max, p.currentBet), 0
  ) || 0
  const needToCall = currentBetToMatch - (currentPlayer?.currentBet || 0)
  const canCheck = needToCall === 0

  const onShuffleComplete = useCallback(() => {
    setShowShuffle(false)
  }, [])

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    const curPhase = gameState?.phase || ''

    if (curPhase === 'preflop' && prevPhase !== 'preflop') {
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

  function handleRaise() {
    const amount = parseInt(raiseAmount)
    if (isNaN(amount) || amount < (gameState?.minimumRaise || 0)) {
      addToast({ type: 'error', title: `Minimum raise: ${gameState?.minimumRaise}` })
      return
    }
    send('pk_raise', { amount })
    setShowRaiseInput(false)
    setRaiseAmount('')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-transparent via-emerald-950/[0.03] to-transparent">
      <DeckShuffle show={showShuffle} speed={shuffleSpeed} onComplete={onShuffleComplete} />
      <HandRankingsPanel open={showHandRankings} onClose={() => setShowHandRankings(false)} playerHandRank={playerHandRank} />
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
            <RoomCodeBadge code={roomState?.roomCode || ''} />
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <button
              onClick={() => setShowHandRankings(true)}
              className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-text-tertiary hover:text-text-secondary"
              title="Hand Rankings"
            >
              <HelpCircle className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-text-secondary">
              <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-400" />
              <span>Pot: <strong className="text-text-primary font-mono">{formatChips(gameState?.pot || 0)}</strong></span>
            </div>
            {currentPlayer && (
              <div className="hidden md:flex items-center gap-2 text-sm text-text-secondary">
                <span>Chips: <strong className="text-text-primary font-mono">{formatChips(currentPlayer.chips)}</strong></span>
              </div>
            )}
            <StatusPill status="playing" label={gameState?.phase || 'waiting'} />
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 md:px-10 lg:px-14 py-6 md:py-12 lg:py-16 gap-5 md:gap-12 lg:gap-14">
        {/* Community Cards */}
        <CommunityCards cards={gameState?.communityCards || []} phase={gameState?.phase || 'waiting'} />

        {/* Pot Display */}
        <GlassPanel className="px-6 md:px-10 py-3 md:py-4 inline-flex items-center gap-3 md:gap-4">
          <Coins className="h-5 w-5 md:h-6 md:w-6 text-amber-400" />
          <span className="text-lg md:text-2xl font-bold font-mono text-text-primary">
            {formatChips(gameState?.pot || 0)}
          </span>
          {(gameState?.sidePots?.length || 0) > 0 && (
            <span className="text-xs md:text-sm text-text-tertiary">
              +{gameState?.sidePots?.length} side pot{(gameState?.sidePots?.length || 0) > 1 ? 's' : ''}
            </span>
          )}
        </GlassPanel>

        {/* Divider */}
        <div className="w-full max-w-2xl lg:max-w-5xl border-t border-white/[0.04]" />

        {/* Player Seats */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-6 lg:gap-8 max-w-7xl w-full px-1 md:px-0">
          {gameState?.players?.map((player) => (
            <PokerSeat
              key={player.id}
              player={player}
              isCurrentUser={player.id === user?.id}
              isCurrentTurn={currentIdx >= 0 && gameState.players[currentIdx]?.id === player.id}
              isDealer={player.isDealer}
            />
          ))}
        </div>

        {/* Last Action */}
        <AnimatePresence mode="wait">
          {gameState?.lastAction && (
            <motion.div
              key={`${gameState.lastAction.playerId}-${gameState.lastAction.action}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm md:text-base text-text-tertiary"
            >
              {gameState.players.find((p) => p.id === gameState.lastAction?.playerId)?.displayName}{' '}
              <span className="text-text-secondary font-semibold">{gameState.lastAction.action}</span>
              {gameState.lastAction.amount ? ` ${formatChips(gameState.lastAction.amount)}` : ''}
            </motion.div>
          )}
        </AnimatePresence>
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
              Watching the hand...
            </div>
          )}

          {!isSpectating && isMyTurn && !currentPlayer?.isFolded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {showRaiseInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex gap-3"
                >
                  <PremiumInput
                    type="number"
                    placeholder={`Min: ${gameState?.minimumRaise}`}
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(e.target.value)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    min={gameState?.minimumRaise}
                    max={currentPlayer?.chips}
                  />
                  <AnimatedButton size="sm" onClick={handleRaise}>
                    Confirm
                  </AnimatedButton>
                  <AnimatedButton size="sm" variant="ghost" onClick={() => setShowRaiseInput(false)}>
                    Cancel
                  </AnimatedButton>
                </motion.div>
              )}

              <div className="flex gap-3 md:gap-4">
                <AnimatedButton
                  variant="danger"
                  className="flex-1 text-sm md:text-base py-3"
                  onClick={() => send('pk_fold')}
                >
                  Fold
                </AnimatedButton>

                {canCheck ? (
                  <AnimatedButton
                    variant="secondary"
                    className="flex-1 text-sm md:text-base py-3"
                    onClick={() => send('pk_check')}
                  >
                    Check
                  </AnimatedButton>
                ) : (
                  <AnimatedButton
                    variant="secondary"
                    className="flex-1 text-sm md:text-base py-3"
                    onClick={() => send('pk_call')}
                  >
                    Call {formatChips(needToCall)}
                  </AnimatedButton>
                )}

                <AnimatedButton
                  className="flex-1 text-sm md:text-base py-3"
                  onClick={() => setShowRaiseInput(!showRaiseInput)}
                  icon={<TrendingUp className="h-4 w-4" />}
                >
                  Raise
                </AnimatedButton>

                <AnimatedButton
                  variant="ghost"
                  className="flex-shrink-0 text-sm md:text-base py-3"
                  onClick={() => send('pk_all_in')}
                >
                  All In
                </AnimatedButton>
              </div>
            </motion.div>
          )}

          {!isSpectating && !isMyTurn && gameState?.phase !== 'waiting' && gameState?.phase !== 'complete' && gameState?.phase !== 'showdown' && (
            <div className="text-center text-sm md:text-base text-text-tertiary py-2">
              {currentPlayer?.isFolded ? 'You folded this round' : 'Waiting for your turn...'}
            </div>
          )}

          {!isSpectating && (gameState?.phase === 'waiting' || gameState?.phase === 'complete' || gameState?.phase === 'showdown') && (
            <div className="text-center text-sm md:text-base text-text-tertiary py-2">
              {gameState.phase === 'showdown' ? 'Showdown!' : gameState.phase === 'complete' ? 'Next hand starting...' : 'Waiting for game to start'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
