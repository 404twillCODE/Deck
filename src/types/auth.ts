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
}

export interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}
