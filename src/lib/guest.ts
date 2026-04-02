const COOKIE_KEY = 'deck_guest'
const LS_ID_KEY = 'deck_guest_id'
const LS_NAME_KEY = 'deck_guest_name'

export function enableGuestMode(name?: string) {
  const displayName = name?.trim()
  if (!displayName || displayName.length < 2) {
    throw new Error('Guest name is required')
  }
  let guestId = typeof window !== 'undefined' ? localStorage.getItem(LS_ID_KEY) : null
  if (!guestId) {
    guestId = `guest-${crypto.randomUUID()}`
  }

  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
  localStorage.setItem(LS_ID_KEY, guestId)
  localStorage.setItem(LS_NAME_KEY, displayName)
  return { id: guestId, displayName }
}

export function clearGuestMode() {
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0`
  localStorage.removeItem(LS_ID_KEY)
  localStorage.removeItem(LS_NAME_KEY)
}

export function isGuestMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_ID_KEY) !== null
}

export function getGuestProfile() {
  if (typeof window === 'undefined') return null
  const id = localStorage.getItem(LS_ID_KEY)
  const name = localStorage.getItem(LS_NAME_KEY)
  if (!id) return null
  return {
    id,
    email: '',
    username: name || 'Guest',
    display_name: name || 'Guest',
    chips_balance: 0,
    games_played: 0,
    games_won: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
