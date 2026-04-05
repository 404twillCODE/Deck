import { DurableObject } from 'cloudflare:workers'
import type {
  Env, ClientMessage, ServerMessage, RouletteState, RoulettePlayer,
  RouletteBetDef, TableSettings, RoomState, Player,
} from '../types'
import { spinWheel, validateBet, calculateBetPayout } from '../game-logic/roulette'

interface Connection {
  ws: WebSocket
  playerId: string
}

const MAX_HISTORY = 20
const BETTING_DURATION_MS = 30_000
const SPIN_DURATION_MS = 5_000
const RESULT_DISPLAY_MS = 6_000

export class RouletteTableDO extends DurableObject<Env> {
  private connections: Map<string, Connection> = new Map()
  private roomCode = ''
  private hostId = ''
  private settings: TableSettings = {
    gameType: 'roulette',
    maxPlayers: 8,
    startingChips: 10000,
    minimumBet: 10,
    freePlay: false,
  }
  private players: RoulettePlayer[] = []
  private accountChipsByPlayerId: Map<string, number> = new Map()
  private gameState: RouletteState = {
    phase: 'waiting',
    players: [],
    winningNumber: null,
    previousResults: [],
    roundNumber: 0,
    minimumBet: 10,
    bettingEndsAt: null,
  }
  private isStarted = false
  private bettingTimer: ReturnType<typeof setTimeout> | null = null
  private previousBetsByPlayerId: Map<string, RouletteBetDef[]> = new Map()
  private confirmedPlayerIds: Set<string> = new Set()

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      server.accept()

