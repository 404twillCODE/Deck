import type { Env } from './types'

export { BlackjackTableDO } from './durable-objects/blackjack-table'
export { PokerTableDO } from './durable-objects/poker-table'
export { UnoTableDO } from './durable-objects/uno-table'
export { HotPotatoTableDO } from './durable-objects/hot-potato-table'

const ALLOWED_ORIGINS = new Set([
  'https://deck-mu.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
])

function isPrivateDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    const h = u.hostname
    if (h === 'localhost' || h === '127.0.0.1') return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true
    return false
  } catch {
    return false
  }
}

function pickCorsOrigin(origin: string | null, env: Env): string {
  if (!origin) return ''
  if (ALLOWED_ORIGINS.has(origin)) return origin
  // Allow private-network origins (localhost/LAN) for local dev/testing.
  // This avoids brittle dependence on ENVIRONMENT being set correctly.
  if (isPrivateDevOrigin(origin)) return origin
  return ''
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowedOrigin = pickCorsOrigin(origin, env)
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(request: Request, env: Env, data: unknown, status = 200): Response {
  const origin = request.headers.get('Origin')
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
  })
}

function withCors(request: Request, env: Env, response: Response): Response {
  const origin = request.headers.get('Origin')
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders(origin, env))) headers.set(k, v)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// In-memory room registry (maps code → gameType). Survives within a single
// isolate lifetime which is fine for dev; in production rooms are ephemeral anyway.
const roomRegistry = new Map<string, 'blackjack' | 'poker' | 'uno' | 'hot-potato'>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin'), env) })
    }

    // ─── REST: Create Room ────────────────────────────────

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let body: {
        code?: string
        gameType?: 'blackjack' | 'poker' | 'uno' | 'hot-potato'
        hostId?: string
        maxPlayers?: number
        startingChips?: number
        minimumBet?: number
        cardsPerPlayer?: number
        winsToWin?: number
        freePlay?: boolean
      }

      try {
        body = await request.json()
      } catch {
        return json(request, env, { error: 'Invalid JSON body' }, 400)
      }

      if (!body.code || !body.gameType) {
        return json(request, env, { error: 'Missing required fields: code, gameType' }, 400)
      }

      const hostId = body.hostId || 'pending'

      try {
        const namespace = body.gameType === 'poker' ? env.POKER_TABLE : body.gameType === 'uno' ? env.UNO_TABLE : body.gameType === 'hot-potato' ? env.HOT_POTATO_TABLE : env.BLACKJACK_TABLE
        const id = namespace.idFromName(body.code)
        const stub = namespace.get(id)

        const defaultMax = body.gameType === 'poker' ? 6 : body.gameType === 'hot-potato' ? 8 : 5

        const baseSettings = {
          gameType: body.gameType,
          maxPlayers: body.maxPlayers || defaultMax,
          startingChips: body.startingChips || (body.gameType === 'hot-potato' ? 0 : 10000),
          minimumBet: body.minimumBet || (body.gameType === 'poker' ? 100 : 50),
        }
        const unoExtras =
          body.gameType === 'uno'
            ? {
                ...(typeof body.cardsPerPlayer === 'number' && { cardsPerPlayer: body.cardsPerPlayer }),
                ...(typeof body.winsToWin === 'number' && { winsToWin: body.winsToWin }),
              }
            : {}

        const initResponse = await stub.fetch(new Request('https://internal/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: body.code,
            hostId,
            settings: { ...baseSettings, ...unoExtras, freePlay: body.freePlay === true },
          }),
        }))

        if (!initResponse.ok) {
          return json(request, env, { error: 'Failed to initialize room' }, 500)
        }

        roomRegistry.set(body.code, body.gameType)

        return json(request, env, {
          success: true,
          room: {
            code: body.code,
            gameType: body.gameType,
            hostId,
          },
        })
      } catch (err) {
        return json(request, env, { error: 'Room initialization failed', detail: String(err) }, 500)
      }
    }

    // ─── REST: Lookup Room ────────────────────────────────

    const roomLookupMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)$/)
    if (roomLookupMatch && request.method === 'GET') {
      const code = roomLookupMatch[1]
      const gameType = roomRegistry.get(code)
      if (gameType) {
            // When the room is in the local registry, we only know gameType.
            // The durable object /info endpoint is queried for freePlay below if needed.
            return json(request, env, { code, gameType })
      }
      // Room not in registry — could have been created in a different isolate.
      // Try both DOs by querying their /info endpoint.
      for (const type of ['blackjack', 'poker', 'uno', 'hot-potato'] as const) {
        const ns = type === 'poker' ? env.POKER_TABLE : type === 'uno' ? env.UNO_TABLE : type === 'hot-potato' ? env.HOT_POTATO_TABLE : env.BLACKJACK_TABLE
        const id = ns.idFromName(code)
        const stub = ns.get(id)
        try {
          const res = await stub.fetch(new Request('https://internal/info'))
          if (res.ok) {
            const info = await res.json() as { active: boolean; gameType: string; freePlay?: boolean }
            if (info.active) {
              roomRegistry.set(code, type)
              return json(request, env, { code, gameType: type, freePlay: !!info.freePlay })
            }
          }
        } catch { /* ignore */ }
      }
      return json(request, env, { error: 'Room not found' }, 404)
    }

    // ─── REST: Toggle Free Play ────────────────────────────
    const freeplayMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/freeplay$/)
    if (freeplayMatch && request.method === 'POST') {
      const code = freeplayMatch[1]
      let body: { freePlay?: boolean } = {}
      try {
        body = await request.json() as { freePlay?: boolean }
      } catch {
        return json(request, env, { error: 'Invalid JSON body' }, 400)
      }

      const freePlay = body.freePlay === true

      let gameType = roomRegistry.get(code)
      if (!gameType) {
        for (const type of ['blackjack', 'poker', 'uno', 'hot-potato'] as const) {
          const ns = type === 'poker' ? env.POKER_TABLE : type === 'uno' ? env.UNO_TABLE : type === 'hot-potato' ? env.HOT_POTATO_TABLE : env.BLACKJACK_TABLE
          const id = ns.idFromName(code)
          const stub = ns.get(id)
          try {
            const res = await stub.fetch(new Request('https://internal/info'))
            if (res.ok) {
              const info = await res.json() as { active: boolean; gameType: string }
              if (info.active) {
                gameType = type
                break
              }
            }
          } catch { /* ignore */ }
        }
      }

      if (!gameType) return json(request, env, { error: 'Room not found' }, 404)

      const namespace =
        gameType === 'poker' ? env.POKER_TABLE
          : gameType === 'uno' ? env.UNO_TABLE
            : gameType === 'hot-potato' ? env.HOT_POTATO_TABLE
              : env.BLACKJACK_TABLE

      const id = namespace.idFromName(code)
      const stub = namespace.get(id)

      try {
        const toggleRes = await stub.fetch(new Request('https://internal/freeplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freePlay }),
        }))
        if (!toggleRes.ok) {
          const err = await toggleRes.json().catch(() => ({}))
          return json(request, env, { error: err?.error || 'Failed to update free play' }, toggleRes.status)
        }
      } catch {
        // If the room isolate is gone, treat it as not found.
        return json(request, env, { error: 'Room not found' }, 404)
      }

      return json(request, env, { success: true, freePlay })
    }

    // ─── REST: Health ─────────────────────────────────────

    if (url.pathname === '/api/health') {
      return json(request, env, { status: 'ok', timestamp: Date.now() })
    }

    // ─── WebSocket: Room Connection ───────────────────────

    const wsMatch = url.pathname.match(/^\/ws\/room\/([A-Z0-9]+)$/i)
    if (wsMatch) {
      const upgradeHeader = request.headers.get('Upgrade')
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return withCors(request, env, new Response('Expected WebSocket upgrade', { status: 426 }))
      }

      const roomCode = wsMatch[1].toUpperCase()
      const gameType = url.searchParams.get('game') || roomRegistry.get(roomCode) || 'blackjack'
      roomRegistry.set(roomCode, gameType as 'blackjack' | 'poker' | 'uno' | 'hot-potato')

      const namespace = gameType === 'poker' ? env.POKER_TABLE : gameType === 'uno' ? env.UNO_TABLE : gameType === 'hot-potato' ? env.HOT_POTATO_TABLE : env.BLACKJACK_TABLE
      const id = namespace.idFromName(roomCode)
      const stub = namespace.get(id)

      return stub.fetch(new Request(`https://internal/ws?room=${roomCode}`, {
        headers: request.headers,
      }))
    }

    // ─── Fallback ─────────────────────────────────────────

    return json(request, env, { error: 'Not found' }, 404)
  },
}
