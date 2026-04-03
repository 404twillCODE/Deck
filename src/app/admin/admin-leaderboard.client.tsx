'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatedButton, AnimatedModal, GlassPanel, Skeleton } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import type { GameType } from '@/types'
import { Shield, RotateCcw } from 'lucide-react'

type LeaderboardFilter = 'all' | GameType

type LeaderboardEntry = {
  user_id: string
  display_name: string
  game_type: LeaderboardFilter
  games_played: number
  games_won: number
  win_rate: number
}

const FILTERS: Array<{ id: LeaderboardFilter; label: string }> = [
  { id: 'all', label: 'Overall' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'poker', label: 'Poker' },
  { id: 'uno', label: 'Uno' },
  { id: 'hot-potato', label: 'Hot Potato' },
]

function safeIntStringToNumber(v: string) {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

export default function AdminLeaderboard() {
  const { user } = useAuthStore()
  const { addToast } = useUIStore()

  const canEdit = user?.role === 'admin'

  const [filter, setFilter] = useState<LeaderboardFilter>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [editing, setEditing] = useState<LeaderboardEntry | null>(null)
  const [editPlayed, setEditPlayed] = useState('0')
  const [editWon, setEditWon] = useState('0')

  const isEditMode = canEdit && filter !== 'all'

  const sortHint = useMemo(() => {
    if (filter === 'all') return 'Aggregated across all games.'
    return 'Editing applies to this specific game_type.'
  }, [filter])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/leaderboard?filter=${encodeURIComponent(filter)}&limit=50`)
      if (!res.ok) throw new Error(`Failed to load leaderboard (${res.status})`)
      const json = (await res.json()) as { entries: LeaderboardEntry[] }
      setEntries(json.entries || [])
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function openEdit(e: LeaderboardEntry) {
    setEditing(e)
    setEditPlayed(String(e.games_played ?? 0))
    setEditWon(String(e.games_won ?? 0))
  }

  async function saveEdit() {
    if (!editing) return
    const games_played = safeIntStringToNumber(editPlayed)
    const games_won = safeIntStringToNumber(editWon)
    if (games_played === null || games_won === null) {
      addToast({ type: 'error', title: 'Invalid values', message: 'Use whole numbers >= 0.' })
      return
    }
    if (games_played < 0 || games_won < 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/admin/leaderboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editing.user_id,
          gameType: editing.game_type as GameType,
          games_played,
          games_won,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || `Update failed (${res.status})`)
      }

      addToast({ type: 'success', title: 'Leaderboard updated' })
      setEditing(null)
      void load()
    } catch (e) {
      addToast({ type: 'error', title: 'Update failed', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  async function resetGameStats() {
    if (!canEdit) return
    const confirmed = window.confirm(
      filter === 'all'
        ? 'Reset ALL leaderboard stats (all games) to 0?'
        : `Reset leaderboard stats for ${filter} to 0?`,
    )
    if (!confirmed) return

    setResetting(true)
    try {
      const res = await fetch('/api/admin/leaderboard/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: filter }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || `Reset failed (${res.status})`)
      }
      addToast({ type: 'success', title: 'Leaderboard reset' })
      void load()
    } catch (e) {
      addToast({ type: 'error', title: 'Reset failed', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent-light" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Leaderboard Admin</h2>
              <p className="text-xs text-text-tertiary mt-1">{sortHint}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AnimatedButton
              variant="secondary"
              size="sm"
              onClick={() => void resetGameStats()}
              disabled={!canEdit || resetting}
              loading={resetting}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Reset
            </AnimatedButton>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={[
                'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border',
                filter === f.id
                  ? 'bg-accent/20 text-accent-light border-accent/30'
                  : 'glass text-text-secondary hover:text-text-primary border-transparent',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-text-secondary text-sm">No stats found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="text-xs font-medium text-text-tertiary uppercase tracking-wider border-b border-white/[0.04]">
                  <th className="text-left py-3 px-2">#</th>
                  <th className="text-left py-3 px-2">Player</th>
                  <th className="text-right py-3 px-2">Wins</th>
                  <th className="text-right py-3 px-2">Played</th>
                  <th className="text-right py-3 px-2">Win %</th>
                  <th className="text-right py-3 px-2">Edit</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.user_id} className="border-b border-white/[0.04]">
                    <td className="py-4 px-2 text-sm text-text-tertiary">{i + 1}</td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full glass border border-white/[0.06] flex items-center justify-center">
                          <span className="text-xs font-bold text-accent-light">
                            {e.display_name?.charAt(0)?.toUpperCase() || 'P'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{e.display_name}</div>
                          <div className="text-xs text-text-tertiary truncate">@{e.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right text-sm font-semibold text-text-primary">{e.games_won}</td>
                    <td className="py-4 px-2 text-right text-sm text-text-secondary">{e.games_played}</td>
                    <td className="py-4 px-2 text-right text-sm text-text-secondary">
                      {(e.win_rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-4 px-2 text-right">
                      {isEditMode ? (
                        <AnimatedButton size="sm" variant="secondary" onClick={() => openEdit(e)}>
                          Edit
                        </AnimatedButton>
                      ) : (
                        <span className="text-xs text-text-tertiary">{filter === 'all' ? '—' : 'Admins only'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      <AnimatedModal
        open={!!editing}
        onClose={() => {
          if (saving) return
          setEditing(null)
        }}
        title="Edit leaderboard stats"
      >
        {editing ? (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary">
              Editing <span className="text-text-primary font-medium">{editing.display_name}</span> ·{' '}
              <span className="text-text-tertiary">{editing.game_type}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-text-tertiary">Played</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editPlayed}
                  onChange={(ev) => setEditPlayed(ev.target.value)}
                  min={0}
                  step={1}
                  className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-transparent text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 px-4"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-text-tertiary">Wins</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editWon}
                  onChange={(ev) => setEditWon(ev.target.value)}
                  min={0}
                  step={1}
                  className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-transparent text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 px-4"
                />
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <AnimatedButton variant="secondary" size="md" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </AnimatedButton>
              <AnimatedButton variant="primary" size="md" onClick={() => void saveEdit()} loading={saving} disabled={saving}>
                Save
              </AnimatedButton>
            </div>
          </div>
        ) : null}
      </AnimatedModal>
    </div>
  )
}

