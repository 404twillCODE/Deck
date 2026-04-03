-- FunDeck — Supabase Schema
-- Run this in the Supabase SQL editor to set up your database.
-- Safe to re-run — all statements are idempotent.

-- Profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  username text unique,
  display_name text not null default 'Player',
  avatar_url text,
  chips_balance integer not null default 10000,
  games_played integer not null default 0,
  games_won integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies (drop + recreate to be idempotent)
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
-- Users can only change their chips by resetting to 10,000.
-- For any other self-updates (like display_name), `chips_balance` is unchanged,
-- so the policy allows the update when new chips_balance matches the old value.
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      chips_balance = (
        select p.chips_balance
        from public.profiles p
        where p.id = auth.uid()
      )
      or chips_balance = 10000
    )
  );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Player')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at auto-update
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- Per-game stats for leaderboard
create table if not exists public.game_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_type text not null,
  games_played integer not null default 0,
  games_won integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, game_type)
);

alter table public.game_stats enable row level security;

drop policy if exists "Game stats are viewable by everyone" on public.game_stats;
create policy "Game stats are viewable by everyone"
  on public.game_stats for select
  using (true);

drop policy if exists "Users can upsert own game stats" on public.game_stats;
create policy "Users can upsert own game stats"
  on public.game_stats for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own game stats" on public.game_stats;
create policy "Users can update own game stats"
  on public.game_stats for update
  using (auth.uid() = user_id);

drop trigger if exists game_stats_updated_at on public.game_stats;
create trigger game_stats_updated_at
  before update on public.game_stats
  for each row execute procedure public.update_updated_at();
