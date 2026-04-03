'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { createClient } from '@/lib/supabase/client'
import { getGameStatLabels } from '@/lib/stats'
import {
  AnimatedButton,
  GlassPanel,
  PremiumInput,
  Skeleton,
} from '@/components/ui'
import {
  ArrowLeft,
  User,
  Trophy,
  Gamepad2,
  Coins,
  LogOut,
  Volume2,
  VolumeX,
  Monitor,
} from 'lucide-react'
import Link from 'next/link'

interface GameStatRow {
  game_type: string
  games_played: number
  games_won: number
}

const GAME_LABELS: Record<string, string> = {
  blackjack: 'Blackjack',
  poker: 'Poker',
  uno: 'Uno',
  'hot-potato': 'Hot Potato',
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isGuest, isLoading, setUser } = useAuthStore()
  const { soundEnabled, toggleSound, reducedMotion, setReducedMotion, addToast } = useUIStore()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [saving, setSaving] = useState(false)
  const [gameStats, setGameStats] = useState<GameStatRow[]>([])
  const [resetChipsLoading, setResetChipsLoading] = useState(false)
  const totalGamesPlayed = gameStats.reduce((sum, stat) => sum + stat.games_played, 0)
  const totalGamesWon = gameStats.reduce((sum, stat) => sum + stat.games_won, 0)

  useEffect(() => {
    if (!user || isGuest) return
    const supabase = createClient()
    supabase
      .from('game_stats')
      .select('game_type, games_played, games_won')
      .eq('user_id', user.id)
      .order('games_won', { ascending: false })
      .then(({ data }: { data: GameStatRow[] | null }) => { if (data) setGameStats(data) })
  }, [user, isGuest])

  if (isGuest) {
    return (
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-text-primary">Profile</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8">
          <GlassPanel className="p-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-text-tertiary">G</span>
            </div>
            <h2 className="text-xl font-bold text-text-primary">Guest Mode</h2>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">
              You&apos;re playing as a guest. Stats and progress aren&apos;t saved. Create an account to track your wins and appear on the leaderboard.
            </p>
            <AnimatedButton href="/signup" size="lg" className="mt-2">Create Account</AnimatedButton>
          </GlassPanel>
        </main>
      </div>
    )
  }

  async function handleSave() {
    if (!displayName.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user?.id)

    if (error) {
      addToast({ type: 'error', title: 'Failed to update profile' })
    } else {
      setUser({ ...user!, display_name: displayName.trim() })
      addToast({ type: 'success', title: 'Profile updated' })
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    // Clear client-side auth state immediately so UI & route guards update fast.
    useAuthStore.getState().reset()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('[logout] signOut threw', e)
    } finally {
      addToast({ type: 'info', title: 'Signed out' })
      // Always redirect home, even if sign-out fails (prevents “stuck on profile” UX).
      router.push('/')
      router.refresh()
    }
  }

  async function handleResetChips() {
    if (!user) return
    const amount = 10000
    setResetChipsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ chips_balance: amount }).eq('id', user.id)

    if (error) {
      addToast({ type: 'error', title: 'Failed to reset chips', message: error.message })
    } else {
      setUser({ ...user, chips_balance: amount })
      addToast({ type: 'success', title: 'Chips reset', message: `Your balance is now ${amount.toLocaleString()} chips.` })
    }
    setResetChipsLoading(false)
  }

  const stats = [
    { label: 'Games Played', value: totalGamesPlayed, icon: <Gamepad2 className="h-4 w-4" /> },
    { label: 'Games Won', value: totalGamesWon, icon: <Trophy className="h-4 w-4" /> },
    { label: 'Chip Balance', value: user?.chips_balance?.toLocaleString() || '10,000', icon: <Coins className="h-4 w-4" /> },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  } as const

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-text-primary">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
          {/* Profile Card */}
          <motion.div variants={item}>
            <GlassPanel className="p-8 text-center">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="w-20 h-20 rounded-full mx-auto" />
                  <Skeleton className="h-6 w-32 mx-auto" />
                  <Skeleton className="h-4 w-48 mx-auto" />
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-accent-light">
                      {user?.display_name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>

                  {editing ? (
                    <div className="max-w-xs mx-auto space-y-3">
                      <PremiumInput
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display name"
                        icon={<User className="h-4 w-4" />}
                      />
                      <div className="flex gap-2">
                        <AnimatedButton size="sm" loading={saving} onClick={handleSave} className="flex-1">
                          Save
                        </AnimatedButton>
                        <AnimatedButton size="sm" variant="ghost" onClick={() => setEditing(false)} className="flex-1">
                          Cancel
                        </AnimatedButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-text-primary mb-1">
                        {user?.display_name}
                      </h2>
                      <p className="text-sm text-text-tertiary mb-4">{user?.email}</p>
                      <AnimatedButton size="sm" variant="ghost" onClick={() => { setEditing(true); setDisplayName(user?.display_name || '') }}>
                        Edit Profile
                      </AnimatedButton>
                    </>
                  )}
                </>
              )}
            </GlassPanel>
          </motion.div>

          {/* Stats */}
          <motion.div variants={item}>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Stats</h3>
            <div className="grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <GlassPanel key={stat.label} className="p-4 text-center">
                  <div className="text-text-tertiary mb-2 flex justify-center">{stat.icon}</div>
                  <p className="text-lg font-bold text-text-primary">{stat.value}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">{stat.label}</p>
                </GlassPanel>
              ))}
            </div>
          </motion.div>

          {/* Per-Game Stats */}
          {gameStats.length > 0 && (
            <motion.div variants={item}>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Stats by Game</h3>
              <div className="space-y-2">
                {gameStats.map((gs) => {
                  const winRate = gs.games_played > 0 ? ((gs.games_won / gs.games_played) * 100).toFixed(0) : '0'
                  const labels = getGameStatLabels(gs.game_type as 'blackjack' | 'poker' | 'uno' | 'hot-potato')
                  return (
                    <GlassPanel key={gs.game_type} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {GAME_LABELS[gs.game_type] || gs.game_type}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {gs.games_won} {labels.wonNoun}{gs.games_won === 1 ? '' : 's'} · {gs.games_played} {labels.playedNoun}{gs.games_played === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-accent-light">{winRate}%</span>
                    </GlassPanel>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Settings */}
          <motion.div variants={item}>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Settings</h3>
            <GlassPanel className="divide-y divide-white/[0.04]">
              <button
                className="flex items-center justify-between w-full p-4 hover:bg-white/[0.02] transition-colors"
                onClick={toggleSound}
              >
                <div className="flex items-center gap-3">
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-text-tertiary" /> : <VolumeX className="h-4 w-4 text-text-tertiary" />}
                  <span className="text-sm text-text-primary">Sound</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-accent' : 'bg-white/10'} relative`}>
                  <motion.div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ left: soundEnabled ? 22 : 4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>
              <button
                className="flex items-center justify-between w-full p-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => setReducedMotion(!reducedMotion)}
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-text-tertiary" />
                  <span className="text-sm text-text-primary">Reduced Motion</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${reducedMotion ? 'bg-accent' : 'bg-white/10'} relative`}>
                  <motion.div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ left: reducedMotion ? 22 : 4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Coins className="h-4 w-4 text-text-tertiary" />
                    <span className="text-sm text-text-primary">Reset Chips</span>
                  </div>
                  <span className="text-xs text-text-tertiary">
                    Updates your account bankroll
                  </span>
                </div>

                <div className="glass rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-sm text-text-primary font-medium">Resets your chips to 10,000</p>
                  <p className="text-xs text-text-secondary mt-1">
                    You can&apos;t set chip balance to another value.
                  </p>
                </div>

                <div className="flex gap-3 mt-3">
                  <AnimatedButton
                    className="w-full"
                    loading={resetChipsLoading}
                    disabled={resetChipsLoading}
                    onClick={handleResetChips}
                  >
                    Reset Chips
                  </AnimatedButton>
                </div>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Logout */}
          <motion.div variants={item}>
            <AnimatedButton variant="danger" className="w-full" onClick={handleLogout} icon={<LogOut className="h-4 w-4" />}>
              Sign Out
            </AnimatedButton>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
