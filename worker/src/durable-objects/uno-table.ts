import { DurableObject } from 'cloudflare:workers'
import type { Env, ClientMessage, ServerMessage, TableSettings, Player } from '../types'

type UnoColor = 'red' | 'yellow' | 'green' | 'blue'

interface UnoCard {
  id: string
  color: UnoColor | null
  type: 'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'
  value?: number
}

interface UnoPlayerInternal extends Player {
  score: number
  hasCalledUno: boolean
  canBeChallenged: boolean
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

export class UnoTableDO extends DurableObject<Env> {
  private connections: Map<string, Connection> = new Map()
  private roomCode = ''
  private hostId = ''
  private settings: TableSettings = { gameType: 'uno', maxPlayers: 10, startingChips: 0, minimumBet: 0 }
  private players: UnoPlayerInternal[] = []
  private isStarted = false

  private drawPile: UnoCard[] = []
  private discardPile: UnoCard[] = []
  private playerHands: Map<string, UnoCard[]> = new Map()
  private currentPlayerIndex = 0
  private direction: 1 | -1 = 1
  private currentColor: UnoColor = 'red'
  private phase: 'waiting' | 'playing' | 'complete' = 'waiting'
  private hasDrawnThisTurn = false
  private pendingDraw = 0
  private pendingDrawType: 'draw_two' | 'wild_draw_four' | null = null
  private lastAction: { playerId: string; action: string; card?: UnoCard } | null = null
  private winnerId: string | null = null
  private roundNumber = 0

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
        gameType: 'uno',
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
        case 'uno_play_card':
          if (connection) this.handlePlayCard(connection.playerId, message.payload.cardId, message.payload.chosenColor)
          break
        case 'uno_draw':
          if (connection) this.handleDraw(connection.playerId)
          break
        case 'uno_call_uno':
          if (connection) this.handleCallUno(connection.playerId)
          break
        case 'uno_challenge_uno':
          if (connection) this.handleChallengeUno(connection.playerId, message.payload.targetPlayerId)
          break
        case 'uno_pass':
          if (connection) this.handleEndTurn(connection.playerId)
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

      if (this.phase === 'playing') {
        const active = this.getActive()
        if (active.length < 2) {
          this.phase = 'complete'
          if (active.length === 1) {
            this.winnerId = active[0].id
            this.calculateScores(active[0].id)
          }
          this.broadcastPersonalized()
          return
        }
        if (this.currentPlayerIndex >= active.length) {
          this.currentPlayerIndex = 0
        }
        this.broadcastPersonalized()
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
      const unoPlayer: UnoPlayerInternal = {
        id: playerId, username: displayName, displayName, chips: 0,
        isHost: playerId === this.hostId || this.players.length === 0,
        isReady: false, isConnected: true, seatIndex: this.players.length,
        score: 0, hasCalledUno: false, canBeChallenged: false,
      }
      this.players.push(unoPlayer)
      if (this.players.length === 1) this.hostId = playerId
      this.broadcastAll({ type: 'player_joined', payload: { player: unoPlayer } })
    } else {
      player.isConnected = true
      this.broadcastAll({ type: 'player_joined', payload: { player } })
    }

    this.sendTo(ws, { type: 'room_state', payload: this.getRoomState(playerId) })
  }

