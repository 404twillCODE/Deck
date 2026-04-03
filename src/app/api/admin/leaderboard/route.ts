import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin, requireModerator } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import type { GameType } from '@/types'

type LeaderboardFilter = 'all' | GameType

type LeaderboardEntry = {
  user_id: string
  display_name: string
  game_type: LeaderboardFilter
  games_played: number
  games_won: number
  win_rate: number
}

function clampInt(n: unknown, min: number, max: number) {
  if (typeof n !== 'number') return null
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < min || n > max) return null
  return n
}

export async function GET(request: NextRequest) {
  try {
    await requireModerator()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const filterRaw = (url.searchParams.get('filter') || 'all').toLowerCase()
  const filter: LeaderboardFilter = filterRaw === 'all' ? 'all' : (filterRaw as GameType)
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10)))

  const supabase = await createServerSupabaseClient()

  if (filter === 'all') {
    const { data, error } = await supabase
      .from('game_stats')
      .select('user_id, games_played, games_won, profiles!inner(display_name)')
      .gt('games_played', 0)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data || []) as Array<{
      user_id: string
      games_played: number
      games_won: number
      profiles: { display_name: string } | Array<{ display_name: string }>
    }>

    const aggregated = new Map<string, { user_id: string; display_name: string; games_played: number; games_won: number }>()

    for (const row of rows) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const existing = aggregated.get(row.user_id)
      if (existing) {
        existing.games_played += row.games_played ?? 0
        existing.games_won += row.games_won ?? 0
      } else {
        aggregated.set(row.user_id, {
          user_id: row.user_id,
          display_name: profile?.display_name || 'Player',
          games_played: row.games_played ?? 0,
          games_won: row.games_won ?? 0,
        })
      }
    }

    const entries: LeaderboardEntry[] = [...aggregated.values()]
      .map((r) => ({
        user_id: r.user_id,
        display_name: r.display_name,
        game_type: 'all' as const,
        games_played: r.games_played,
        games_won: r.games_won,
        win_rate: r.games_played > 0 ? r.games_won / r.games_played : 0,
      }))
      .sort((a, b) => b.games_won - a.games_won || b.win_rate - a.win_rate || b.games_played - a.games_played)
      .slice(0, limit)

    return NextResponse.json({ entries })
  }

  const { data, error } = await supabase
    .from('game_stats')
    .select('user_id, games_played, games_won, profiles!inner(display_name)')
    .eq('game_type', filter)
    .gt('games_played', 0)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as Array<{
    user_id: string
    games_played: number
    games_won: number
    profiles: { display_name: string } | Array<{ display_name: string }>
  }>

  const entries: LeaderboardEntry[] = rows
    .map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const games_played = r.games_played ?? 0
      const games_won = r.games_won ?? 0
      return {
        user_id: r.user_id,
        display_name: profile?.display_name || 'Player',
        game_type: filter as LeaderboardFilter,
        games_played,
        games_won,
        win_rate: games_played > 0 ? games_won / games_played : 0,
      }
    })
    .sort((a, b) => b.games_won - a.games_won || b.win_rate - a.win_rate || b.games_played - a.games_played)
    .slice(0, limit)

  return NextResponse.json({ entries })
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const maybeGameType = url.searchParams.get('gameType')
  const maybeUserId = url.searchParams.get('userId')

  let payload: {
    userId?: string
    gameType?: GameType
    games_played?: number
    games_won?: number
  }

  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = payload.userId || maybeUserId
  const gameType = (payload.gameType || maybeGameType) as GameType | undefined

  if (!userId || !gameType) return NextResponse.json({ error: 'Missing userId/gameType' }, { status: 400 })

  const games_played = clampInt(payload.games_played, 0, 1_000_000_000)
  const games_won = clampInt(payload.games_won, 0, 1_000_000_000)
  if (games_played === null || games_won === null) {
    return NextResponse.json({ error: 'games_played/games_won must be integers >= 0' }, { status: 400 })
  }

  const actor = await requireAdmin()
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('game_stats')
    .upsert(
      [{ user_id: userId, game_type: gameType, games_played, games_won }],
      { onConflict: 'user_id,game_type' },
    )
    .select('id,user_id,game_type,games_played,games_won')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await writeAdminAuditLog({
      actor,
      actionType: 'leaderboard_updated',
      targetUserId: userId,
      payload: { game_type: gameType, games_played, games_won },
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, row: data })
}

