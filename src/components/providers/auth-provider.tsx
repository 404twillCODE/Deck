'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { UserProfile } from '@/types'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

function fallbackProfile(user: User): UserProfile {
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
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore()
  const initialised = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    async function syncUser(user: User | null) {
      if (!user) {
        setUser(null)
        return
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setUser(profile ? (profile as UserProfile) : fallbackProfile(user))
      } catch {
        setUser(fallbackProfile(user))
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          return
        }

        // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        await syncUser(session?.user ?? null)
        initialised.current = true
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return <>{children}</>
}
