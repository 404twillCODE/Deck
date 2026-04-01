import type { Env } from './types'

export { BlackjackTableDO } from './durable-objects/blackjack-table'
export { PokerTableDO } from './durable-objects/poker-table'

const ALLOWED_ORIGINS = new Set([
  'https://deck-mu.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
])

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(request: Request, data: unknown, status = 200): Response {
  const origin = request.headers.get('Origin')
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get('Origin')
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// In-memory room registry (maps code → gameType). Survives within a single
// isolate lifetime which is fine for dev; in production rooms are ephemeral anyway.
const roomRegistry = new Map<string, 'blackjack' | 'poker'>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) })
    }

    // ─── REST: Create Room ────────────────────────────────

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      let body: {
        code?: string
        gameType?: 'blackjack' | 'poker'
        hostId?: string
        maxPlayers?: number
        startingChips?: number
        minimumBet?: number
      }

      try {
        body = await request.json()
      } catch {
        return json(request, { error: 'Invalid JSON body' }, 400)
      }

      if (!body.code || !body.gameType) {
        return json(request, { error: 'Missing required fields: code, gameType' }, 400)
      }

      const hostId = body.hostId || 'pending'

      try {
        const namespace = body.gameType === 'poker' ? env.POKER_TABLE : env.BLACKJACK_TABLE
        const id = namespace.idFromName(body.code)
        const stub = namespace.get(id)

        const initResponse = await stub.fetch(new Request('https://internal/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: body.code,
            hostId,
            settings: {
              gameType: body.gameType,
              maxPlayers: body.maxPlayers || (body.gameType === 'poker' ? 6 : 5),
              startingChips: body.startingChips || 10000,
              minimumBet: body.minimumBet || (body.gameType === 'poker' ? 100 : 50),
            },
          }),
        }))

        if (!initResponse.ok) {
          return json(request, { error: 'Failed to initialize room' }, 500)
        }

        roomRegistry.set(body.code, body.gameType)

        return json(request, {
          success: true,
          room: {
            code: body.code,
            gameType: body.gameType,
            hostId,
          },
        })
      } catch (err) {
        return json(request, { error: 'Room initialization failed', detail: String(err) }, 500)
      }
    }

    // ─── REST: Lookup Room ────────────────────────────────

    const roomLookupMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)$/)
    if (roomLookupMatch && request.method === 'GET') {
      const code = roomLookupMatch[1]
      const gameType = roomRegistry.get(code)
      if (gameType) {
        return json(request, { code, gameType })
      }
      // Room not in registry — could have been created in a different isolate.
      // Try both DOs by querying their /info endpoint.
      for (const type of ['blackjack', 'poker'] as const) {
        const ns = type === 'poker' ? env.POKER_TABLE : env.BLACKJACK_TABLE
        const id = ns.idFromName(code)
        const stub = ns.get(id)
        try {
          const res = await stub.fetch(new Request('https://internal/info'))
          if (res.ok) {
            const info = await res.json() as { active: boolean; gameType: string }
            if (info.active) {
              roomRegistry.set(code, type)
              return json(request, { code, gameType: type })
            }
          }
        } catch { /* ignore */ }
      }
      return json(request, { error: 'Room not found' }, 404)
    }

    // ─── REST: Health ─────────────────────────────────────

    if (url.pathname === '/api/health') {
      return json(request, { status: 'ok', timestamp: Date.now() })
    }

    // ─── WebSocket: Room Connection ───────────────────────

    const wsMatch = url.pathname.match(/^\/ws\/room\/([A-Z0-9]+)$/i)
    if (wsMatch) {
      const upgradeHeader = request.headers.get('Upgrade')
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return withCors(request, new Response('Expected WebSocket upgrade', { status: 426 }))
      }

      const roomCode = wsMatch[1].toUpperCase()
      const gameType = url.searchParams.get('game') || roomRegistry.get(roomCode) || 'blackjack'
      roomRegistry.set(roomCode, gameType as 'blackjack' | 'poker')

      const namespace = gameType === 'poker' ? env.POKER_TABLE : env.BLACKJACK_TABLE
      const id = namespace.idFromName(roomCode)
      const stub = namespace.get(id)

      return stub.fetch(new Request(`https://internal/ws?room=${roomCode}`, {
        headers: request.headers,
      }))
    }

    // ─── Fallback ─────────────────────────────────────────

    return json(request, { error: 'Not found' }, 404)
  },
}
