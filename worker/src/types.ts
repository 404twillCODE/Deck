export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
export type GameType = 'blackjack' | 'poker' | 'uno' | 'hot-potato'

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue'

export interface UnoCard {
  id: string
  color: UnoColor | null
  type: 'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'
  value?: number
}

export interface UnoState {
  phase: 'playing' | 'complete'
  players: {
    id: string; displayName: string; username: string; chips: number
    isHost: boolean; isReady: boolean; isConnected: boolean; seatIndex: number
    cards: UnoCard[]; cardCount: number; score: number
    hasCalledUno: boolean; canBeChallenged: boolean
  }[]
  currentPlayerIndex: number
  direction: 1 | -1
  discardTop: UnoCard
  currentColor: UnoColor
  drawPileCount: number
  hasDrawnThisTurn: boolean
  pendingDraw: number
  pendingDrawType: 'draw_two' | 'wild_draw_four' | null
  lastAction: { playerId: string; action: string; card?: UnoCard } | null
  winnerId: string | null
  roundNumber: number
}

export interface Card {
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export interface Player {
  id: string
  username: string
  displayName: string
  chips: number
  isHost: boolean
  isReady: boolean
  isConnected: boolean
  seatIndex: number
}

export interface TableSettings {
  gameType: GameType
  maxPlayers: number
  startingChips: number
  minimumBet: number
}

export interface BlackjackHand {
  cards: Card[]
  bet: number
  isStanding: boolean
  isBusted: boolean
  isBlackjack: boolean
  value: number
}

export interface BlackjackPlayer extends Player {
  hand: BlackjackHand
  result?: 'win' | 'lose' | 'push' | 'blackjack'
  payout?: number
}

export interface BlackjackState {
  phase: 'waiting' | 'betting' | 'dealing' | 'playing' | 'dealer_turn' | 'resolving' | 'complete'
  dealerHand: Card[]
  dealerValue: number
  players: BlackjackPlayer[]
  currentPlayerIndex: number
  minimumBet: number
  roundNumber: number
}

export type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete'

export interface PokerPlayer extends Player {
  hand: Card[]
  currentBet: number
  totalBet: number
  isFolded: boolean
  isAllIn: boolean
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
  result?: 'win' | 'lose'
  handRank?: string
  winnings?: number
}

export interface PokerState {
  phase: PokerPhase
  communityCards: Card[]
  pot: number
  sidePots: { amount: number; eligible: string[] }[]
  currentPlayerIndex: number
  dealerIndex: number
  smallBlind: number
  bigBlind: number
  minimumRaise: number
  players: PokerPlayer[]
  roundNumber: number
  lastAction?: { playerId: string; action: string; amount?: number }
}

export interface HotPotatoPlayer extends Player {
  isAlive: boolean
  eliminatedRound: number | null
}

export interface HotPotatoState {
  phase: 'waiting' | 'countdown' | 'passing' | 'exploded' | 'complete'
  players: HotPotatoPlayer[]
  holderIndex: number
  roundNumber: number
  eliminationOrder: string[]
  winnerId: string | null
  passCount: number
  roundStartedAt: number
  lastEliminatedId: string | null
}

export interface RoomState {
  roomId: string
  roomCode: string
  gameType: GameType
  hostId: string
  players: Player[]
  maxPlayers: number
  isStarted: boolean
  settings: TableSettings
  gameState?: BlackjackState | PokerState | UnoState | HotPotatoState
}

export type ClientMessage =
  | { type: 'join_room'; payload: { roomCode: string; token: string; displayName?: string } }
  | { type: 'leave_room' }
  | { type: 'player_ready' }
  | { type: 'start_game' }
  | { type: 'chat_message'; payload: { message: string } }
  | { type: 'bj_place_bet'; payload: { amount: number } }
  | { type: 'bj_hit' }
  | { type: 'bj_stand' }
  | { type: 'bj_double' }
  | { type: 'pk_fold' }
  | { type: 'pk_call' }
  | { type: 'pk_raise'; payload: { amount: number } }
  | { type: 'pk_check' }
  | { type: 'pk_all_in' }
  | { type: 'uno_play_card'; payload: { cardId: string; chosenColor?: string } }
  | { type: 'uno_draw' }
  | { type: 'uno_call_uno' }
  | { type: 'uno_challenge_uno'; payload: { targetPlayerId: string } }
  | { type: 'uno_pass' }
  | { type: 'hp_pass' }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'room_state'; payload: RoomState }
  | { type: 'player_joined'; payload: { player: Player } }
  | { type: 'player_left'; payload: { playerId: string } }
  | { type: 'player_ready'; payload: { playerId: string } }
  | { type: 'game_started'; payload: { gameType: string } }
  | { type: 'bj_state'; payload: BlackjackState }
  | { type: 'bj_round_result'; payload: BlackjackState }
  | { type: 'pk_state'; payload: PokerState }
  | { type: 'pk_action'; payload: { playerId: string; action: string; amount?: number } }
  | { type: 'pk_showdown'; payload: PokerState }
  | { type: 'pk_winner'; payload: { playerId: string; amount: number; handRank: string; isSplit?: boolean; winnerIds?: string[] } }
  | { type: 'uno_state'; payload: UnoState }
  | { type: 'hp_state'; payload: HotPotatoState }
  | { type: 'chips_reset'; payload: { startingChips: number } }
  | { type: 'chat'; payload: { playerId: string; username: string; message: string; timestamp: number } }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'pong' }

export interface Env {
  BLACKJACK_TABLE: DurableObjectNamespace
  POKER_TABLE: DurableObjectNamespace
  UNO_TABLE: DurableObjectNamespace
  HOT_POTATO_TABLE: DurableObjectNamespace
  ENVIRONMENT: string
}
