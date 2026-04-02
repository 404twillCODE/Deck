import { createClient } from '@/lib/supabase/client'

export async function recordGameResult(userId: string, gameType: string, won: boolean) {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('game_stats')
    .select('id, games_played, games_won')
    .eq('user_id', userId)
    .eq('game_type', gameType)
    .single()

  if (existing) {
    await supabase
      .from('game_stats')
      .update({
        games_played: existing.games_played + 1,
        games_won: existing.games_won + (won ? 1 : 0),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('game_stats').insert({
      user_id: userId,
      game_type: gameType,
      games_played: 1,
      games_won: won ? 1 : 0,
    })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('games_played, games_won')
    .eq('id', userId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({
        games_played: profile.games_played + 1,
        games_won: profile.games_won + (won ? 1 : 0),
      })
      .eq('id', userId)
  }
}
