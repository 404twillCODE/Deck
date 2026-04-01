'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { AnimatedButton, GlassPanel, Skeleton } from '@/components/ui'
import { ArrowLeft, Trophy, Medal, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type GameFilter = 'all' | 'blackjack' | 'poker' | 'uno' | 'hot-potato'

interface LeaderboardEntry {
  user_id: string
  display_name: string
  games_played: number
  games_won: number
  win_rate: number
}

const GAME_TABS: { id: GameFilter; label: string }[] = [
  { id: 'all', label: 'Overall' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'poker', label: 'Poker' },
  { id: 'uno', label: 'Uno' },
  { id: 'hot-potato', label: 'Hot Potato' },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-400" />
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return <span className="text-sm font-medium text-text-tertiary w-5 text-center">{rank}</span>
}

export default function LeaderboardPage() {
  const { user, isGuest } = useAuthStore()
  const [filter, setFilter] = useState<GameFilter>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      if (filter === 'all') {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, games_played, games_won')
          .gt('games_played', 0)
          .order('games_won', { ascending: false })
          .limit(50)

        setEntries(
          (data || []).map((p: { id: string; display_name: string; games_played: number; games_won: number }) => ({
            user_id: p.id,
            display_name: p.display_name,
            games_played: p.games_played,
            games_won: p.games_won,
            win_rate: p.games_played > 0 ? p.games_won / p.games_played : 0,
          })),
        )
      } else {
        const { data } = await supabase
          .from('game_stats')
          .select('user_id, games_played, games_won, profiles!inner(display_name)')
          .eq('game_type', filter)
          .gt('games_played', 0)
          .order('games_won', { ascending: false })
          .limit(50)

        type GameStatRow = { user_id: string; games_played: number; games_won: number; profiles: { display_name: string } | { display_name: string }[] }

        setEntries(
          (data || []).map((s: GameStatRow) => {
            const profile = (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles) as { display_name: string }
            return {
              user_id: s.user_id,
              display_name: profile.display_name,
              games_played: s.games_played,
              games_won: s.games_won,
              win_rate: s.games_played > 0 ? s.games_won / s.games_played : 0,
            }
          }),
        )
      }

      setLoading(false)
    }

    load()
  }, [filter])

  const myRank = !isGuest && user ? entries.findIndex((e) => e.user_id === user.id) + 1 : 0

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  } as const

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent-light" />
            <h1 className="text-lg font-semibold text-text-primary">Leaderboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Game filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {GAME_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                filter === tab.id
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'glass text-text-secondary hover:text-text-primary border border-transparent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Your rank */}
        {!isGuest && user && myRank > 0 && (
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-accent-light">
                    {user.display_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Your Rank</p>
                  <p className="text-xs text-text-tertiary">
                    {entries[myRank - 1]?.games_won} wins · {entries[myRank - 1]?.games_played} played
                  </p>
                </div>
              </div>
              <span className="text-2xl font-black text-gradient">#{myRank}</span>
            </div>
          </GlassPanel>
        )}

        {isGuest && (
          <GlassPanel className="p-4 flex items-center justify-between">
            <p className="text-sm text-text-secondary">Sign up to track your stats and appear on the leaderboard</p>
            <AnimatedButton href="/signup" size="sm">Sign Up</AnimatedButton>
          </GlassPanel>
        )}

        {/* Leaderboard table */}
        <GlassPanel className="overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-3 border-b border-white/[0.04] text-xs font-medium text-text-tertiary uppercase tracking-wider">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Wins</span>
            <span className="text-right">Played</span>
            <span className="text-right">Win %</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No games played yet</p>
              <p className="text-sm text-text-tertiary mt-1">Be the first on the board!</p>
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show">
              {entries.map((entry, i) => {
                const rank = i + 1
                const isMe = !isGuest && user?.id === entry.user_id
                return (
                  <motion.div
                    key={entry.user_id}
                    variants={item}
                    className={cn(
                      'grid grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-3 items-center transition-colors',
                      isMe
                        ? 'bg-accent/[0.06] border-l-2 border-accent'
                        : 'hover:bg-white/[0.02] border-l-2 border-transparent',
                      rank <= 3 && 'bg-white/[0.02]',
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <RankBadge rank={rank} />
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        rank === 1 ? 'bg-amber-400/20' : rank === 2 ? 'bg-gray-300/20' : rank === 3 ? 'bg-amber-600/20' : 'bg-white/[0.06]',
                      )}>
                        <span className={cn(
                          'text-xs font-bold',
                          rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-tertiary',
                        )}>
                          {entry.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={cn(
                        'text-sm font-medium truncate',
                        isMe ? 'text-accent-light' : 'text-text-primary',
                      )}>
                        {entry.display_name}
                        {isMe && <span className="text-text-tertiary text-xs ml-1">(you)</span>}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-text-primary text-right">{entry.games_won}</span>
                    <span className="text-sm text-text-secondary text-right">{entry.games_played}</span>
                    <span className="text-sm text-text-secondary text-right">
                      {(entry.win_rate * 100).toFixed(0)}%
                    </span>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </GlassPanel>
      </main>
    </div>
  )
}
