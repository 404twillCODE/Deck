import { DurableObject } from 'cloudflare:workers'
import type { Env, ClientMessage, ServerMessage, TableSettings, Player } from '../types'

interface HotPotatoPlayerInternal extends Player {
  isAlive: boolean
  eliminatedRound: number | null
}

interface Connection {
  ws: WebSocket
  playerId: string
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / (0xFFFFFFFF + 1)
}

export class HotPotatoTableDO extends DurableObject<Env> {
  private connections: Map<string, Connection> = new Map()
  private roomCode = ''
  private hostId = ''
  private settings: TableSettings = { gameType: 'hot-potato', maxPlayers: 10, startingChips: 0, minimumBet: 0 }
  private players: HotPotatoPlayerInternal[] = []
  private isStarted = false

  private holderIndex = 0
  private roundNumber = 0
  private phase: 'waiting' | 'countdown' | 'passing' | 'exploded' | 'complete' = 'waiting'
  private eliminationOrder: string[] = []
  private winnerId: string | null = null
  private passCount = 0
  private roundStartedAt = 0
  private lastEliminatedId: string | null = null
  private explosionTimer: ReturnType<typeof setTimeout> | null = null
  private countdownTimer: ReturnType<typeof setTimeout> | null = null

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      server.accept()
      server.addEventListener('message', (event) => this.handleMessage(server, event.data as string))
      server.addEventListener('close', () => this.handleClose(server))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/info') {
      return new Response(JSON.stringify({
        active: this.roomCode !== '' || this.players.length > 0,
        gameType: 'hot-potato',
        players: this.players.length,
      }))
    }

    if (url.pathname === '/init' && request.method === 'POST') {
      const body = await request.json() as { code: string; hostId: string; settings: Partial<TableSettings> }
      this.roomCode = body.code
      this.hostId = body.hostId
      if (body.settings) this.settings = { ...this.settings, ...body.settings }
      return new Response(JSON.stringify({ success: true }))
    }

    return new Response('Not found', { status: 404 })
  }

  private handleMessage(ws: WebSocket, raw: string) {
    try {
      const message: ClientMessage = JSON.parse(raw)
      const connection = this.findConnection(ws)

      switch (message.type) {
        case 'ping':
          this.sendTo(ws, { type: 'pong' })
          break
        case 'join_room':
          this.handleJoin(ws, message.payload)
          break
        case 'leave_room':
          if (connection) this.handleLeave(connection.playerId)
          break
        case 'player_ready':
          if (connection) this.handleReady(connection.playerId)
          break
        case 'start_game':
          if (connection?.playerId === this.hostId) this.startGame()
          break
        case 'hp_pass':
          if (connection) this.handlePass(connection.playerId)
          break
        case 'chat_message':
          if (connection) {
            const player = this.players.find((p) => p.id === connection.playerId)
            if (player) {
              this.broadcastAll({
                type: 'chat',
                payload: {
                  playerId: connection.playerId,
                  username: player.username,
                  message: message.payload.message.slice(0, 200),
                  timestamp: Date.now(),
                },
              })
            }
          }
          break
      }
    } catch {
      this.sendTo(ws, { type: 'error', payload: { message: 'Invalid message' } })
    }
  }

  private handleClose(ws: WebSocket) {
    const connection = this.findConnection(ws)
    if (connection) {
      const player = this.players.find((p) => p.id === connection.playerId)
      if (player) player.isConnected = false
      this.connections.delete(connection.playerId)
      this.broadcastAll({ type: 'player_left', payload: { playerId: connection.playerId } })

      if (this.phase === 'passing' || this.phase === 'countdown') {
        const alive = this.getAlive()
        if (alive.length < 2) {
          this.clearTimers()
          this.phase = 'complete'
          if (alive.length === 1) this.winnerId = alive[0].id
          this.broadcastState()
          return
        }
        if (this.holderIndex >= alive.length) this.holderIndex = 0
        this.broadcastState()
      }
    }
  }

  private handleJoin(ws: WebSocket, payload: { roomCode: string; token: string; displayName?: string }) {
    const playerId = this.extractUserId(payload.token) || `guest-${Date.now()}`
    const displayName = payload.displayName || `Player ${this.players.length + 1}`

    if (!this.roomCode && payload.roomCode) this.roomCode = payload.roomCode
    if (this.players.length >= this.settings.maxPlayers && !this.players.find((p) => p.id === playerId)) {
      this.sendTo(ws, { type: 'error', payload: { message: 'Room is full', code: 'ROOM_FULL' } })
      return
    }

    const existingConn = this.connections.get(playerId)
    if (existingConn) { try { existingConn.ws.close(1000, 'Reconnected') } catch {} }
    this.connections.set(playerId, { ws, playerId })

    let player = this.players.find((p) => p.id === playerId)
    if (!player) {
      const hpPlayer: HotPotatoPlayerInternal = {
        id: playerId, username: displayName, displayName, chips: 0,
        isHost: playerId === this.hostId || this.players.length === 0,
        isReady: false, isConnected: true, seatIndex: this.players.length,
        isAlive: true, eliminatedRound: null,
      }
      this.players.push(hpPlayer)
      if (this.players.length === 1) this.hostId = playerId
      this.broadcastAll({ type: 'player_joined', payload: { player: hpPlayer } })
    } else {
      player.isConnected = true
      this.broadcastAll({ type: 'player_joined', payload: { player } })
    }

    this.sendTo(ws, { type: 'room_state', payload: this.getRoomState() })
  }

  private handleLeave(playerId: string) {
    this.players = this.players.filter((p) => p.id !== playerId)
    this.connections.delete(playerId)
    if (this.players.length > 0 && this.hostId === playerId) {
      this.hostId = this.players[0].id
      this.players[0].isHost = true
    }
    this.broadcastAll({ type: 'player_left', payload: { playerId } })
  }

  private handleReady(playerId: string) {
    const player = this.players.find((p) => p.id === playerId)
    if (player) {
      player.isReady = true
      this.broadcastAll({ type: 'player_ready', payload: { playerId } })
    }
  }

  // ─── Game Flow ──────────────────────────────────────

  private startGame() {
    if (this.players.length < 3) return
    this.isStarted = true
    for (const p of this.players) {
      p.isAlive = true
      p.eliminatedRound = null
    }
    this.eliminationOrder = []
    this.winnerId = null
    this.roundNumber = 0
    this.broadcastAll({ type: 'game_started', payload: { gameType: 'hot-potato' } })
    this.startRound()
  }

  private startRound() {
    const alive = this.getAlive()
    if (alive.length < 2) {
      this.phase = 'complete'
      this.winnerId = alive[0]?.id || null
      this.broadcastState()
      return
    }

    this.roundNumber++
    this.passCount = 0
    this.lastEliminatedId = null

    // Pick random starting holder
    this.holderIndex = Math.floor(cryptoRandom() * alive.length)

    // Brief countdown before the round begins
    this.phase = 'countdown'
    this.broadcastState()

    this.countdownTimer = setTimeout(() => {
      this.phase = 'passing'
      this.roundStartedAt = Date.now()
      this.broadcastState()

      // Hidden timer: gets shorter as players are eliminated
      const maxTime = Math.max(8, 20 - this.eliminationOrder.length * 2.5)
      const timerMs = (5 + cryptoRandom() * (maxTime - 5)) * 1000
      this.explosionTimer = setTimeout(() => this.explode(), timerMs)
    }, 3000)
  }

  private handlePass(playerId: string) {
    if (this.phase !== 'passing') return
    const alive = this.getAlive()
    if (alive.length === 0) return
    const holder = alive[this.holderIndex]
    if (!holder || holder.id !== playerId) return

    this.holderIndex = (this.holderIndex + 1) % alive.length
    this.passCount++
    this.broadcastState()
  }

  private explode() {
    const alive = this.getAlive()
    if (alive.length === 0) return

    const eliminated = alive[this.holderIndex]
    if (!eliminated) return

    eliminated.isAlive = false
    eliminated.eliminatedRound = this.roundNumber
    this.eliminationOrder.push(eliminated.id)
    this.lastEliminatedId = eliminated.id
    this.clearTimers()

    const remaining = this.getAlive()
    if (remaining.length <= 1) {
      this.phase = 'complete'
      this.winnerId = remaining[0]?.id || null
      this.broadcastState()
    } else {
      this.phase = 'exploded'
      this.broadcastState()

      // Start next round after a pause
      setTimeout(() => {
        if (this.getAlive().length >= 2) this.startRound()
      }, 4000)
    }
  }

  // ─── Helpers ────────────────────────────────────────

  private getAlive(): HotPotatoPlayerInternal[] {
    return this.players.filter((p) => p.isAlive && p.isConnected)
  }

  private clearTimers() {
    if (this.explosionTimer) { clearTimeout(this.explosionTimer); this.explosionTimer = null }
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null }
  }

  // ─── State Broadcasting ─────────────────────────────

  private getGameState(): import('../types').HotPotatoState {
    return {
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id, displayName: p.displayName, username: p.username,
        chips: p.chips, isHost: p.isHost, isReady: p.isReady,
        isConnected: p.isConnected, seatIndex: p.seatIndex,
        isAlive: p.isAlive, eliminatedRound: p.eliminatedRound,
      })),
      holderIndex: this.holderIndex,
      roundNumber: this.roundNumber,
      eliminationOrder: this.eliminationOrder,
      winnerId: this.winnerId,
      passCount: this.passCount,
      roundStartedAt: this.roundStartedAt,
      lastEliminatedId: this.lastEliminatedId,
    }
  }

  private getRoomState() {
    return {
      roomId: this.ctx.id.toString(),
      roomCode: this.roomCode,
      gameType: 'hot-potato' as const,
      hostId: this.hostId,
      players: this.players,
      maxPlayers: this.settings.maxPlayers,
      isStarted: this.isStarted,
      settings: this.settings,
      gameState: this.isStarted ? this.getGameState() : undefined,
    }
  }

  private broadcastState() {
    const state = this.getGameState()
    const data = JSON.stringify({ type: 'hp_state', payload: state } satisfies ServerMessage)
    for (const conn of this.connections.values()) {
      try { conn.ws.send(data) } catch {}
    }
  }

  private broadcastAll(message: ServerMessage) {
    const data = JSON.stringify(message)
    for (const conn of this.connections.values()) {
      try { conn.ws.send(data) } catch {}
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage) {
    try { ws.send(JSON.stringify(message)) } catch {}
  }

  private findConnection(ws: WebSocket): Connection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) return conn
    }
    return undefined
  }

  private extractUserId(token: string): string | null {
    if (!token) return null
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded))
      return payload.sub || null
    } catch { return null }
  }
}
