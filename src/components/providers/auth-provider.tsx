'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { UserProfile } from '@/types'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    async function getInitialSession() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

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
      } else {
        setUser(null)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            setUser(profile as UserProfile)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return <>{children}</>
}
