export interface UserProfile {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: string
  chips_balance: number
  games_played: number
  games_won: number
  created_at: string
  updated_at: string

  // Admin/moderation fields (backed by Supabase RLS policies).
  role?: 'admin' | 'moderator' | 'user'
  is_disabled?: boolean
  is_banned?: boolean
}

export interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}
