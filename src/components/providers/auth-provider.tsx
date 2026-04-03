'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { UserProfile } from '@/types'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

type InitialAuthUser = Pick<User, 'id' | 'email' | 'user_metadata'>

function toProfile(user: User, dbRow: Record<string, unknown> | null): UserProfile {
  if (dbRow) {
    const row = dbRow as unknown as UserProfile
    return {
      ...row,
      role: row.role ?? 'user',
      is_disabled: row.is_disabled ?? false,
      is_banned: row.is_banned ?? false,
      chips_balance: typeof row.chips_balance === 'number' ? row.chips_balance : 10000,
    }
  }
  return {
    id: user.id,
    email: user.email || '',
    username: user.email?.split('@')[0] || 'player',
    display_name: user.user_metadata?.display_name || 'Player',
    chips_balance: 10000,
    games_played: 0,
    games_won: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'user',
    is_disabled: false,
    is_banned: false,
  }
}

export function AuthProvider({
  children,
  initialAuthUser,
}: {
  children: React.ReactNode
  initialAuthUser: InitialAuthUser | null
}) {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    async function resolve(user: User | null) {
      if (!user) {
        setUser(null)
        return
      }

      // Never block auth on profile loading. A valid auth user should hydrate
      // immediately even if the profiles table is missing, slow, or blocked.
      setUser(toProfile(user, null))

      try {
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        const timeoutPromise = new Promise<null>((resolveTimeout) => {
          setTimeout(() => resolveTimeout(null), 4000)
        })

        const result = await Promise.race([profilePromise, timeoutPromise])

        if (result && 'data' in result && result.data) {
          setUser(toProfile(user, result.data as Record<string, unknown>))
        }
      } catch {
        // Ignore profile loading failures during auth bootstrap.
      }
    }

    void (async () => {
      try {
        if (initialAuthUser) {
          console.log('[auth-provider] server initial user →', initialAuthUser.id)
          await resolve(initialAuthUser as User)
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        console.log('[auth-provider] getUser →', user ? user.id : 'null')
        await resolve(user)
      } catch {
        console.log('[auth-provider] getUser threw')
        setUser(null)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[auth-provider] onAuthStateChange →', event)
        if (event === 'SIGNED_OUT') {
          setUser(null)
          return
        }
        if (session?.user) {
          await resolve(session.user)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [initialAuthUser, setUser, setLoading])

  return <>{children}</>
}