      server.addEventListener('message', (event) => {
        this.handleMessage(server, event.data as string)
      })
      server.addEventListener('close', () => {
        this.handleClose(server)
      })

      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/info') {
      return new Response(JSON.stringify({
        active: this.roomCode !== '' || this.players.length > 0,
        gameType: 'roulette',
        players: this.players.length,
        freePlay: this.settings.freePlay,
      }))
    }

    if (url.pathname === '/init' && request.method === 'POST') {
      const body = await request.json() as {
        code: string; hostId: string; settings: Partial<TableSettings>
      }
      this.roomCode = body.code
      this.hostId = body.hostId
      if (body.settings) {
        this.settings = { ...this.settings, ...body.settings }
        this.gameState.minimumBet = this.settings.minimumBet
      }
      return new Response(JSON.stringify({ success: true }))
    }

    if (url.pathname === '/freeplay' && request.method === 'POST') {
      if (this.isStarted) return new Response(JSON.stringify({ error: 'Game already started' }), { status: 409 })
      const body = await request.json() as { freePlay?: boolean }
      this.settings.freePlay = body.freePlay === true

      for (const p of this.players) {
        p.chips = this.settings.freePlay
          ? this.settings.startingChips
          : (this.accountChipsByPlayerId.get(p.id) ?? this.settings.startingChips)
      }

      this.broadcast({ type: 'room_state', payload: this.getRoomState() })
      return new Response(JSON.stringify({ success: true, freePlay: this.settings.freePlay }), { headers: { 'Content-Type': 'application/json' } })
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
        case 'rl_place_bet':
          if (connection) this.handlePlaceBets(connection.playerId, message.payload.bets)
          break
        case 'rl_clear_bets':
          if (connection) this.handleClearBets(connection.playerId)
          break
        case 'rl_confirm_bets':
          if (connection) this.handleConfirmBets(connection.playerId)
          break
        case 'chat_message':
          if (connection) {
            const player = this.players.find((p) => p.id === connection.playerId)
            if (player) {
              this.broadcast({
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
      this.broadcast({ type: 'player_left', payload: { playerId: connection.playerId } })

      if (this.gameState.phase === 'betting') this.checkAllConfirmed()
    }
  }

  private handleJoin(ws: WebSocket, payload: { roomCode: string; token: string; displayName?: string; accountChips?: number }) {
    const playerId = this.extractUserId(payload.token) || `guest-${Date.now()}`
    const displayName = payload.displayName || `Player ${this.players.length + 1}`
    const accountChips = typeof payload.accountChips === 'number' ? payload.accountChips : this.settings.startingChips

    if (!this.roomCode && payload.roomCode) this.roomCode = payload.roomCode

    if (this.players.length >= this.settings.maxPlayers && !this.players.some((p) => p.id === playerId)) {
      this.sendTo(ws, { type: 'error', payload: { message: 'Room is full', code: 'ROOM_FULL' } })
      return
    }

    const existingConnection = this.connections.get(playerId)
    if (existingConnection) {
      try { existingConnection.ws.close(1000, 'Reconnected') } catch { /* noop */ }
    }

    this.connections.set(playerId, { ws, playerId })

    let player = this.players.find((p) => p.id === playerId)
    if (!player) {
      const rlPlayer: RoulettePlayer = {
        id: playerId,
        username: displayName,
        displayName,
        chips: this.settings.freePlay ? this.settings.startingChips : accountChips,
        isHost: playerId === this.hostId || this.players.length === 0,
        isReady: false,
        isConnected: true,
        seatIndex: this.players.length,
        bets: [],
        totalBet: 0,
        winnings: 0,
      }
      this.players.push(rlPlayer)
      if (this.players.length === 1) this.hostId = playerId
      this.broadcast({ type: 'player_joined', payload: { player: rlPlayer as unknown as Player } })
    } else {
      player.chips = this.settings.freePlay ? this.settings.startingChips : accountChips
      player.isConnected = true
      this.broadcast({ type: 'player_joined', payload: { player: player as unknown as Player } })
    }

    this.accountChipsByPlayerId.set(playerId, accountChips)
    this.sendTo(ws, { type: 'room_state', payload: this.getRoomState() })
  }

  private handleLeave(playerId: string) {
    const gsPlayer = this.gameState.players.find((p) => p.id === playerId)
    if (gsPlayer && gsPlayer.totalBet > 0 && this.gameState.phase === 'betting') {
      gsPlayer.chips += gsPlayer.totalBet
      gsPlayer.bets = []
      gsPlayer.totalBet = 0
    }

    this.players = this.players.filter((p) => p.id !== playerId)
    this.gameState.players = this.gameState.players.filter((p) => p.id !== playerId)
    this.confirmedPlayerIds.delete(playerId)
    this.connections.delete(playerId)

    if (this.players.length > 0 && this.hostId === playerId) {
      this.hostId = this.players[0].id
      this.players[0].isHost = true
    }

    this.broadcast({ type: 'player_left', payload: { playerId } })

    if (this.gameState.phase === 'betting') this.checkAllConfirmed()
  }

  private handleReady(playerId: string) {
    const player = this.players.find((p) => p.id === playerId)
    if (player) {
      player.isReady = true
      this.broadcast({ type: 'player_ready', payload: { playerId } })
    }
  }

  private startGame() {
    if (this.players.length < 1) return
    this.isStarted = true
    this.broadcast({ type: 'game_started', payload: { gameType: 'roulette' } })
    this.startBettingPhase()
  }

  private startBettingPhase() {
    const connected = this.players.filter((p) => p.isConnected)
    let active = connected.filter((p) => p.chips > 0)

    if (active.length === 0 && connected.length >= 1) {
      for (const p of this.players) {
        p.chips = this.settings.startingChips
      }
      this.broadcast({ type: 'chips_reset', payload: { startingChips: this.settings.startingChips } })
      active = connected
    }

    if (active.length < 1) return

    this.confirmedPlayerIds.clear()

    const bettingEndsAt = Date.now() + BETTING_DURATION_MS

    this.gameState = {
      phase: 'betting',
      players: active.map((p) => ({
        ...p,
        bets: [],
        totalBet: 0,
        winnings: 0,
        result: undefined,
      })),
      winningNumber: null,
      previousResults: this.gameState.previousResults,
      roundNumber: this.gameState.roundNumber + 1,
      minimumBet: this.settings.minimumBet,
      bettingEndsAt,
    }

    this.broadcastGameState()

    if (this.bettingTimer) clearTimeout(this.bettingTimer)
    this.bettingTimer = setTimeout(() => {
      if (this.gameState.phase === 'betting') {
        this.closeBetting()
      }
    }, BETTING_DURATION_MS)
  }

  private handlePlaceBets(playerId: string, bets: RouletteBetDef[]) {
    if (this.gameState.phase !== 'betting') {
      const conn = this.connections.get(playerId)
      if (conn) this.sendTo(conn.ws, { type: 'error', payload: { message: 'Betting is closed' } })
      return
    }

    const player = this.gameState.players.find((p) => p.id === playerId)
    if (!player) return

    // Unconfirm when bets change
    this.confirmedPlayerIds.delete(playerId)

    // Refund current bets before placing new ones
    player.chips += player.totalBet
    player.bets = []
    player.totalBet = 0

    let totalNewBet = 0
    const validatedBets: RouletteBetDef[] = []

    for (const bet of bets) {
      const error = validateBet(bet)
      if (error) {
        const conn = this.connections.get(playerId)
        if (conn) this.sendTo(conn.ws, { type: 'error', payload: { message: error } })
        return
      }
      if (bet.amount < this.settings.minimumBet) {
        const conn = this.connections.get(playerId)
        if (conn) this.sendTo(conn.ws, { type: 'error', payload: { message: `Minimum bet is ${this.settings.minimumBet}` } })
        return
      }
      totalNewBet += bet.amount
      validatedBets.push({ type: bet.type, numbers: [...bet.numbers], amount: bet.amount })
    }

    if (totalNewBet > player.chips) {
      const conn = this.connections.get(playerId)
      if (conn) this.sendTo(conn.ws, { type: 'error', payload: { message: 'Insufficient chips' } })
      return
    }

    player.bets = validatedBets
    player.totalBet = totalNewBet
    player.chips -= totalNewBet

    this.broadcastGameState()
  }

  private handleClearBets(playerId: string) {
    if (this.gameState.phase !== 'betting') return
    const player = this.gameState.players.find((p) => p.id === playerId)
    if (!player) return

    this.confirmedPlayerIds.delete(playerId)
    player.chips += player.totalBet
    player.bets = []
    player.totalBet = 0
    this.broadcastGameState()
  }

  private handleConfirmBets(playerId: string) {
    if (this.gameState.phase !== 'betting') return
    const player = this.gameState.players.find((p) => p.id === playerId)
    if (!player || player.totalBet === 0) return

    this.confirmedPlayerIds.add(playerId)
    this.broadcastGameState()
    this.checkAllConfirmed()
  }

  private checkAllConfirmed() {
    if (this.gameState.phase !== 'betting') return
    const connectedPlayers = this.gameState.players.filter((p) => p.isConnected)
    if (connectedPlayers.length === 0) return
    // Only auto-close if every connected player has placed bets AND confirmed
    const allPlacedAndConfirmed = connectedPlayers.every(
      (p) => p.totalBet > 0 && this.confirmedPlayerIds.has(p.id)
    )
    if (allPlacedAndConfirmed) this.closeBetting()
  }

  private closeBetting() {
    if (this.bettingTimer) {
      clearTimeout(this.bettingTimer)
      this.bettingTimer = null
    }

    const playersWithBets = this.gameState.players.filter((p) => p.totalBet > 0)
    if (playersWithBets.length === 0) {
      this.startBettingPhase()
      return
    }

    for (const p of this.gameState.players) {
      if (p.bets.length > 0) {
        this.previousBetsByPlayerId.set(p.id, p.bets.map((b) => ({ ...b })))
      }
    }

    this.gameState.phase = 'no_more_bets'
    this.gameState.bettingEndsAt = null
    this.broadcastGameState()

    setTimeout(() => {
      this.doSpin()
    }, 1500)
  }

  private async doSpin() {
    const winningNumber = spinWheel()
    this.gameState.winningNumber = winningNumber
    this.gameState.phase = 'spinning'
    this.broadcastGameState()

    await this.delay(SPIN_DURATION_MS)
    this.resolveRound(winningNumber)
  }

  private resolveRound(winningNumber: number) {
    this.gameState.phase = 'resolved'
    this.gameState.winningNumber = winningNumber

    for (const player of this.gameState.players) {
      let totalPayout = 0
      let anyWin = false
      let anyLoss = false

      for (const bet of player.bets) {
        const payout = calculateBetPayout(bet, winningNumber)
        totalPayout += payout
        if (payout > 0) anyWin = true
        else anyLoss = true
      }

      player.winnings = totalPayout
      player.chips += totalPayout

      if (player.bets.length === 0) {
        player.result = 'none'
      } else if (anyWin && anyLoss) {
        player.result = 'mixed'
      } else if (anyWin) {
        player.result = 'win'
      } else {
        player.result = 'lose'
      }
    }

    this.gameState.previousResults = [
      winningNumber,
      ...this.gameState.previousResults.slice(0, MAX_HISTORY - 1),
    ]

    this.syncPlayersBack()
    this.gameState.phase = 'complete'
    this.broadcast({ type: 'rl_round_result', payload: this.gameState })

    setTimeout(() => {
      if (this.players.filter((p) => p.isConnected).length >= 1) {
        this.startBettingPhase()
      }
    }, RESULT_DISPLAY_MS)
  }

  private syncPlayersBack() {
    for (const gp of this.gameState.players) {
      const main = this.players.find((p) => p.id === gp.id)
      if (main) main.chips = gp.chips
    }
  }

  private getRoomState(): RoomState {
    return {
      roomId: this.ctx.id.toString(),
      roomCode: this.roomCode,
      gameType: 'roulette',
      hostId: this.hostId,
      players: this.players as unknown as Player[],
      maxPlayers: this.settings.maxPlayers,
      isStarted: this.isStarted,
      settings: this.settings,
      gameState: this.isStarted ? this.gameState : undefined,
    }
  }

  private broadcastGameState() {
    this.broadcast({ type: 'rl_state', payload: this.gameState })
  }

  private broadcast(message: ServerMessage) {
    const data = JSON.stringify(message)
    for (const conn of this.connections.values()) {
      try { conn.ws.send(data) } catch { /* noop */ }
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage) {
    try { ws.send(JSON.stringify(message)) } catch { /* noop */ }
  }

  private findConnection(ws: WebSocket): Connection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) return conn
    }
    return undefined
  }

  private extractUserId(token: string): string | null {
    if (!token || token === '') return null
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded))
      return payload.sub || null
    } catch {
      return null
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
