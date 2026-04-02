'use client'

import { useEffect } from 'react'
import { createClient, SUPABASE_STORAGE_KEY } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { isGuestMode, getGuestProfile } from '@/lib/guest'
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
  const { setUser, setGuest, setLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()
    setLoading(true)

    async function syncUser(user: User | null) {
      if (!user) {
        if (isGuestMode()) {
          const guestProfile = getGuestProfile()
          if (guestProfile) {
            setGuest(guestProfile as UserProfile)
            return
          }
        }
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

    // Fast initial hydration from local session to avoid a network round-trip.
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData.session?.user ?? null
        await syncUser(user)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('NavigatorLock') || msg.toLowerCase().includes('lock')) {
          try { localStorage.removeItem(SUPABASE_STORAGE_KEY) } catch { /* ignore */ }
          try { sessionStorage.removeItem(SUPABASE_STORAGE_KEY) } catch { /* ignore */ }
          try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* ignore */ }
        }
        setUser(null)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          await syncUser(session?.user ?? null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setGuest, setLoading])

  return <>{children}</>
}
