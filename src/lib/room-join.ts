import { enableGuestMode, isGuestMode } from '@/lib/guest'
import { normalizeRoomCodeInput } from '@/lib/utils'

type RouterPush = (href: string) => void

/**
 * Navigate to a room by code (guest mode for joiners, worker lookup for game type).
 * Accepts 4–6 characters to match the hero “Go” button; prefer 6 for real codes.
 */
export async function joinRoomByCode(code: string, router: { push: RouterPush }): Promise<void> {
  const normalized = normalizeRoomCodeInput(code)
  if (normalized.length < 4) return

  if (!isGuestMode()) {
    enableGuestMode()
  }

  let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
  }

  try {
    const res = await fetch(`${workerUrl}/api/rooms/${normalized}`)
    if (res.ok) {
      const data = (await res.json()) as { gameType: string; freePlay?: boolean }
      router.push(`/room/${normalized}?game=${data.gameType}${data.freePlay ? '&freePlay=1' : ''}`)
    } else {
      router.push(`/room/${normalized}?game=blackjack`)
    }
  } catch {
    router.push(`/room/${normalized}?game=blackjack`)
  }
}
