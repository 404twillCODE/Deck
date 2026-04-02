'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { createClient } from '@/lib/supabase/client'
import {
  AnimatedButton,
  PremiumInput,
  GlassPanel,
  GameCard,
  Skeleton,
  DeckLogo,
} from '@/components/ui'
import {
  LogOut,
  Plus,
  Hash,
  Spade,
  CircleDot,
  Palette,
  Settings,
  User,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

function ProfileChip() {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useUIStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    useAuthStore.getState().reset()
    addToast({ type: 'info', title: 'Signed out' })
    router.push('/')
    router.refresh()
  }

  if (isLoading) {
    return <Skeleton className="h-10 w-32" />
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
          <span className="text-sm font-bold text-accent-light">
            {user?.display_name?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-text-primary group-hover:text-accent-light transition-colors">
            {user?.display_name || 'Player'}
          </p>
          <p className="text-xs text-text-tertiary">{user?.chips_balance?.toLocaleString() || '10,000'} chips</p>
        </div>
      </Link>
      <button
        onClick={handleLogout}
        className="p-2 rounded-lg hover:bg-white/[0.04] text-text-tertiary hover:text-text-secondary transition-colors"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore()
  const { addToast } = useUIStore()
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [joiningRoom, setJoiningRoom] = useState(false)

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault()
    const code = roomCode.trim().toUpperCase()
    if (!code || code.length < 4) {
      addToast({ type: 'error', title: 'Enter a valid room code' })
      return
    }
    setJoiningRoom(true)

    try {
      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }
      const res = await fetch(`${workerUrl}/api/rooms/${code}`)
      if (res.ok) {
        const data = await res.json() as { gameType: string }
        router.push(`/room/${code}?game=${data.gameType}`)
      } else {
        // Room not found via lookup — try anyway with default
        router.push(`/room/${code}?game=blackjack`)
      }
    } catch {
      router.push(`/room/${code}?game=blackjack`)
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  } as const

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  }

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <DeckLogo />
            <span className="text-lg font-semibold text-text-primary hidden sm:block">Deck</span>
          </Link>
          <ProfileChip />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Welcome */}
          <motion.div variants={item}>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">
              {isLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                `Hey, ${user?.display_name || 'Player'}`
              )}
            </h1>
            <p className="text-text-secondary">What are we playing?</p>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassPanel className="p-6">
              <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create a Table
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <AnimatedButton
                  variant="secondary"
                  className="justify-start"
                  onClick={() => router.push('/room/create?game=blackjack')}
                >
                  <CircleDot className="h-4 w-4 text-emerald-400" />
                  Blackjack
                </AnimatedButton>
                <AnimatedButton
                  variant="secondary"
                  className="justify-start"
                  onClick={() => router.push('/room/create?game=poker')}
                >
                  <Spade className="h-4 w-4 text-accent-light" />
                  Poker
                </AnimatedButton>
                <AnimatedButton
                  variant="secondary"
                  className="justify-start"
                  onClick={() => router.push('/room/create?game=uno')}
                >
                  <Palette className="h-4 w-4 text-red-400" />
                  Uno
                </AnimatedButton>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Join a Room
              </h3>
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <PremiumInput
                  placeholder="Enter code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest uppercase"
                />
                <AnimatedButton type="submit" loading={joiningRoom} className="flex-shrink-0">
                  Join
                </AnimatedButton>
              </form>
            </GlassPanel>
          </motion.div>

          {/* Game Selection */}
          <motion.div variants={item}>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Games</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GameCard
                gameType="blackjack"
                title="Blackjack"
                description="Classic 21. Hit, stand, or double down with friends at your table."
                icon={<CircleDot className="h-6 w-6" />}
                playerCount="2-7 players"
                onClick={() => router.push('/room/create?game=blackjack')}
              />
              <GameCard
                gameType="poker"
                title="Texas Hold'em"
                description="No-limit poker. Blinds, community cards, and high-stakes showdowns."
                icon={<Spade className="h-6 w-6" />}
                playerCount="2-9 players"
                onClick={() => router.push('/room/create?game=poker')}
              />
              <GameCard
                gameType="uno"
                title="Uno"
                description="Classic color-matching. Play action cards and race to empty your hand."
                icon={<Palette className="h-6 w-6" />}
                playerCount="2-10 players"
                onClick={() => router.push('/room/create?game=uno')}
              />
            </div>
          </motion.div>

          {/* Recent / Empty State */}
          <motion.div variants={item}>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Tables</h2>
            <GlassPanel className="p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
                <Spade className="h-6 w-6 text-text-tertiary" />
              </div>
              <p className="text-text-secondary mb-1">No recent games</p>
              <p className="text-sm text-text-tertiary">Create or join a table to get started</p>
            </GlassPanel>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={item} className="flex flex-col gap-1">
            <Link
              href="/profile"
              className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.03] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-text-tertiary" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">Profile & Stats</span>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/[0.03] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-text-tertiary" />
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">Settings</span>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
