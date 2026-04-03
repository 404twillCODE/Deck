import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

export function isAdmin(profile: UserProfile | null | undefined) {
  return profile?.role === 'admin'
}

export function isModerator(profile: UserProfile | null | undefined) {
  return profile?.role === 'moderator'
}

export async function getSessionProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null

  // Ensure fields exist even if the DB row predates the migration.
  return {
    ...(profile as unknown as UserProfile),
    role: (profile as unknown as UserProfile).role ?? 'user',
    is_disabled: (profile as unknown as UserProfile).is_disabled ?? false,
    is_banned: (profile as unknown as UserProfile).is_banned ?? false,
  }
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await getSessionProfile()
  if (!profile || !isAdmin(profile)) throw new Error('Admin required')
  return profile
}

export async function requireModerator(): Promise<UserProfile> {
  const profile = await getSessionProfile()
  if (!profile || (!isAdmin(profile) && !isModerator(profile))) throw new Error('Moderator required')
  return profile
}