  private handleLeave(playerId: string) {
    this.players = this.players.filter((p) => p.id !== playerId)
    this.playerHands.delete(playerId)
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

  // ─── Deck Management ───────────────────────────────

  private createDeck(): UnoCard[] {
    const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue']
    const cards: UnoCard[] = []
    let id = 0
    for (const color of colors) {
      cards.push({ id: `u${id++}`, color, type: 'number', value: 0 })
      for (let v = 1; v <= 9; v++) {
        cards.push({ id: `u${id++}`, color, type: 'number', value: v })
        cards.push({ id: `u${id++}`, color, type: 'number', value: v })
      }
      for (const t of ['skip', 'reverse', 'draw_two'] as const) {
        cards.push({ id: `u${id++}`, color, type: t })
        cards.push({ id: `u${id++}`, color, type: t })
      }
    }
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `u${id++}`, color: null, type: 'wild' })
      cards.push({ id: `u${id++}`, color: null, type: 'wild_draw_four' })
    }
    return cards
  }

  private shuffleCards(cards: UnoCard[]) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(cryptoRandom() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }
  }

  private drawCardFromPile(): UnoCard | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length <= 1) return null
      const topCard = this.discardPile.pop()!
      this.drawPile = [...this.discardPile]
      this.discardPile = [topCard]
      for (const c of this.drawPile) {
        if (c.type === 'wild' || c.type === 'wild_draw_four') c.color = null
      }
      this.shuffleCards(this.drawPile)
    }
    return this.drawPile.pop() || null
  }

  private drawCards(count: number): UnoCard[] {
    const cards: UnoCard[] = []
    for (let i = 0; i < count; i++) {
      const c = this.drawCardFromPile()
      if (c) cards.push(c)
    }
    return cards
  }

  // ─── Game Flow ──────────────────────────────────────

  private startGame() {
    if (this.players.length < 2) return
    this.isStarted = true
    this.broadcastAll({ type: 'game_started', payload: { gameType: 'uno' } })
    this.startRound()
  }

  private startRound() {
    const deck = this.createDeck()
    this.shuffleCards(deck)
    this.drawPile = deck
    this.discardPile = []
    this.playerHands.clear()
    this.direction = 1
    this.hasDrawnThisTurn = false
    this.pendingDraw = 0
    this.pendingDrawType = null
    this.lastAction = null
    this.winnerId = null
    this.roundNumber++

    for (const p of this.players) {
      p.hasCalledUno = false
      p.canBeChallenged = false
    }

    const active = this.getActive()
    if (active.length < 2) return

    for (const p of active) this.playerHands.set(p.id, this.drawCards(7))

    let startCard = this.drawPile.pop()!
    while (startCard.type === 'wild_draw_four') {
      this.drawPile.unshift(startCard)
      this.shuffleCards(this.drawPile)
      startCard = this.drawPile.pop()!
    }
    this.discardPile.push(startCard)
    this.currentPlayerIndex = 0

    if (startCard.color) {
      this.currentColor = startCard.color
    } else {
      const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue']
      this.currentColor = colors[Math.floor(cryptoRandom() * 4)]
    }

    if (startCard.type === 'skip') {
      this.currentPlayerIndex = this.nextIndex(0)
    } else if (startCard.type === 'reverse') {
      this.direction = -1
      this.currentPlayerIndex = active.length === 2 ? this.nextIndex(0) : active.length - 1
    } else if (startCard.type === 'draw_two') {
      const first = active[0]
      const hand = this.playerHands.get(first.id)
      if (hand) hand.push(...this.drawCards(2))
      this.currentPlayerIndex = this.nextIndex(0)
    }

    this.phase = 'playing'
    this.broadcastPersonalized()
  }

  private resetTurnState() {
    this.hasDrawnThisTurn = false
  }

  private advanceToNext() {
    this.resetTurnState()
    this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex)
    const active = this.getActive()
    if (this.currentPlayerIndex >= active.length) this.currentPlayerIndex = 0
  }

  // ─── Player Actions ─────────────────────────────────

  private handlePlayCard(playerId: string, cardId: string, chosenColor?: string) {
    if (this.phase !== 'playing') return
    const active = this.getActive()
    if (active.length === 0) return
    const current = active[this.currentPlayerIndex]
    if (!current || current.id !== playerId) return

    const hand = this.playerHands.get(playerId)
    if (!hand) return
    const idx = hand.findIndex((c) => c.id === cardId)
    if (idx === -1) return

    const card = hand[idx]
    if (!this.canPlay(card)) return

    if ((card.type === 'wild' || card.type === 'wild_draw_four') && !chosenColor) return
    const validColors: UnoColor[] = ['red', 'yellow', 'green', 'blue']
    if (chosenColor && !validColors.includes(chosenColor as UnoColor)) return

    hand.splice(idx, 1)

    if ((card.type === 'wild' || card.type === 'wild_draw_four') && chosenColor) {
      card.color = chosenColor as UnoColor
    }
    this.discardPile.push(card)

    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      this.currentColor = chosenColor as UnoColor
    } else if (card.color) {
      this.currentColor = card.color
    }

    // UNO check — if going to 1 card
    if (hand.length === 1) {
      const p = this.players.find((x) => x.id === playerId)
      if (p && !p.hasCalledUno) p.canBeChallenged = true
    }

    // Win check
    if (hand.length === 0) {
      this.winnerId = playerId
      this.phase = 'complete'
      this.pendingDraw = 0
      this.pendingDrawType = null
      this.calculateScores(playerId)
      this.lastAction = { playerId, action: 'play', card }
      this.broadcastPersonalized()
      setTimeout(() => {
        if (this.players.filter((p) => p.isConnected).length >= 2) this.startRound()
      }, 8000)
      return
    }

    this.lastAction = { playerId, action: 'play', card }
    this.clearChallengeExcept(playerId)
    this.applyEffect(card)
  }

  private handleDraw(playerId: string) {
    if (this.phase !== 'playing') return
    const active = this.getActive()
    if (active.length === 0) return
    const current = active[this.currentPlayerIndex]
    if (!current || current.id !== playerId) return

    const hand = this.playerHands.get(playerId)
    if (!hand) return

    // If there's a pending draw stack, draw all penalty cards and get skipped
    if (this.pendingDraw > 0) {
      hand.push(...this.drawCards(this.pendingDraw))
      const count = this.pendingDraw
      this.pendingDraw = 0
      this.pendingDrawType = null
      this.lastAction = { playerId, action: `draw_${count}` }

      const p = this.players.find((x) => x.id === playerId)
      if (p) { p.hasCalledUno = false; p.canBeChallenged = false }

      this.advanceToNext()
      this.broadcastPersonalized()
      return
    }

    // Normal draw — draw one card, stay on turn
    const card = this.drawCardFromPile()
    if (!card) {
      this.lastAction = { playerId, action: 'draw_empty' }
      this.advanceToNext()
      this.broadcastPersonalized()
      return
    }

    hand.push(card)
    this.hasDrawnThisTurn = true

    const p = this.players.find((x) => x.id === playerId)
    if (p) { p.hasCalledUno = false; p.canBeChallenged = false }

    this.lastAction = { playerId, action: 'draw' }
    this.broadcastPersonalized()
  }

  private handleEndTurn(playerId: string) {
    if (this.phase !== 'playing') return
    const active = this.getActive()
    if (active.length === 0) return
    const current = active[this.currentPlayerIndex]
    if (!current || current.id !== playerId) return
    if (!this.hasDrawnThisTurn) return
    if (this.pendingDraw > 0) return

    this.lastAction = { playerId, action: 'end_turn' }
    this.advanceToNext()
    this.broadcastPersonalized()
  }

  private handleCallUno(playerId: string) {
    const p = this.players.find((x) => x.id === playerId)
    if (!p) return
    const hand = this.playerHands.get(playerId)
    if (!hand || hand.length > 2) return
    p.hasCalledUno = true
    p.canBeChallenged = false
    this.broadcastPersonalized()
  }

  private handleChallengeUno(_challengerId: string, targetId: string) {
    const target = this.players.find((p) => p.id === targetId)
    if (!target || !target.canBeChallenged) return
    const hand = this.playerHands.get(targetId)
    if (!hand || hand.length !== 1) return

    hand.push(...this.drawCards(2))
    target.canBeChallenged = false
    target.hasCalledUno = false
    this.lastAction = { playerId: targetId, action: 'caught' }
    this.broadcastPersonalized()
  }

  // ─── Card Rules ─────────────────────────────────────

  private canPlay(card: UnoCard): boolean {
    // During a pending draw stack: +2 stacks on +2, +4 stacks on +4, +4 can stack on +2
    if (this.pendingDrawType === 'draw_two') return card.type === 'draw_two' || card.type === 'wild_draw_four'
    if (this.pendingDrawType === 'wild_draw_four') return card.type === 'wild_draw_four'

    if (card.type === 'wild' || card.type === 'wild_draw_four') return true
    const top = this.discardPile[this.discardPile.length - 1]
    if (!top) return true
    if (card.color === this.currentColor) return true
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true
    if (card.type !== 'number' && card.type === top.type) return true
    return false
  }

  private applyEffect(card: UnoCard) {
    const active = this.getActive()
    if (active.length === 0) return

    switch (card.type) {
      case 'skip': {
        const skipped = this.nextIndex(this.currentPlayerIndex)
        this.resetTurnState()
        this.currentPlayerIndex = this.nextIndex(skipped)
        break
      }
      case 'reverse': {
        this.direction = (this.direction * -1) as 1 | -1
        if (active.length === 2) {
          const skipped = this.nextIndex(this.currentPlayerIndex)
          this.resetTurnState()
          this.currentPlayerIndex = this.nextIndex(skipped)
        } else {
          this.advanceToNext()
        }
        break
      }
      case 'draw_two': {
        this.pendingDraw += 2
        this.pendingDrawType = 'draw_two'
        this.advanceToNext()
        break
      }
      case 'wild_draw_four': {
        this.pendingDraw += 4
        this.pendingDrawType = 'wild_draw_four'
        this.advanceToNext()
        break
      }
      default:
        this.advanceToNext()
    }

    if (this.currentPlayerIndex >= active.length) this.currentPlayerIndex = 0
    this.broadcastPersonalized()
  }

  // ─── Helpers ────────────────────────────────────────

  private nextIndex(from: number): number {
    const active = this.getActive()
    if (active.length === 0) return 0
    return ((from + this.direction) % active.length + active.length) % active.length
  }

  private getActive(): UnoPlayerInternal[] {
    return this.players.filter((p) => p.isConnected)
  }

  private clearChallengeExcept(keepId: string) {
    for (const p of this.players) {
      if (p.id !== keepId) p.canBeChallenged = false
    }
  }

  private calculateScores(winnerId: string) {
    let total = 0
    for (const [pid, hand] of this.playerHands) {
      if (pid === winnerId) continue
      for (const c of hand) {
        if (c.type === 'number') total += c.value || 0
        else if (c.type === 'skip' || c.type === 'reverse' || c.type === 'draw_two') total += 20
        else total += 50
      }
    }
    const winner = this.players.find((p) => p.id === winnerId)
    if (winner) winner.score += total
  }

  // ─── State Broadcasting ─────────────────────────────

  private getStateForPlayer(viewingId: string) {
    const active = this.getActive()
    const phase = this.phase === 'waiting' ? 'playing' as const : this.phase
    const isCurrent = active[this.currentPlayerIndex]?.id === viewingId
    return {
      phase,
      players: active.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        username: p.username,
        chips: p.chips,
        isHost: p.isHost,
        isReady: p.isReady,
        isConnected: p.isConnected,
        seatIndex: p.seatIndex,
        cards: p.id === viewingId ? (this.playerHands.get(p.id) || []) : [],
        cardCount: (this.playerHands.get(p.id) || []).length,
        score: p.score,
        hasCalledUno: p.hasCalledUno,
        canBeChallenged: p.canBeChallenged,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      discardTop: this.discardPile[this.discardPile.length - 1] || null,
      currentColor: this.currentColor,
      drawPileCount: this.drawPile.length,
      hasDrawnThisTurn: isCurrent ? this.hasDrawnThisTurn : false,
      pendingDraw: this.pendingDraw,
      pendingDrawType: this.pendingDrawType,
      lastAction: this.lastAction,
      winnerId: this.winnerId,
      roundNumber: this.roundNumber,
    }
  }

  private getRoomState(viewingId: string) {
    return {
      roomId: this.ctx.id.toString(),
      roomCode: this.roomCode,
      gameType: 'uno' as const,
      hostId: this.hostId,
      players: this.players,
      maxPlayers: this.settings.maxPlayers,
      isStarted: this.isStarted,
      settings: this.settings,
      gameState: this.isStarted ? this.getStateForPlayer(viewingId) : undefined,
    }
  }

  private broadcastPersonalized() {
    for (const [pid, conn] of this.connections) {
      const state = this.getStateForPlayer(pid)
      this.sendTo(conn.ws, { type: 'uno_state', payload: state })
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
