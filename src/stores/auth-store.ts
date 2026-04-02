import { create } from 'zustand'
import type { UserProfile } from '@/types'

interface AuthStore {
  user: UserProfile | null
  isGuest: boolean
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  setGuest: (user: UserProfile) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isGuest: false,
  isLoading: true,
  setUser: (user) => set({ user, isGuest: false, isLoading: false }),
  setGuest: (user) => set({ user, isGuest: true, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, isGuest: false, isLoading: false }),
}))
