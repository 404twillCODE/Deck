const BRAND_COOKIE_KEY = 'fundek_guest'
const BRAND_LS_ID_KEY = 'fundek_guest_id'
const BRAND_LS_NAME_KEY = 'fundek_guest_name'

const LEGACY_COOKIE_KEY = 'deck_guest'
const LEGACY_LS_ID_KEY = 'deck_guest_id'
const LEGACY_LS_NAME_KEY = 'deck_guest_name'

function readLocalStorageWithLegacyPreference<T>(primaryKey: string, legacyKey: string): T | null {
  if (typeof window === 'undefined') return null
  const primary = localStorage.getItem(primaryKey)
  if (primary !== null) return primary as unknown as T
  const legacy = localStorage.getItem(legacyKey)
  return legacy as unknown as T | null
}

export function enableGuestMode(name?: string) {
  const displayName = name?.trim() || `Guest #${Math.floor(Math.random() * 9000 + 1000)}`

  let guestId = readLocalStorageWithLegacyPreference<string>(BRAND_LS_ID_KEY, LEGACY_LS_ID_KEY)
  if (!guestId) {
    guestId = `guest-${crypto.randomUUID()}`
  }

  document.cookie = `${BRAND_COOKIE_KEY}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
  document.cookie = `${LEGACY_COOKIE_KEY}=; path=/; max-age=0`

  localStorage.setItem(BRAND_LS_ID_KEY, guestId)
  localStorage.setItem(BRAND_LS_NAME_KEY, displayName)
  localStorage.removeItem(LEGACY_LS_ID_KEY)
  localStorage.removeItem(LEGACY_LS_NAME_KEY)
  return { id: guestId, displayName }
}

export function clearGuestMode() {
  document.cookie = `${BRAND_COOKIE_KEY}=; path=/; max-age=0`
  document.cookie = `${LEGACY_COOKIE_KEY}=; path=/; max-age=0`
  localStorage.removeItem(BRAND_LS_ID_KEY)
  localStorage.removeItem(BRAND_LS_NAME_KEY)
  localStorage.removeItem(LEGACY_LS_ID_KEY)
  localStorage.removeItem(LEGACY_LS_NAME_KEY)
}

export function isGuestMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    localStorage.getItem(BRAND_LS_ID_KEY) !== null ||
    localStorage.getItem(LEGACY_LS_ID_KEY) !== null
  )
}

export function getGuestProfile() {
  if (typeof window === 'undefined') return null
  const id = readLocalStorageWithLegacyPreference<string>(BRAND_LS_ID_KEY, LEGACY_LS_ID_KEY)
  const name = readLocalStorageWithLegacyPreference<string>(BRAND_LS_NAME_KEY, LEGACY_LS_NAME_KEY)
  if (!id) return null

  // Seamless migration: if the user only has legacy keys, re-save under the new keys.
  if (
    localStorage.getItem(BRAND_LS_ID_KEY) === null ||
    localStorage.getItem(BRAND_LS_NAME_KEY) === null
  ) {
    localStorage.setItem(BRAND_LS_ID_KEY, id)
    localStorage.setItem(BRAND_LS_NAME_KEY, name || 'Guest')
    localStorage.removeItem(LEGACY_LS_ID_KEY)
    localStorage.removeItem(LEGACY_LS_NAME_KEY)
  }

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
    role: 'user',
    is_disabled: false,
    is_banned: false,
  }
}
