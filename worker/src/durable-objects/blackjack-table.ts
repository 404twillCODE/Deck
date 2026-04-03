import { DurableObject } from 'cloudflare:workers'
import type {
  Env, ClientMessage, ServerMessage, BlackjackState, BlackjackPlayer, BlackjackHand, TableSettings, RoomState,
} from '../types'
import { Deck, getHandValue, getFullHandValue } from '../game-logic/deck'

interface Connection {
  ws: WebSocket
  playerId: string
}

export class BlackjackTableDO extends DurableObject<Env> {
  private connections: Map<string, Connection> = new Map()
  private roomCode = ''
  private hostId = ''
  private settings: TableSettings = {
    gameType: 'blackjack',
    maxPlayers: 7,
    startingChips: 10000,
    minimumBet: 50,
    freePlay: false,
  }
  private players: BlackjackPlayer[] = []
  // Stores each player's account chip balance so we can restore it when Free Play is toggled off.
  private accountChipsByPlayerId: Map<string, number> = new Map()
  private gameState: BlackjackState = {
    phase: 'waiting',
    dealerHand: [],
    dealerValue: 0,
    players: [],
    currentPlayerIndex: -1,
    minimumBet: 50,
    roundNumber: 0,
  }
  private deck: Deck = new Deck(6)
  private isStarted = false

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      // Use classic API — keeps DO alive and preserves in-memory state
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
        gameType: 'blackjack',
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
        case 'bj_place_bet':
          if (connection) this.handleBet(connection.playerId, message.payload.amount)
          break
        case 'bj_hit':
          if (connection) this.handleHit(connection.playerId)
          break
        case 'bj_stand':
          if (connection) this.handleStand(connection.playerId)
          break
        case 'bj_double':
          if (connection) this.handleDouble(connection.playerId)
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
    }
  }

  private handleJoin(ws: WebSocket, payload: { roomCode: string; token: string; displayName?: string; accountChips?: number }) {
    const playerId = this.extractUserId(payload.token) || `guest-${Date.now()}`
    const displayName = payload.displayName || `Player ${this.players.length + 1}`
    const accountChips = typeof payload.accountChips === 'number' ? payload.accountChips : this.settings.startingChips

    if (!this.roomCode && payload.roomCode) {
      this.roomCode = payload.roomCode
    }

    if (this.players.length >= this.settings.maxPlayers) {
      this.sendTo(ws, { type: 'error', payload: { message: 'Room is full', code: 'ROOM_FULL' } })
      return
    }

    const existingConnection = this.connections.get(playerId)
    if (existingConnection) {
      try { existingConnection.ws.close(1000, 'Reconnected') } catch {}
    }

    this.connections.set(playerId, { ws, playerId })

    let player = this.players.find((p) => p.id === playerId)
    if (!player) {
      const bjPlayer: BlackjackPlayer = {
        id: playerId,
        username: displayName,
        displayName,
        chips: this.settings.freePlay ? this.settings.startingChips : accountChips,
        isHost: playerId === this.hostId || this.players.length === 0,
        isReady: false,
        isConnected: true,
        seatIndex: this.players.length,
        hand: this.emptyHand(),
      }
      this.players.push(bjPlayer)
      if (this.players.length === 1) this.hostId = playerId

      this.broadcast({ type: 'player_joined', payload: { player: bjPlayer } })
    } else {
      player.chips = this.settings.freePlay ? this.settings.startingChips : accountChips
      player.isConnected = true
      this.broadcast({ type: 'player_joined', payload: { player } })
    }

    this.accountChipsByPlayerId.set(playerId, accountChips)

    this.sendTo(ws, { type: 'room_state', payload: this.getRoomState() })
  }

  private handleLeave(playerId: string) {
    this.players = this.players.filter((p) => p.id !== playerId)
    this.connections.delete(playerId)
    if (this.players.length > 0 && this.hostId === playerId) {
      this.hostId = this.players[0].id
      this.players[0].isHost = true
    }
    this.broadcast({ type: 'player_left', payload: { playerId } })
  }

  private handleReady(playerId: string) {
    const player = this.players.find((p) => p.id === playerId)
    if (player) {
      player.isReady = true
      this.broadcast({ type: 'player_ready', payload: { playerId } })
    }
  }

  private startGame() {
    if (this.players.length < 2) return
    this.isStarted = true
    this.broadcast({ type: 'game_started', payload: { gameType: 'blackjack' } })
    this.startBettingPhase()
  }

  private startBettingPhase() {
    const connected = this.players.filter((p) => p.isConnected)
    let active = connected.filter((p) => p.chips > 0)

    if (active.length === 0 && connected.length >= 2) {
      for (const p of this.players) {
        p.chips = this.settings.startingChips
      }
      this.broadcast({ type: 'chips_reset', payload: { startingChips: this.settings.startingChips } })
      active = connected
    }

    if (active.length < 1 || connected.length < 2) return

    this.deck = new Deck(6)
    this.gameState = {
      phase: 'betting',
      dealerHand: [],
      dealerValue: 0,
      players: active.map((p) => ({
        ...p,
        hand: this.emptyHand(),
        result: undefined,
        payout: undefined,
      })),
      currentPlayerIndex: -1,
      minimumBet: this.settings.minimumBet,
      roundNumber: this.gameState.roundNumber + 1,
    }
    this.broadcastGameState()
  }

  private handleBet(playerId: string, amount: number) {
    if (this.gameState.phase !== 'betting') return
    const player = this.gameState.players.find((p) => p.id === playerId)
    if (!player || amount < this.settings.minimumBet || amount > player.chips) return

    player.hand.bet = amount
    player.chips -= amount

    if (this.gameState.players.every((p) => p.hand.bet > 0)) {
      this.dealInitialCards()
    } else {
      this.broadcastGameState()
    }
  }

  private dealInitialCards() {
    this.gameState.phase = 'dealing'
    for (const player of this.gameState.players) {
      player.hand.cards.push(this.deck.deal(true))
      player.hand.cards.push(this.deck.deal(true))
      player.hand.value = getFullHandValue(player.hand.cards)
    }
    this.gameState.dealerHand.push(this.deck.deal(true))
    this.gameState.dealerHand.push(this.deck.deal(false))
    this.gameState.dealerValue = getFullHandValue([this.gameState.dealerHand[0]])

    for (const player of this.gameState.players) {
      if (player.hand.value === 21) {
        player.hand.isBlackjack = true
        player.hand.isStanding = true
      }
    }

    const dealerFullValue = getFullHandValue(this.gameState.dealerHand)
    if (dealerFullValue === 21) {
      this.gameState.dealerHand[1].faceUp = true
      this.gameState.dealerValue = 21
      this.gameState.phase = 'resolving'

      for (const player of this.gameState.players) {
        if (player.hand.isBlackjack) {
          player.result = 'push'
          player.payout = player.hand.bet
          player.chips += player.payout
        } else {
          player.result = 'lose'
          player.payout = 0
        }
      }

      this.syncPlayersBack()
      this.gameState.phase = 'complete'
      this.broadcast({ type: 'bj_round_result', payload: this.gameState })
      setTimeout(() => {
        if (this.players.filter((p) => p.isConnected).length >= 2) this.startBettingPhase()
      }, 5000)
      return
    }

    this.gameState.phase = 'playing'
    this.gameState.currentPlayerIndex = this.findNextPlayer(-1)

    if (this.gameState.currentPlayerIndex === -1) {
      this.dealerTurn()
    } else {
      this.broadcastGameState()
    }
  }

  private handleHit(playerId: string) {
    if (this.gameState.phase !== 'playing') return
    const current = this.gameState.players[this.gameState.currentPlayerIndex]
    if (!current || current.id !== playerId) return
    current.hand.cards.push(this.deck.deal(true))
    current.hand.value = getFullHandValue(current.hand.cards)
    if (current.hand.value > 21) {
      current.hand.isBusted = true
      current.hand.isStanding = true
      this.advanceTurn()
    } else if (current.hand.value === 21) {
      current.hand.isStanding = true
      this.advanceTurn()
    } else {
      this.broadcastGameState()
    }
  }

  private handleStand(playerId: string) {
    if (this.gameState.phase !== 'playing') return
    const current = this.gameState.players[this.gameState.currentPlayerIndex]
    if (!current || current.id !== playerId) return
    current.hand.isStanding = true
    this.advanceTurn()
  }

  private handleDouble(playerId: string) {
    if (this.gameState.phase !== 'playing') return
    const current = this.gameState.players[this.gameState.currentPlayerIndex]
    if (!current || current.id !== playerId || current.hand.cards.length !== 2) return
    if (current.chips < current.hand.bet) return
    current.chips -= current.hand.bet
    current.hand.bet *= 2
    current.hand.cards.push(this.deck.deal(true))
    current.hand.value = getFullHandValue(current.hand.cards)
    if (current.hand.value > 21) current.hand.isBusted = true
    current.hand.isStanding = true
    this.advanceTurn()
  }

  private advanceTurn() {
    const next = this.findNextPlayer(this.gameState.currentPlayerIndex)
    if (next === -1) {
      this.dealerTurn()
    } else {
      this.gameState.currentPlayerIndex = next
      this.broadcastGameState()
    }
  }

  private async dealerTurn() {
    this.gameState.phase = 'dealer_turn'
    this.gameState.dealerHand[1].faceUp = true
    this.gameState.dealerValue = getFullHandValue(this.gameState.dealerHand)
    this.broadcastGameState()

    if (!this.gameState.players.every((p) => p.hand.isBusted)) {
      while (this.gameState.dealerValue < 17) {
        await this.delay(800)
        this.gameState.dealerHand.push(this.deck.deal(true))
        this.gameState.dealerValue = getFullHandValue(this.gameState.dealerHand)
        this.broadcastGameState()
      }
    }
    await this.delay(500)
    this.resolveRound()
  }

  private resolveRound() {
    this.gameState.phase = 'resolving'
    const dealerBusted = this.gameState.dealerValue > 21
    for (const player of this.gameState.players) {
      if (player.hand.isBusted) {
        player.result = 'lose'
        player.payout = 0
      } else if (player.hand.isBlackjack && !(this.gameState.dealerValue === 21 && this.gameState.dealerHand.length === 2)) {
        player.result = 'blackjack'
        player.payout = Math.floor(player.hand.bet * 2.5)
        player.chips += player.payout
      } else if (dealerBusted) {
        player.result = 'win'
        player.payout = player.hand.bet * 2
        player.chips += player.payout
      } else if (player.hand.value > this.gameState.dealerValue) {
        player.result = 'win'
        player.payout = player.hand.bet * 2
        player.chips += player.payout
      } else if (player.hand.value === this.gameState.dealerValue) {
        player.result = 'push'
        player.payout = player.hand.bet
        player.chips += player.payout
      } else {
        player.result = 'lose'
        player.payout = 0
      }
    }
    this.syncPlayersBack()
    this.gameState.phase = 'complete'
    this.broadcast({ type: 'bj_round_result', payload: this.gameState })
    setTimeout(() => {
      if (this.players.filter((p) => p.isConnected).length >= 2) this.startBettingPhase()
    }, 5000)
  }

  private syncPlayersBack() {
    for (const gp of this.gameState.players) {
      const main = this.players.find((p) => p.id === gp.id)
      if (main) main.chips = gp.chips
    }
  }

  private findNextPlayer(fromIndex: number): number {
    for (let i = fromIndex + 1; i < this.gameState.players.length; i++) {
      if (!this.gameState.players[i].hand.isStanding && !this.gameState.players[i].hand.isBusted) return i
    }
    return -1
  }

  private emptyHand(): BlackjackHand {
    return { cards: [], bet: 0, isStanding: false, isBusted: false, isBlackjack: false, value: 0 }
  }

  private getRoomState(): RoomState {
    return {
      roomId: this.ctx.id.toString(),
      roomCode: this.roomCode,
      gameType: 'blackjack',
      hostId: this.hostId,
      players: this.players,
      maxPlayers: this.settings.maxPlayers,
      isStarted: this.isStarted,
      settings: this.settings,
      gameState: this.isStarted ? this.gameState : undefined,
    }
  }

  private broadcastGameState() {
    this.broadcast({ type: 'bj_state', payload: this.gameState })
  }

  private broadcast(message: ServerMessage) {
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
