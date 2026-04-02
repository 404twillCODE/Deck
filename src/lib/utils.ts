import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Same charset as `generateRoomCode` — used to tell a room code from a game name search. */
export const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const

export const ROOM_CODE_LENGTH = 6

export function generateRoomCode(): string {
  const chars = ROOM_CODE_CHARSET
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** Uppercase A–Z / digits only, max 6 — for controlled inputs. */
export function normalizeRoomCodeInput(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH)
}

/** True if the string is exactly 6 characters from the same alphabet as generated room codes. */
export function looksLikeRoomCode(s: string): boolean {
  const t = normalizeRoomCodeInput(s)
  if (t.length !== ROOM_CODE_LENGTH) return false
  return [...t].every((c) => ROOM_CODE_CHARSET.includes(c))
}

export function formatChips(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return amount.toString()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
