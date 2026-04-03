'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedButton, GlassPanel, AnimatedModal } from '@/components/ui'
import { ArrowLeft, Search, Shield, UserCog, ShieldAlert, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import AdminLeaderboard from './admin-leaderboard.client'

type UserRow = {
  id: string
  email: string
  username: string
  display_name: string
  role: 'admin' | 'moderator' | 'user'
  is_disabled: boolean
  is_banned: boolean
  chips_balance: number
  created_at: string
  updated_at: string
}

type Stats = {
  stats: {
    totalUsers: number
    totalStatsRows: number
    totalGamesPlayed: number
    totalGamesWon: number
  }
}

function roleLabel(role: 'admin' | 'moderator' | 'user') {
  if (role === 'admin') return 'Admin'
  if (role === 'moderator') return 'Moderator'
  return 'User'
}

function roleStyles(role: 'admin' | 'moderator' | 'user') {
  if (role === 'admin') return 'bg-accent/10 text-accent-light border-accent/30'
  if (role === 'moderator') return 'bg-warning/10 text-warning border-warning/30'
  return 'bg-white/[0.04] text-text-tertiary border-white/[0.08]'
}

export default function AdminDashboard() {
  const { addToast } = useUIStore()

  const [tab, setTab] = useState<'overview' | 'users' | 'audit' | 'leaderboard'>('overview')
  const [stats, setStats] = useState<Stats['stats'] | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const { user } = useAuthStore()
  const actorRole = user?.role
  const canEditRole = actorRole === 'admin'

  const [editRole, setEditRole] = useState<'admin' | 'moderator' | 'user'>('user')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editChipsBalance, setEditChipsBalance] = useState('10000')
  const [editDisabled, setEditDisabled] = useState(false)
  const [editBanned, setEditBanned] = useState(false)
  const [saving, setSaving] = useState(false)

  const [auditEntries, setAuditEntries] = useState<any[] | null>(null)
  const [loadingAudit, setLoadingAudit] = useState(false)

  async function loadUsers(term: string) {
    setLoadingUsers(true)
    try {
      const q = term.trim()
      const res = await fetch(`/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`)
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`)
      const json = (await res.json()) as { users: UserRow[] }
      setUsers(json.users)
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load users', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (tab !== 'overview') return

    async function load() {
      setLoadingStats(true)
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) throw new Error(`Failed to load stats (${res.status})`)
        const json = (await res.json()) as Stats
        setStats(json.stats)
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to load stats', message: e instanceof Error ? e.message : 'Unknown error' })
      } finally {
        setLoadingStats(false)
      }
    }

    void load()
  }, [tab, addToast])

  useEffect(() => {
    if (tab !== 'users') return

    const t = setTimeout(() => {
      void loadUsers(search)
    }, 250)

    return () => clearTimeout(t)
  }, [tab, search, addToast])

  async function loadAudit() {
    setLoadingAudit(true)
    try {
      const res = await fetch('/api/admin/audit?limit=50')
      if (!res.ok) throw new Error(`Failed to load audit (${res.status})`)
      const json = (await res.json()) as { entries: any[] }
      setAuditEntries(json.entries || [])
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load audit', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => {
    if (tab !== 'audit') return
    void loadAudit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const statsCards = useMemo(() => {
    if (!stats) return []
    return [
      { title: 'Total users', value: stats.totalUsers, hint: 'Registered accounts' },
      { title: 'Game stat rows', value: stats.totalStatsRows, hint: 'Per-user per-game tracking' },
      { title: 'Total games played', value: stats.totalGamesPlayed, hint: 'Aggregated from game_stats' },
      { title: 'Total wins', value: stats.totalGamesWon, hint: 'Aggregated from game_stats' },
    ]
  }, [stats])

  function openEditor(u: UserRow) {
    setEditingUser(u)
    setEditRole(u.role)
    setEditDisplayName(u.display_name)
    setEditChipsBalance(String(u.chips_balance ?? 0))
    setEditDisabled(!!u.is_disabled)
    setEditBanned(!!u.is_banned)
    setSaving(false)
  }

  async function saveEditor() {
    if (!editingUser) return
    setSaving(true)
    try {
      const chipsBalanceInt = Number.parseInt(editChipsBalance, 10)
      if (!Number.isFinite(chipsBalanceInt) || !Number.isInteger(chipsBalanceInt) || chipsBalanceInt < 0) {
        throw new Error('Invalid chips balance')
      }
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(canEditRole ? { role: editRole } : {}),
          display_name: editDisplayName,
          is_disabled: editDisabled,
          is_banned: editBanned,
          chips_balance: chipsBalanceInt,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || `Update failed (${res.status})`)
      }

      addToast({ type: 'success', title: 'User updated' })
      setEditingUser(null)
      if (tab === 'users') await loadUsers(search)
    } catch (e) {
      addToast({ type: 'error', title: 'Update failed', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary" aria-label="Go home">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex flex-col">
              <p className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent-light" />
                Admin
              </p>
              <p className="text-xs text-text-tertiary">Manage users and moderation flags</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AnimatedButton
              variant={tab === 'overview' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTab('overview')}
            >
              Overview
            </AnimatedButton>
            <AnimatedButton
              variant={tab === 'users' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTab('users')}
            >
              Users
            </AnimatedButton>

            <AnimatedButton
              variant={tab === 'audit' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTab('audit')}
            >
              Audit
            </AnimatedButton>

            <AnimatedButton
              variant={tab === 'leaderboard' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTab('leaderboard')}
            >
              Leaderboard
            </AnimatedButton>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <AnimatePresence mode="wait">
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-6"
            >
              <GlassPanel className="p-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-accent-light" />
                  <h2 className="text-lg font-semibold text-text-primary">Overview</h2>
                </div>

                {loadingStats || !stats ? (
                  <div className="mt-5 flex items-center gap-3 text-text-secondary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {statsCards.map((c) => (
                      <div key={c.title} className="glass rounded-2xl p-4 border border-white/[0.06]">
                        <p className="text-xs text-text-tertiary">{c.title}</p>
                        <p className="text-2xl font-black text-gradient-accent mt-1">{c.value.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary mt-1">{c.hint}</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="flex items-center gap-3">
                  <UserCog className="h-5 w-5 text-text-tertiary" />
                  <h3 className="text-sm font-semibold text-text-primary">Admin actions</h3>
                </div>
                <p className="text-sm text-text-secondary mt-3">
                  Use the Users tab to change roles and moderation flags. Changes are enforced server-side and protected by Supabase RLS.
                </p>
              </GlassPanel>
            </motion.div>
          ) : tab === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-6"
            >
              <GlassPanel className="p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <UserCog className="h-5 w-5 text-accent-light" />
                    <h2 className="text-lg font-semibold text-text-primary">Users</h2>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search email, username, or display name…"
                      className="w-full h-11 pl-9 pr-4 rounded-xl glass text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 bg-transparent"
                      aria-label="Search users"
                    />
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="text-xs font-medium text-text-tertiary uppercase tracking-wider border-b border-white/[0.04]">
                        <th className="text-left py-3 px-2">User</th>
                        <th className="text-left py-3 px-2">Email</th>
                        <th className="text-left py-3 px-2">Role</th>
                        <th className="text-left py-3 px-2">Status</th>
                        <th className="text-left py-3 px-2">Chips</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingUsers ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-white/[0.04]">
                            <td className="py-4 px-2 text-sm text-text-secondary" colSpan={6}>
                              <div className="flex items-center gap-3">
                                <Loader2 className="h-4 w-4 animate-spin text-accent-light" />
                                Loading users...
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : users.length === 0 ? (
                        <tr>
                          <td className="py-12 px-2 text-center text-text-secondary" colSpan={6}>
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => {
                          const status = u.is_banned ? 'Banned' : u.is_disabled ? 'Disabled' : 'Active'
                          const statusClass = u.is_banned
                            ? 'border-danger/30 bg-danger/10 text-danger'
                            : u.is_disabled
                              ? 'border-warning/30 bg-warning/10 text-warning'
                              : 'border-white/[0.08] bg-white/[0.04] text-text-tertiary'

                          return (
                            <tr key={u.id} className="border-b border-white/[0.04]">
                              <td className="py-4 px-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-text-primary">{u.display_name}</span>
                                  <span className="text-xs text-text-tertiary">@{u.username}</span>
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                <span className="text-sm text-text-secondary">{u.email}</span>
                              </td>
                              <td className="py-4 px-2">
                                <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full border ${roleStyles(u.role)}`}>
                                  <span className="text-xs font-medium">{roleLabel(u.role)}</span>
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full border ${statusClass}`}>
                                  <span className="text-xs font-medium">{status}</span>
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                <span className="text-sm font-medium text-text-primary">
                                  {u.chips_balance.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <AnimatedButton size="sm" variant="secondary" onClick={() => openEditor(u)}>
                                    Edit
                                  </AnimatedButton>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassPanel>

              <AnimatedModal
                open={!!editingUser}
                onClose={() => {
                  if (saving) return
                  setEditingUser(null)
                }}
                title="Edit user"
              >
                {editingUser ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl glass border border-white/[0.06] flex items-center justify-center">
                        <ShieldAlert className="h-4 w-4 text-accent-light" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{editingUser.display_name}</p>
                        <p className="text-xs text-text-tertiary truncate">{editingUser.email}</p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs text-text-tertiary">Role</span>
                        {canEditRole ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as 'admin' | 'moderator' | 'user')}
                            className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-transparent text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30"
                          >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <div className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-white/[0.02] text-text-primary text-sm flex items-center px-4">
                            {roleLabel(editingUser.role)}
                          </div>
                        )}
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs text-text-tertiary">Display name</span>
                        <input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-transparent text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 px-4"
                        />
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-xs text-text-tertiary">Chips balance</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editChipsBalance}
                          onChange={(e) => setEditChipsBalance(e.target.value)}
                          min={0}
                          step={100}
                          className="w-full h-11 rounded-xl glass border border-white/[0.06] bg-transparent text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 px-4"
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-3 p-3 rounded-xl glass border border-white/[0.06] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDisabled}
                          onChange={(e) => setEditDisabled(e.target.checked)}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="text-sm font-medium text-text-primary">Disable account</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl glass border border-white/[0.06] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editBanned}
                          onChange={(e) => setEditBanned(e.target.checked)}
                          className="h-4 w-4 accent-accent"
                        />
                        <span className="text-sm font-medium text-text-primary text-danger">Ban account</span>
                      </label>
                    </div>

                    <div className="glass rounded-xl p-3 border border-white/[0.06]">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                        <p className="text-xs text-text-secondary">
                          Disabled/Banned accounts are blocked from protected routes by server-side middleware. Use these actions carefully.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <AnimatedButton
                        variant="secondary"
                        onClick={() => setEditingUser(null)}
                        size="md"
                      >
                        Cancel
                      </AnimatedButton>
                      <AnimatedButton
                        variant="primary"
                        size="md"
                        onClick={() => void saveEditor()}
                        loading={saving}
                        disabled={saving}
                      >
                        Save changes
                      </AnimatedButton>
                    </div>
                  </div>
                ) : null}
              </AnimatedModal>
            </motion.div>
          ) : tab === 'audit' ? (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-6"
            >
              <GlassPanel className="p-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-accent-light" />
                  <h2 className="text-lg font-semibold text-text-primary">Audit Log</h2>
                </div>

                <p className="text-sm text-text-secondary mt-3">
                  Tracks admin/moderator actions (who changed what + when).
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => void loadAudit()}
                    loading={loadingAudit}
                  >
                    Refresh
                  </AnimatedButton>
                </div>

                {loadingAudit || !auditEntries ? (
                  <div className="mt-5 flex items-center gap-3 text-text-secondary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading audit entries...
                  </div>
                ) : auditEntries.length === 0 ? (
                  <div className="mt-6 text-center text-text-secondary text-sm">No audit entries yet.</div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[820px]">
                      <thead>
                        <tr className="text-xs font-medium text-text-tertiary uppercase tracking-wider border-b border-white/[0.04]">
                          <th className="text-left py-3 px-2">Time</th>
                          <th className="text-left py-3 px-2">Actor</th>
                          <th className="text-left py-3 px-2">Action</th>
                          <th className="text-left py-3 px-2">Target</th>
                          <th className="text-left py-3 px-2">Payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditEntries.map((e: any) => (
                          <tr key={e.id} className="border-b border-white/[0.04]">
                            <td className="py-4 px-2 text-sm text-text-secondary">
                              {new Date(e.created_at).toLocaleString()}
                            </td>
                            <td className="py-4 px-2 text-sm">
                              <span className="text-text-primary font-medium">{e.actor_role}</span>
                              <div className="text-xs text-text-tertiary mt-1 truncate">{e.actor_id}</div>
                            </td>
                            <td className="py-4 px-2 text-sm text-text-tertiary">{e.action_type}</td>
                            <td className="py-4 px-2 text-sm text-text-tertiary">{e.target_user_id ?? '—'}</td>
                            <td className="py-4 px-2 text-sm text-text-tertiary">
                              <div className="max-w-[320px] truncate">
                                {typeof e.payload === 'object' ? JSON.stringify(e.payload) : String(e.payload)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          ) : (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-6"
            >
              <AdminLeaderboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

