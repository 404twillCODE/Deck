import { createBrowserClient } from '@supabase/ssr'

declare global {
  // eslint-disable-next-line no-var
  var __deckSupabaseBrowserClient: ReturnType<typeof createBrowserClient> | undefined
  // eslint-disable-next-line no-var
  var __deckSupabaseStorageMode: 'local' | 'session' | undefined
  // eslint-disable-next-line no-var
  var __deckSupabaseLocks: Map<string, Promise<void>> | undefined
}

export const SUPABASE_STORAGE_KEY = 'deck.supabase.auth'
export const SUPABASE_REMEMBER_ME_KEY = 'deck.auth.remember'

export function getRememberMe(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = localStorage.getItem(SUPABASE_REMEMBER_ME_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

export function setRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SUPABASE_REMEMBER_ME_KEY, remember ? '1' : '0')
  } catch { /* ignore */ }
}

function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(SUPABASE_STORAGE_KEY) } catch { /* ignore */ }
  try { sessionStorage.removeItem(SUPABASE_STORAGE_KEY) } catch { /* ignore */ }
}

async function inMemoryLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  // A simple per-tab lock to avoid auth-js navigator.locks flakiness.
  // This keeps Supabase auth from getting stuck and removes the need to clear storage.
  const locks = (globalThis.__deckSupabaseLocks ??= new Map<string, Promise<void>>())
  const prev = locks.get(name) ?? Promise.resolve()

  let release!: () => void
  const next = new Promise<void>((resolve) => { release = resolve })
  locks.set(name, prev.then(() => next))

  try {
    await prev
    return await fn()
  } finally {
    release()
    // If no one chained after us, clean up
    if (locks.get(name) === prev.then(() => next)) {
      // best-effort cleanup; map may have advanced
      locks.delete(name)
    }
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    if (typeof window === 'undefined') {
      return new Proxy(
        {},
        {
          get() {
            throw new Error('Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
          },
        },
      ) as any
    }
    throw new Error('Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (!/^https?:\/\//.test(url)) {
    throw new Error('Supabase URL is invalid: NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://')
  }

  // Use a global singleton so Next.js HMR / module reloads don't create
  // multiple auth clients and fight over navigator.locks.
  const mode: 'local' | 'session' = typeof window !== 'undefined' && getRememberMe() ? 'local' : 'session'
  if (typeof window !== 'undefined' && globalThis.__deckSupabaseBrowserClient && globalThis.__deckSupabaseStorageMode === mode) {
    return globalThis.__deckSupabaseBrowserClient
  }

  // If the storage mode changed (user toggled Remember Me), reset client + storage.
  if (typeof window !== 'undefined' && globalThis.__deckSupabaseBrowserClient && globalThis.__deckSupabaseStorageMode !== mode) {
    globalThis.__deckSupabaseBrowserClient = undefined
    clearSupabaseAuthStorage()
  }

  const client = createBrowserClient(url, anonKey, {
    auth: {
      storageKey: SUPABASE_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined'
        ? (mode === 'local' ? localStorage : sessionStorage)
        : undefined,
      lock: (name: string, _acquireTimeout: number, fn: () => Promise<any>) => inMemoryLock(name, fn),
    },
  })

  if (typeof window !== 'undefined') {
    globalThis.__deckSupabaseBrowserClient = client
    globalThis.__deckSupabaseStorageMode = mode
  }

  return client
}
