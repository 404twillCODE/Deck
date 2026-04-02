'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { isGuestMode, getGuestProfile } from '@/lib/guest'
import type { UserProfile } from '@/types'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setGuest, setLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    void (async () => {
      setLoading(true)
      try {
        // Prefer local session hydration to avoid a network round-trip
        // and reduce cases where UI looks "stuck" after sign-in.
        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData.session?.user ?? null

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (profile) {
            setUser(profile as UserProfile)
          } else {
            setUser({
              id: user.id,
              email: user.email || '',
              username: user.email?.split('@')[0] || 'player',
              display_name: user.user_metadata?.display_name || 'Player',
              chips_balance: 10000,
              games_played: 0,
              games_won: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } else if (isGuestMode()) {
          const guestProfile = getGuestProfile()
          if (guestProfile) {
            setGuest(guestProfile as UserProfile)
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profile) {
              setUser(profile as UserProfile)
            } else {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                username: session.user.email?.split('@')[0] || 'player',
                display_name: session.user.user_metadata?.display_name || 'Player',
                chips_balance: 10000,
                games_played: 0,
                games_won: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
          } catch {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              username: session.user.email?.split('@')[0] || 'player',
              display_name: session.user.user_metadata?.display_name || 'Player',
              chips_balance: 10000,
              games_played: 0,
              games_won: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setGuest, setLoading])

  return <>{children}</>
}
