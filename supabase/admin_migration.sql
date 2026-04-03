-- FunDeck Admin Migration
-- Run in Supabase SQL editor (or as part of your migration flow).
-- This migration is written to be re-runnable (idempotent where reasonably possible).
--
-- Admin bootstrap:
-- The initial admin is the user whose auth email matches:
--   beetogle@gmail.com

begin;

-- 1) Add admin/role + moderation flags to profiles
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    alter table public.profiles add column role text not null default 'user';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_disabled'
  ) then
    alter table public.profiles add column is_disabled boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_banned'
  ) then
    alter table public.profiles add column is_banned boolean not null default false;
  end if;
end $$;

-- 2) Backfill existing rows: make beetogle@gmail.com the sole initial admin
update public.profiles
set role = 'admin'
where lower(email) = lower('beetogle@gmail.com');

-- 3) Helper: robust admin check function for RLS policies
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- 3b) Helper: moderator check function for RLS policies
create or replace function public.is_moderator()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'moderator'
  );
$$;

-- 4) Update handle_new_user trigger to set role for the bootstrap admin
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, display_name, role, is_disabled, is_banned)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Player'),
    case
      when lower(new.email) = lower('beetogle@gmail.com') then 'admin'
      else 'user'
    end,
    false,
    false
  );
  return new;
end;
$$ language plpgsql security definer;

-- Ensure trigger exists (safe to re-run)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5) RLS: allow admins to update any profile (role + moderation fields)
-- Existing policy "Users can update own profile" remains in place.
-- Policies are additive: admin update is permitted only when is_admin() is true.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles
  for update
  using (public.is_admin())
  with check (true);

-- 5c) RLS: allow moderators to update user flags/chips/display_name
-- Moderators cannot change roles.
drop policy if exists "Moderators can update user flags/chips" on public.profiles;
create policy "Moderators can update user flags/chips"
  on public.profiles
  for update
  using (
    public.is_moderator()
    and role = 'user'
  )
  with check (
    role = 'user'
  );

-- 5b) Harden non-admin self-updates:
-- Normal users may update their own profile, but they must NOT be able to
-- change role or moderation flags.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role in ('user', 'moderator')
    and is_disabled = false
    and is_banned = false
    and (
      chips_balance = (
        select p.chips_balance
        from public.profiles p
        where p.id = auth.uid()
      )
      or chips_balance = 10000
    )
  );

-- 5c) Hard enforcement: non-admins may only reset chips to exactly 10,000.
-- This prevents client-side abuse (attempting to set chips_balance to other values).
create or replace function public.enforce_user_chips_reset()
returns trigger as $$
begin
  if new.chips_balance is distinct from old.chips_balance then
    if not (public.is_admin() or public.is_moderator()) then
      if new.chips_balance <> 10000 then
        raise exception 'Invalid chips_balance change. You can only reset to 10,000.'
          using hint = 'Allowed: chips reset to 10,000 only.';
      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_enforce_chips_reset on public.profiles;
create trigger profiles_enforce_chips_reset
  before update of chips_balance
  on public.profiles
  for each row execute procedure public.enforce_user_chips_reset();

-- Normal users may insert their own profile row.
-- (The signup trigger creates profiles; this policy is mainly a safety net.)
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
  );

-- 6) Helpful indexes for admin search/filtering
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_disabled_idx on public.profiles(is_disabled);
create index if not exists profiles_banned_idx on public.profiles(is_banned);

-- 7) Admin audit log
-- Records who performed what admin/mod action.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null default 'user',
  action_type text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Audit log readable by admins/moderators" on public.admin_audit_log;
create policy "Audit log readable by admins/moderators"
  on public.admin_audit_log
  for select
  using (
    public.is_admin() or public.is_moderator()
  );

drop policy if exists "Audit log writable by admins/moderators" on public.admin_audit_log;
create policy "Audit log writable by admins/moderators"
  on public.admin_audit_log
  for insert
  with check (
    public.is_admin() or public.is_moderator()
  );

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_action_type_idx on public.admin_audit_log(action_type);

-- 8) Leaderboard editing: allow admins to insert/update any game_stats row
drop policy if exists "Admins can update any game_stats" on public.game_stats;
create policy "Admins can update any game_stats"
  on public.game_stats
  for update
  using (public.is_admin())
  with check (true);

drop policy if exists "Admins can insert any game_stats" on public.game_stats;
create policy "Admins can insert any game_stats"
  on public.game_stats
  for insert
  with check (public.is_admin());

commit;

