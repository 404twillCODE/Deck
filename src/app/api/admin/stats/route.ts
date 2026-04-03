import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireModerator } from '@/lib/admin'

export async function GET(_request: NextRequest) {
  try {
    await requireModerator()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()

  const { count: totalUsers, error: usersCountErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (usersCountErr) return NextResponse.json({ error: usersCountErr.message }, { status: 500 })

  const { count: totalStatsRows, error: statsCountErr } = await supabase
    .from('game_stats')
    .select('id', { count: 'exact', head: true })

  if (statsCountErr) return NextResponse.json({ error: statsCountErr.message }, { status: 500 })

  const { data: statRows, error: statsRowsErr } = await supabase
    .from('game_stats')
    .select('games_played,games_won')

  if (statsRowsErr) return NextResponse.json({ error: statsRowsErr.message }, { status: 500 })

  const totals = (statRows || []).reduce(
    (acc, r) => {
      acc.games_played += r.games_played ?? 0
      acc.games_won += r.games_won ?? 0
      return acc
    },
    { games_played: 0, games_won: 0 },
  )

  return NextResponse.json({
    stats: {
      totalUsers: totalUsers ?? 0,
      totalStatsRows: totalStatsRows ?? 0,
      totalGamesPlayed: totals.games_played,
      totalGamesWon: totals.games_won,
    },
  })
}

