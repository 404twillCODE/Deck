'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AnimatedButton, GlassPanel, PremiumInput } from '@/components/ui'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { generateRoomCode } from '@/lib/utils'
import { ArrowLeft, CircleDot, Spade, Palette, Flame, Users, Coins, Layers, Trophy, CreditCard } from 'lucide-react'
import Link from 'next/link'
import type { GameType } from '@/types'

function CreateRoomContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useUIStore()
  const { user, isGuest } = useAuthStore()

  if (isGuest) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <GlassPanel className="p-8 text-center max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Guests can&apos;t host</h2>
          <p className="text-sm text-text-secondary">
            Create an account to host your own game rooms. You can still join games with a room code.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <AnimatedButton href="/signup">Sign Up</AnimatedButton>
            <AnimatedButton href="/" variant="ghost">Back</AnimatedButton>
          </div>
        </GlassPanel>
      </div>
    )
  }

  const initialGame = (searchParams.get('game') as GameType) || 'blackjack'
  const [gameType, setGameType] = useState<GameType>(initialGame)
  const [maxPlayers, setMaxPlayers] = useState(
    initialGame === 'poker' ? '6' : initialGame === 'uno' ? '4' : initialGame === 'hot-potato' ? '8' : '5',
  )
  const [startingChips, setStartingChips] = useState('10000')
  const [minimumBet, setMinimumBet] = useState(initialGame === 'poker' ? '100' : '50')
  const [cardsPerPlayer, setCardsPerPlayer] = useState('7')
  const [scoreToWin, setScoreToWin] = useState('500')
  const [deckCount, setDeckCount] = useState(initialGame === 'blackjack' ? '6' : '1')

  function selectGame(type: GameType) {
    setGameType(type)
    if (type === 'blackjack') { setMaxPlayers('5'); setMinimumBet('50'); setStartingChips('10000'); setDeckCount('6') }
    if (type === 'poker') { setMaxPlayers('6'); setMinimumBet('100'); setStartingChips('10000'); setDeckCount('1') }
    if (type === 'uno') { setMaxPlayers('4'); setCardsPerPlayer('7'); setScoreToWin('500') }
    if (type === 'hot-potato') { setMaxPlayers('8') }
  }
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    const code = generateRoomCode()

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const hostId = authUser?.id || user?.id || ''

      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }
      const settings: Record<string, unknown> = {
        code,
        gameType,
        hostId,
        maxPlayers: parseInt(maxPlayers),
      }

      if (gameType === 'blackjack') {
        settings.startingChips = parseInt(startingChips)
        settings.minimumBet = parseInt(minimumBet)
        settings.deckCount = parseInt(deckCount)
      } else if (gameType === 'poker') {
        settings.startingChips = parseInt(startingChips)
        settings.minimumBet = parseInt(minimumBet)
      } else if (gameType === 'uno') {
        settings.cardsPerPlayer = parseInt(cardsPerPlayer)
        settings.scoreToWin = parseInt(scoreToWin)
      } else if (gameType === 'hot-potato') {
        settings.startingChips = 0
      }

      const response = await fetch(`${workerUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Failed to create room')
      }

      addToast({ type: 'success', title: 'Table created!', message: `Room code: ${code}` })
      router.push(`/room/${code}?game=${gameType}`)
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create table', message: e instanceof Error ? e.message : 'Check your connection' })
      setCreating(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-text-primary">Create Table</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="space-y-6"
        >
          <GlassPanel className="p-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Game</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  gameType === 'blackjack'
                    ? 'border-accent/50 bg-accent/5 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-white/[0.02]'
                }`}
                onClick={() => selectGame('blackjack')}
              >
                <CircleDot className={`h-5 w-5 ${gameType === 'blackjack' ? 'text-emerald-400' : 'text-text-tertiary'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Blackjack</p>
                  <p className="text-xs text-text-tertiary">2-7 players</p>
                </div>
              </button>
              <button
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  gameType === 'poker'
                    ? 'border-accent/50 bg-accent/5 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-white/[0.02]'
                }`}
                onClick={() => selectGame('poker')}
              >
                <Spade className={`h-5 w-5 ${gameType === 'poker' ? 'text-accent-light' : 'text-text-tertiary'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Poker</p>
                  <p className="text-xs text-text-tertiary">2-9 players</p>
                </div>
              </button>
              <button
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  gameType === 'uno'
                    ? 'border-accent/50 bg-accent/5 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-white/[0.02]'
                }`}
                onClick={() => selectGame('uno')}
              >
                <Palette className={`h-5 w-5 ${gameType === 'uno' ? 'text-red-400' : 'text-text-tertiary'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Uno</p>
                  <p className="text-xs text-text-tertiary">2-10 players</p>
                </div>
              </button>
              <button
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  gameType === 'hot-potato'
                    ? 'border-accent/50 bg-accent/5 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                    : 'border-white/[0.06] hover:border-white/[0.1] bg-white/[0.02]'
                }`}
                onClick={() => selectGame('hot-potato')}
              >
                <Flame className={`h-5 w-5 ${gameType === 'hot-potato' ? 'text-orange-400' : 'text-text-tertiary'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">Hot Potato</p>
                  <p className="text-xs text-text-tertiary">3-10 players</p>
                </div>
              </button>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Settings</h3>

            {/* Shared: Max Players */}
            <PremiumInput
              label="Max Players"
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              icon={<Users className="h-4 w-4" />}
              min={gameType === 'hot-potato' ? 3 : 2}
              max={gameType === 'poker' ? 9 : gameType === 'uno' || gameType === 'hot-potato' ? 10 : 7}
            />

            {/* Blackjack settings */}
            {gameType === 'blackjack' && (
              <>
                <PremiumInput
                  label="Starting Chips"
                  type="number"
                  value={startingChips}
                  onChange={(e) => setStartingChips(e.target.value)}
                  icon={<Coins className="h-4 w-4" />}
                  min={100}
                  step={100}
                />
                <PremiumInput
                  label="Minimum Bet"
                  type="number"
                  value={minimumBet}
                  onChange={(e) => setMinimumBet(e.target.value)}
                  icon={<CreditCard className="h-4 w-4" />}
                  min={10}
                  step={10}
                />
                <PremiumInput
                  label="Number of Decks"
                  type="number"
                  value={deckCount}
                  onChange={(e) => setDeckCount(e.target.value)}
                  icon={<Layers className="h-4 w-4" />}
                  min={1}
                  max={8}
                />
              </>
            )}

            {/* Poker settings */}
            {gameType === 'poker' && (
              <>
                <PremiumInput
                  label="Starting Chips"
                  type="number"
                  value={startingChips}
                  onChange={(e) => setStartingChips(e.target.value)}
                  icon={<Coins className="h-4 w-4" />}
                  min={100}
                  step={100}
                />
                <PremiumInput
                  label="Big Blind"
                  type="number"
                  value={minimumBet}
                  onChange={(e) => setMinimumBet(e.target.value)}
                  icon={<CreditCard className="h-4 w-4" />}
                  min={10}
                  step={10}
                />
              </>
            )}

            {/* Uno settings */}
            {gameType === 'uno' && (
              <>
                <PremiumInput
                  label="Cards Per Player"
                  type="number"
                  value={cardsPerPlayer}
                  onChange={(e) => setCardsPerPlayer(e.target.value)}
                  icon={<Layers className="h-4 w-4" />}
                  min={5}
                  max={10}
                />
                <PremiumInput
                  label="Score to Win"
                  type="number"
                  value={scoreToWin}
                  onChange={(e) => setScoreToWin(e.target.value)}
                  icon={<Trophy className="h-4 w-4" />}
                  min={100}
                  step={50}
                />
              </>
            )}
          </GlassPanel>

          <AnimatedButton
            size="lg"
            className="w-full"
            loading={creating}
            onClick={handleCreate}
          >
            Create Table
          </AnimatedButton>
        </motion.div>
      </main>
    </div>
  )
}

export default function CreateRoomPage() {
  return (
    <Suspense>
      <CreateRoomContent />
    </Suspense>
  )
}
