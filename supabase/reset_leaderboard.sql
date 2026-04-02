-- Run once in the Supabase SQL editor to reset leaderboard stats for everyone.
-- This keeps user accounts and profiles, but clears all recorded wins/plays.

begin;

delete from public.game_stats;

update public.profiles
set
  games_played = 0,
  games_won = 0,
  updated_at = now();

commit;
