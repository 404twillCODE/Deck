'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import { AnimatedButton, DeckShuffle } from '@/components/ui'
import { ArrowLeft, RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { UnoState, UnoCard, UnoColor } from '@/types'
import type { GameWebSocket } from '@/lib/websocket/client'

interface UnoTableProps {
  wsRef: React.MutableRefObject<GameWebSocket | null>
}

const UNO_COLORS: Record<string, { bg: string; dark: string; ring: string; text: string }> = {
  red:    { bg: 'bg-red-500',     dark: 'bg-red-600',     ring: 'ring-red-400',     text: 'text-red-500' },
  yellow: { bg: 'bg-amber-400',   dark: 'bg-amber-500',   ring: 'ring-amber-300',   text: 'text-amber-400' },
  green:  { bg: 'bg-emerald-500', dark: 'bg-emerald-600', ring: 'ring-emerald-400', text: 'text-emerald-500' },
  blue:   { bg: 'bg-blue-500',    dark: 'bg-blue-600',    ring: 'ring-blue-400',    text: 'text-blue-500' },
}

function cardSymbol(card: UnoCard): string {
  switch (card.type) {
    case 'number': return String(card.value ?? 0)
    case 'skip': return '\u{20E0}'
    case 'reverse': return '\u{21BB}'
    case 'draw_two': return '+2'
    case 'wild': return '\u{2B50}'
    case 'wild_draw_four': return '+4'
    default: return '?'
  }
}

function UnoCardView({ card, onClick, disabled, small, faceDown }: {
  card: UnoCard
  onClick?: () => void
  disabled?: boolean
  small?: boolean
  faceDown?: boolean
}) {
  const isWild = card.type === 'wild' || card.type === 'wild_draw_four'
  const colorKey = card.color || 'red'
  const colors = UNO_COLORS[colorKey]
  const sym = cardSymbol(card)

  const w = small ? 'w-[52px]' : 'w-[62px] sm:w-[72px]'
  const h = small ? 'h-[76px]' : 'h-[90px] sm:h-[104px]'

  if (faceDown) {
    return (
      <div className={cn(w, h, 'rounded-xl bg-gray-900 border-2 border-gray-700 shadow-lg relative overflow-hidden select-none flex-shrink-0')}>
        <div className="absolute inset-[3px] rounded-lg border border-gray-600 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="w-[60%] h-[40%] rounded-full border border-gray-600 bg-gray-800 flex items-center justify-center">
            <span className="text-gray-600 font-black text-xs">UNO</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        w, h,
        'rounded-xl shadow-lg relative overflow-hidden select-none flex-shrink-0 border-2',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        isWild && !card.color
          ? 'bg-gray-900 border-gray-600'
          : `${colors?.bg} ${colors?.ring ? colors.ring.replace('ring', 'border') : 'border-white/20'}`,
      )}
      whileHover={disabled ? {} : { y: -12, scale: 1.08, zIndex: 50 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      layout
    >
      {/* Inner card face */}
      <div className="absolute inset-[3px] rounded-lg overflow-hidden flex flex-col">
        {/* Background */}
        <div className={cn(
          'absolute inset-0',
          isWild && !card.color
            ? 'bg-gradient-to-br from-gray-800 to-gray-900'
            : `${colors?.bg}`,
        )} />

        {/* Top-left corner */}
        <div className="absolute top-1 left-1.5 z-10">
          <span className={cn(
            'font-black leading-none drop-shadow-md',
            small ? 'text-[9px]' : 'text-[11px]',
            'text-white',
          )}>{sym}</span>
        </div>

        {/* Center oval */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className={cn(
            'bg-white rounded-[50%] flex items-center justify-center shadow-inner',
            small ? 'w-[70%] h-[50%] rotate-[25deg]' : 'w-[72%] h-[52%] rotate-[30deg]',
          )}>
            <span className={cn(
              'font-black drop-shadow-sm',
              small ? '-rotate-[25deg] text-lg' : '-rotate-[30deg] text-xl sm:text-2xl',
              isWild && !card.color ? 'text-gray-900' : (colors?.text || 'text-gray-900'),
            )}>
              {sym}
            </span>
          </div>
        </div>

        {/* Bottom-right corner (inverted) */}
        <div className="absolute bottom-1 right-1.5 rotate-180 z-10">
          <span className={cn(
            'font-black leading-none drop-shadow-md',
            small ? 'text-[9px]' : 'text-[11px]',
            'text-white',
          )}>{sym}</span>
        </div>

        {/* Wild card quadrant colors */}
        {isWild && !card.color && (
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-red-500/30" />
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-500/30" />
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-amber-400/30" />
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-emerald-500/30" />
          </div>
        )}
      </div>
    </motion.button>
  )
}

function ColorChooser({ onChoose }: { onChoose: (color: UnoColor) => void }) {
  const options: { color: UnoColor; bg: string; label: string }[] = [
    { color: 'red', bg: 'bg-red-500 hover:bg-red-400', label: 'Red' },
    { color: 'yellow', bg: 'bg-amber-400 hover:bg-amber-300', label: 'Yellow' },
    { color: 'green', bg: 'bg-emerald-500 hover:bg-emerald-400', label: 'Green' },
    { color: 'blue', bg: 'bg-blue-500 hover:bg-blue-400', label: 'Blue' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="glass rounded-3xl p-8 max-w-sm w-full mx-4">
        <h3 className="text-xl font-bold text-text-primary text-center mb-6">Choose a Color</h3>
        <div className="grid grid-cols-2 gap-4">
          {options.map((o) => (
            <button
              key={o.color}
              onClick={() => onChoose(o.color)}
              className={`${o.bg} rounded-2xl py-6 text-white font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function UnoTable({ wsRef }: UnoTableProps) {
  const roomState = useGameStore((s) => s.roomState)
  const { user } = useAuthStore()
  const [choosingColor, setChoosingColor] = useState<string | null>(null)

  const [showShuffle, setShowShuffle] = useState(false)
  const [shuffleSpeed, setShuffleSpeed] = useState<'slow' | 'fast'>('slow')
  const prevRoundRef = useRef(0)
  const hasSeenFirstRound = useRef(false)

  const gameState = roomState?.gameState as UnoState | undefined
  const myPlayer = gameState?.players.find((p) => p.id === user?.id)
  const myCards: UnoCard[] = myPlayer?.cards ?? []
  const isMyTurn = gameState ? gameState.players[gameState.currentPlayerIndex]?.id === user?.id : false
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex]

  useEffect(() => {
    if (!gameState) return
    const round = gameState.roundNumber
    if (round !== prevRoundRef.current && round > 0) {
      if (!hasSeenFirstRound.current) {
        setShuffleSpeed('slow')
        hasSeenFirstRound.current = true
      } else {
        setShuffleSpeed('fast')
      }
      setShowShuffle(true)
      prevRoundRef.current = round
    }
  }, [gameState?.roundNumber, gameState])

  const onShuffleComplete = useCallback(() => setShowShuffle(false), [])

  const canPlayCard = useCallback(
    (card: UnoCard) => {
      if (!gameState || !isMyTurn) return false
      if (gameState.pendingDrawType === 'draw_two') return card.type === 'draw_two' || card.type === 'wild_draw_four'
      if (gameState.pendingDrawType === 'wild_draw_four') return card.type === 'wild_draw_four'
      if (card.type === 'wild' || card.type === 'wild_draw_four') return true
      if (card.color === gameState.currentColor) return true
      const top = gameState.discardTop
      if (card.type === 'number' && top?.type === 'number' && card.value === top.value) return true
      if (card.type !== 'number' && top && card.type === top.type) return true
      return false
    },
    [gameState, isMyTurn],
  )

  function handlePlayCard(card: UnoCard) {
    if (!canPlayCard(card)) return
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      setChoosingColor(card.id)
      return
    }
    wsRef.current?.send({ type: 'uno_play_card', payload: { cardId: card.id } })
  }

  function handleChooseColor(color: UnoColor) {
    if (!choosingColor) return
    wsRef.current?.send({ type: 'uno_play_card', payload: { cardId: choosingColor, chosenColor: color } })
    setChoosingColor(null)
  }

  if (!gameState) return null

  const otherPlayers = gameState.players.filter((p) => p.id !== user?.id)
  const hasPending = gameState.pendingDraw > 0
  const canEndTurn = isMyTurn && gameState.hasDrawnThisTurn && !hasPending
  const canDraw = isMyTurn && (hasPending || !gameState.hasDrawnThisTurn || gameState.hasDrawnThisTurn)
  const drawLabel = hasPending ? `Draw ${gameState.pendingDraw}` : 'Draw'

  return (
    <div className="min-h-dvh flex flex-col">
      <DeckShuffle show={showShuffle} speed={shuffleSpeed} onComplete={onShuffleComplete} />

      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-sm font-semibold text-text-primary">UNO</span>
            <span className="text-xs text-text-tertiary">Round {gameState.roundNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            {gameState.direction === 1 ? (
              <RotateCw className="h-4 w-4 text-text-tertiary" />
            ) : (
              <RotateCcw className="h-4 w-4 text-text-tertiary" />
            )}
            <div className={cn('w-3 h-3 rounded-full', UNO_COLORS[gameState.currentColor]?.bg)} />
            <span className="text-xs text-text-tertiary">{currentPlayer?.displayName}&apos;s turn</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col p-4 max-w-5xl mx-auto w-full">
        {/* Opponents */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {otherPlayers.map((p) => {
            const isTurn = gameState.players[gameState.currentPlayerIndex]?.id === p.id
            return (
              <div
                key={p.id}
                className={cn(
                  'glass rounded-xl px-4 py-3 text-center relative min-w-[100px] transition-all',
                  isTurn && 'ring-2 ring-accent-light',
                )}
              >
                <p className="text-sm font-medium text-text-primary">{p.displayName}</p>
                <p className="text-xs text-text-secondary">{p.cardCount} card{p.cardCount !== 1 ? 's' : ''}</p>
                {p.hasCalledUno && p.cardCount === 1 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                    UNO!
                  </span>
                )}
                {p.canBeChallenged && p.id !== user?.id && (
                  <button
                    onClick={() => wsRef.current?.send({ type: 'uno_challenge_uno', payload: { targetPlayerId: p.id } })}
                    className="mt-1 text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full hover:bg-red-500/30 transition-colors font-medium"
                  >
                    Catch!
                  </button>
                )}
                <div className="flex justify-center gap-0.5 mt-2">
                  {Array.from({ length: Math.min(p.cardCount, 10) }).map((_, i) => (
                    <div key={i} className="w-2.5 h-3.5 rounded-sm bg-white/10 border border-white/[0.06]" />
                  ))}
                  {p.cardCount > 10 && <span className="text-[10px] text-text-tertiary ml-1">+{p.cardCount - 10}</span>}
                </div>
                <p className="text-[10px] text-text-tertiary mt-1">{p.score} pts</p>
              </div>
            )
          })}
        </div>

        {/* Pending draw stack warning */}
        <AnimatePresence>
          {isMyTurn && hasPending && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-center"
            >
              <p className="text-sm font-bold text-red-400">
                {gameState.pendingDrawType === 'draw_two'
                  ? `Stack a +2 or +4, or draw ${gameState.pendingDraw} cards!`
                  : `Stack a +4 or draw ${gameState.pendingDraw} cards!`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: draw + discard */}
        <div className="flex-1 flex items-center justify-center gap-8 mb-6">
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={() => wsRef.current?.send({ type: 'uno_draw' })}
              disabled={!canDraw}
              className={cn(
                'relative',
                canDraw ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
              )}
              whileHover={canDraw ? { scale: 1.05 } : {}}
              whileTap={canDraw ? { scale: 0.95 } : {}}
            >
              <UnoCardView
                card={{ id: 'draw', color: null, type: 'wild', value: undefined }}
                disabled
                faceDown
              />
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/40">
                {gameState.drawPileCount}
              </span>
            </motion.button>
            {isMyTurn && (
              <span className={cn(
                'text-xs font-semibold px-3 py-1 rounded-full',
                hasPending ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-text-tertiary',
              )}>
                {drawLabel}
              </span>
            )}
          </div>

          <div className="relative">
            {gameState.discardTop && <UnoCardView card={gameState.discardTop} disabled />}
            <div
              className={cn(
                'absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-[#0a0a14] shadow-lg',
                UNO_COLORS[gameState.currentColor]?.bg,
              )}
            />
          </div>
        </div>

        {/* Win overlay */}
        <AnimatePresence>
          {gameState.phase === 'complete' && gameState.winnerId && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-2xl p-6 text-center mb-6">
              <h3 className="text-xl font-bold text-gradient mb-2">
                {gameState.winnerId === user?.id
                  ? 'You Win!'
                  : `${gameState.players.find((p) => p.id === gameState.winnerId)?.displayName} Wins!`}
              </h3>
              <p className="text-text-secondary text-sm mb-3">Next round starting soon...</p>
              <div className="flex justify-center gap-4">
                {gameState.players.map((p) => (
                  <div key={p.id} className="text-center">
                    <p className="text-xs text-text-tertiary">{p.displayName}</p>
                    <p className="text-sm font-bold text-text-primary">{p.score} pts</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My hand */}
        <div className="pb-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <p className="text-sm font-medium text-text-secondary">
              Your Hand ({myCards.length})
              {isMyTurn && <span className="ml-2 text-accent-light text-xs font-semibold animate-pulse">Your turn!</span>}
            </p>
            {myPlayer && myCards.length <= 2 && myCards.length > 0 && !myPlayer.hasCalledUno && (
              <button
                onClick={() => wsRef.current?.send({ type: 'uno_call_uno' })}
                className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-400 transition-colors shadow-lg animate-bounce"
              >
                UNO!
              </button>
            )}
            {canEndTurn && (
              <AnimatedButton size="sm" variant="secondary" onClick={() => wsRef.current?.send({ type: 'uno_pass' })}>
                End Turn
              </AnimatedButton>
            )}
            {myPlayer?.score ? <span className="text-xs text-text-tertiary ml-auto">{myPlayer.score} pts</span> : null}
          </div>

          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-2 justify-center flex-wrap">
            <AnimatePresence mode="popLayout">
              {myCards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.8 }}
                >
                  <UnoCardView
                    card={card}
                    onClick={() => handlePlayCard(card)}
                    disabled={!canPlayCard(card)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>{choosingColor && <ColorChooser onChoose={handleChooseColor} />}</AnimatePresence>
    </div>
  )
}
