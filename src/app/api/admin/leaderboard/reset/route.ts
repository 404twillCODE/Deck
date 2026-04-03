import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import type { GameType } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin()
    const body = await request.json().catch(() => ({})) as { gameType?: 'all' | GameType }

    const gameType = body.gameType ?? 'all'
    if (gameType !== 'all' && !['blackjack', 'poker', 'uno', 'hot-potato'].includes(gameType)) {
      return NextResponse.json({ error: 'Invalid gameType' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const updatePayload = { games_played: 0, games_won: 0 }
    let query = supabase.from('game_stats').update(updatePayload)

    if (gameType !== 'all') query = query.eq('game_type', gameType)

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await writeAdminAuditLog({
        actor,
        actionType: 'leaderboard_reset',
        payload: { game_type: gameType },
      })
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

