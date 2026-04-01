import { DurableObject } from 'cloudflare:workers'
import type {
  Env, ClientMessage, ServerMessage, PokerState, PokerPlayer, PokerPhase, TableSettings, RoomState,
} from '../types'
import { Deck, evaluatePokerHand, compareHands, type HandEvaluation } from '../game-logic/deck'

interface Connection {
  ws: WebSocket
  playerId: string
}

export class PokerTableDO extends DurableObject<Env> {
  private connections: Map<string, Connection> = new Map()
  private roomCode = ''
  private hostId = ''
  private settings: TableSettings = {
    gameType: 'poker',
    maxPlayers: 9,
    startingChips: 10000,
    minimumBet: 100,
  }
  private players: PokerPlayer[] = []
  private gameState: PokerState = this.defaultState()
  private deck: Deck = new Deck()
  private isStarted = false
  private lastRaiserIndex = -1
  private playersActedThisStreet: Set<number> = new Set()

  private defaultState(): PokerState {
    return {
      phase: 'waiting',
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentPlayerIndex: -1,
      dealerIndex: 0,
      smallBlind: 50,
      bigBlind: 100,
      minimumRaise: 100,
      players: [],
      roundNumber: 0,
    }
  }

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
        gameType: 'poker',
        players: this.players.length,
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
        this.gameState.bigBlind = this.settings.minimumBet
        this.gameState.smallBlind = Math.floor(this.settings.minimumBet / 2)
        this.gameState.minimumRaise = this.settings.minimumBet
      }
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
        case 'pk_fold':
          if (connection) this.handleAction(connection.playerId, 'fold')
          break
        case 'pk_check':
          if (connection) this.handleAction(connection.playerId, 'check')
          break
        case 'pk_call':
          if (connection) this.handleAction(connection.playerId, 'call')
          break
        case 'pk_raise':
          if (connection) this.handleAction(connection.playerId, 'raise', message.payload.amount)
          break
        case 'pk_all_in':
          if (connection) this.handleAction(connection.playerId, 'all_in')
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

  private handleJoin(ws: WebSocket, payload: { roomCode: string; token: string; displayName?: string }) {
    const playerId = this.extractUserId(payload.token) || `guest-${Date.now()}`
    const displayName = payload.displayName || `Player ${this.players.length + 1}`

    if (!this.roomCode && payload.roomCode) {
      this.roomCode = payload.roomCode
    }

    if (this.players.length >= this.settings.maxPlayers) {
      this.sendTo(ws, { type: 'error', payload: { message: 'Room is full', code: 'ROOM_FULL' } })
      return
    }

    const existing = this.connections.get(playerId)
    if (existing) {
      try { existing.ws.close(1000, 'Reconnected') } catch {}
    }

    this.connections.set(playerId, { ws, playerId })

    let player = this.players.find((p) => p.id === playerId)
    if (!player) {
      const pkPlayer: PokerPlayer = {
        id: playerId,
        username: displayName,
        displayName,
        chips: this.settings.startingChips,
        isHost: playerId === this.hostId || this.players.length === 0,
        isReady: false,
        isConnected: true,
        seatIndex: this.players.length,
        hand: [],
        currentBet: 0,
        totalBet: 0,
        isFolded: false,
        isAllIn: false,
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: false,
      }
      this.players.push(pkPlayer)
      if (this.players.length === 1) this.hostId = playerId
      this.broadcast({ type: 'player_joined', payload: { player: pkPlayer } })
    } else {
      player.isConnected = true
      this.broadcast({ type: 'player_joined', payload: { player } })
    }

    const state = this.getRoomState()
    if (state.gameState) {
      const gs = state.gameState as PokerState
      gs.players = gs.players.map((p) => ({
        ...p,
        hand: p.id === playerId ? p.hand : p.hand.map(() => ({ suit: 'spades' as const, rank: '2' as const, faceUp: false })),
      }))
    }
    this.sendTo(ws, { type: 'room_state', payload: state })
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
    this.broadcast({ type: 'game_started', payload: { gameType: 'poker' } })
    this.startNewHand()
  }

  private startNewHand() {
    this.deck = new Deck()

    const active = this.players.filter((p) => p.chips > 0 && p.isConnected)
    if (active.length < 2) return

    // Rotate dealer among active players by tracking the previous dealer's ID
    if (this.gameState.roundNumber > 0) {
      const prevDealerPlayer = this.gameState.players[this.gameState.dealerIndex]
      const prevDealerId = prevDealerPlayer?.id
      const prevIdxInActive = prevDealerId ? active.findIndex((p) => p.id === prevDealerId) : -1
      this.gameState.dealerIndex = prevIdxInActive === -1
        ? 0
        : (prevIdxInActive + 1) % active.length
    } else {
      this.gameState.dealerIndex = 0
    }

    const dealerIdx = this.gameState.dealerIndex
    const n = active.length
    const isHeadsUp = n === 2

    const sbIdx = isHeadsUp ? dealerIdx : (dealerIdx + 1) % n
    const bbIdx = isHeadsUp ? (dealerIdx + 1) % n : (dealerIdx + 2) % n

    this.gameState = {
      phase: 'preflop',
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentPlayerIndex: -1,
      dealerIndex: dealerIdx,
      smallBlind: Math.floor(this.settings.minimumBet / 2),
      bigBlind: this.settings.minimumBet,
      minimumRaise: this.settings.minimumBet,
      players: active.map((p, i) => ({
        ...p,
        hand: [this.deck.deal(true), this.deck.deal(true)],
        currentBet: 0,
        totalBet: 0,
        isFolded: false,
        isAllIn: false,
        isDealer: i === dealerIdx,
        isSmallBlind: i === sbIdx,
        isBigBlind: i === bbIdx,
        result: undefined,
        handRank: undefined,
        winnings: undefined,
      })),
      roundNumber: this.gameState.roundNumber + 1,
    }

    this.postBlind(sbIdx, this.gameState.smallBlind)
    this.postBlind(bbIdx, this.gameState.bigBlind)

    this.lastRaiserIndex = bbIdx
    this.playersActedThisStreet = new Set()

    this.gameState.currentPlayerIndex = this.findNextActivePlayer(bbIdx)
    this.broadcastStatePerPlayer()
  }

  private postBlind(playerIndex: number, amount: number) {
    const player = this.gameState.players[playerIndex]
    const actual = Math.min(amount, player.chips)
    player.chips -= actual
    player.currentBet = actual
    player.totalBet = actual
    this.gameState.pot += actual
    if (player.chips === 0) player.isAllIn = true
  }

  private handleAction(playerId: string, action: string, amount?: number) {
    const playerIndex = this.gameState.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1 || playerIndex !== this.gameState.currentPlayerIndex) return
    if (this.gameState.phase === 'waiting' || this.gameState.phase === 'showdown' || this.gameState.phase === 'complete') return

    const player = this.gameState.players[playerIndex]
    if (player.isFolded || player.isAllIn) return

    const maxBet = Math.max(...this.gameState.players.map((p) => p.currentBet))

    switch (action) {
      case 'fold':
        player.isFolded = true
        break
      case 'check':
        if (player.currentBet < maxBet) {
          this.sendToPlayer(playerId, { type: 'error', payload: { message: 'Cannot check — must call or raise' } })
          return
        }
        break
      case 'call': {
        const toCall = maxBet - player.currentBet
        const actual = Math.min(toCall, player.chips)
        player.chips -= actual
        player.currentBet += actual
        player.totalBet += actual
        this.gameState.pot += actual
        if (player.chips === 0) player.isAllIn = true
        break
      }
      case 'raise': {
        if (!amount || amount < this.gameState.minimumRaise) {
          this.sendToPlayer(playerId, { type: 'error', payload: { message: `Minimum raise: ${this.gameState.minimumRaise}` } })
          return
        }
        const raiseTotal = maxBet + amount
        const needed = raiseTotal - player.currentBet
        const actual = Math.min(needed, player.chips)
        player.chips -= actual
        player.currentBet += actual
        player.totalBet += actual
        this.gameState.pot += actual
        this.gameState.minimumRaise = amount
        if (player.chips === 0) player.isAllIn = true
        break
      }
      case 'all_in': {
        const allIn = player.chips
        player.currentBet += allIn
        player.totalBet += allIn
        this.gameState.pot += allIn
        player.chips = 0
        player.isAllIn = true
        if (player.currentBet > maxBet) {
          this.gameState.minimumRaise = player.currentBet - maxBet
        }
        break
      }
      default:
        return
    }

    // Track that this player has acted, and update last raiser on raise/all-in
    this.playersActedThisStreet.add(playerIndex)
    if (action === 'raise' || (action === 'all_in' && player.currentBet > Math.max(...this.gameState.players.map((p) => p.currentBet).filter((_, i) => i !== playerIndex)))) {
      this.lastRaiserIndex = playerIndex
      // Reset acted set — everyone else needs to respond to the raise
      this.playersActedThisStreet = new Set([playerIndex])
    }

    this.gameState.lastAction = { playerId, action, amount }
    this.broadcast({ type: 'pk_action', payload: { playerId, action, amount } })

    const activePlayers = this.gameState.players.filter((p) => !p.isFolded)
    if (activePlayers.length === 1) {
      this.awardPot([activePlayers[0]], 'Last Standing')
      return
    }

    if (this.isRoundComplete()) {
      this.advancePhase()
    } else {
      const next = this.findNextActivePlayer(playerIndex)
      if (next === -1) {
        this.advancePhase()
      } else {
        this.gameState.currentPlayerIndex = next
        this.broadcastStatePerPlayer()
      }
    }
  }

  private isRoundComplete(): boolean {
    const active = this.gameState.players.filter((p) => !p.isFolded && !p.isAllIn)
    if (active.length === 0) return true
    const maxBet = Math.max(...this.gameState.players.filter((p) => !p.isFolded).map((p) => p.currentBet))
    if (!active.every((p) => p.currentBet === maxBet)) return false
    // Every active player must have acted at least once this street
    for (const p of active) {
      const idx = this.gameState.players.findIndex((gp) => gp.id === p.id)
      if (!this.playersActedThisStreet.has(idx)) return false
    }
    return true
  }

  private async advancePhase() {
    for (const p of this.gameState.players) p.currentBet = 0
    this.playersActedThisStreet = new Set()
    this.lastRaiserIndex = -1

    const phases: PokerPhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown']
    const currentIdx = phases.indexOf(this.gameState.phase)
    const canAct = this.gameState.players.filter((p) => !p.isFolded && !p.isAllIn)

    if (currentIdx < 4) this.gameState.phase = phases[currentIdx + 1]

    switch (this.gameState.phase) {
      case 'flop':
        this.gameState.communityCards.push(this.deck.deal(true), this.deck.deal(true), this.deck.deal(true))
        break
      case 'turn':
        this.gameState.communityCards.push(this.deck.deal(true))
        break
      case 'river':
        this.gameState.communityCards.push(this.deck.deal(true))
        break
      case 'showdown':
        await this.resolveShowdown()
        return
    }

    this.gameState.minimumRaise = this.gameState.bigBlind
    if (canAct.length <= 1) {
      await this.delay(1000)
      this.advancePhase()
      return
    }
    this.gameState.currentPlayerIndex = this.findNextActivePlayer(this.gameState.dealerIndex)
    this.broadcastStatePerPlayer()
  }

  private async resolveShowdown() {
    this.gameState.phase = 'showdown'
    for (const p of this.gameState.players) {
      if (!p.isFolded) p.hand = p.hand.map((c) => ({ ...c, faceUp: true }))
    }

    const contenders = this.gameState.players.filter((p) => !p.isFolded)
    const evaluations = new Map<string, HandEvaluation>()

    for (const p of contenders) {
      const evaluation = evaluatePokerHand([...p.hand, ...this.gameState.communityCards])
      p.handRank = evaluation.name
      evaluations.set(p.id, evaluation)
    }

    // Find the best hand
    let bestEval: HandEvaluation | null = null
    for (const ev of evaluations.values()) {
      if (!bestEval || compareHands(ev, bestEval) > 0) bestEval = ev
    }

    // Find ALL players who tie for the best hand
    const winners = contenders.filter((p) => {
      const ev = evaluations.get(p.id)!
      return compareHands(ev, bestEval!) === 0
    })

    this.awardPot(winners, bestEval?.name || 'Winner')
  }

  private awardPot(winners: PokerPlayer[], handRank: string) {
    const share = Math.floor(this.gameState.pot / winners.length)
    const remainder = this.gameState.pot - share * winners.length

    for (let i = 0; i < winners.length; i++) {
      const w = winners[i]
      const amount = share + (i === 0 ? remainder : 0)
      w.chips += amount
      w.result = 'win'
      w.winnings = amount
      w.handRank = handRank
    }

    for (const p of this.gameState.players) {
      if (!winners.some((w) => w.id === p.id)) p.result = 'lose'
    }

    this.syncPlayersBack()

    this.broadcast({
      type: 'pk_winner',
      payload: {
        playerId: winners[0].id,
        amount: this.gameState.pot,
        handRank,
        isSplit: winners.length > 1,
        winnerIds: winners.map((w) => w.id),
      },
    })

    this.gameState.phase = 'complete'
    this.broadcastStatePerPlayer()

    setTimeout(() => {
      const connected = this.players.filter((p) => p.isConnected)
      let active = connected.filter((p) => p.chips > 0)

      if (active.length < 2 && connected.length >= 2) {
        for (const p of this.players) {
          p.chips = this.settings.startingChips
        }
        this.broadcast({ type: 'chips_reset', payload: { startingChips: this.settings.startingChips } })
        active = connected
      }

      if (active.length >= 2) {
        this.startNewHand()
      } else {
        this.gameState.phase = 'waiting'
        this.broadcastStatePerPlayer()
      }
    }, 6000)
  }

  private findNextActivePlayer(fromIndex: number): number {
    const total = this.gameState.players.length
    for (let i = 1; i <= total; i++) {
      const idx = (fromIndex + i) % total
      const p = this.gameState.players[idx]
      if (!p.isFolded && !p.isAllIn && p.chips > 0) return idx
    }
    return -1
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
      gameType: 'poker',
      hostId: this.hostId,
      players: this.players,
      maxPlayers: this.settings.maxPlayers,
      isStarted: this.isStarted,
      settings: this.settings,
      gameState: this.isStarted ? { ...this.gameState } : undefined,
    }
  }

  private broadcastStatePerPlayer() {
    for (const conn of this.connections.values()) {
      const state: PokerState = {
        ...this.gameState,
        players: this.gameState.players.map((p) => {
          if (p.id === conn.playerId) return p
          if (this.gameState.phase === 'showdown' || this.gameState.phase === 'complete') return p
          return { ...p, hand: p.hand.map(() => ({ suit: 'spades' as const, rank: '2' as const, faceUp: false })) }
        }),
      }
      this.sendTo(conn.ws, { type: 'pk_state', payload: state })
    }
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

  private sendToPlayer(playerId: string, message: ServerMessage) {
    const conn = this.connections.get(playerId)
    if (conn) this.sendTo(conn.ws, message)
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
    } catch {
      return null
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
