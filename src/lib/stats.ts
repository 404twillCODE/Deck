import { createClient } from '@/lib/supabase/client'
import type { GameType } from '@/types'

type GameStatRow = {
  id: string
  games_played: number
  games_won: number
}

export function getGameStatLabels(gameType: 'all' | GameType) {
  if (gameType === 'blackjack' || gameType === 'poker') {
    return {
      playedLabel: 'Hands',
      wonLabel: 'Hands Won',
      playedNoun: 'hand',
      wonNoun: 'hand win',
    }
  }

  return {
    playedLabel: 'Games',
    wonLabel: 'Wins',
    playedNoun: 'game',
    wonNoun: 'win',
  }
}

export async function recordGameResult(
  userId: string,
  gameType: GameType,
  won: boolean,
) {
  const supabase = createClient()

  const { data: existing, error } = await supabase
    .from('game_stats')
    .select('id, games_played, games_won')
    .eq('user_id', userId)
    .eq('game_type', gameType)
    .maybeSingle()

  if (error) throw error

  if (existing) {
    const row = existing as GameStatRow
    const { error: updateError } = await supabase
      .from('game_stats')
      .update({
        games_played: row.games_played + 1,
        games_won: row.games_won + (won ? 1 : 0),
      })
      .eq('id', row.id)

    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase.from('game_stats').insert({
    user_id: userId,
    game_type: gameType,
    games_played: 1,
    games_won: won ? 1 : 0,
  })

  if (insertError) throw insertError
}
