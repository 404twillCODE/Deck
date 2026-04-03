export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
export type GameType = 'blackjack' | 'poker' | 'uno' | 'hot-potato'

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue'
export type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four'

export interface UnoCard {
  id: string
  color: UnoColor | null
  type: UnoCardType
  value?: number
}

export interface UnoPlayerView {
  id: string
  displayName: string
  username: string
  chips: number
  isHost: boolean
  isReady: boolean
  isConnected: boolean
  seatIndex: number
  cards: UnoCard[]
  cardCount: number
  /** Round wins this match (resets after someone wins the match). */
  wins: number
  hasCalledUno: boolean
  canBeChallenged: boolean
}

export interface UnoState {
  phase: 'playing' | 'complete'
  players: UnoPlayerView[]
  currentPlayerIndex: number
  direction: 1 | -1
  discardTop: UnoCard
  currentColor: UnoColor
  drawPileCount: number
  hasDrawnThisTurn: boolean
  /** True when you drew a playable card from the pile this turn; optional draws from the pile are blocked. */
  cannotDrawMoreFromPile: boolean
  /** After stacking same-number cards, use End turn to stop even if you could play more. */
  canPassAfterNumberStack: boolean
  pendingDraw: number
  pendingDrawType: 'draw_two' | 'wild_draw_four' | null
  lastAction: { playerId: string; action: string; card?: UnoCard } | null
  winnerId: string | null
  roundNumber: number
  matchComplete: boolean
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
  avatar?: string
  chips: number
  isHost: boolean
  isReady: boolean
  isConnected: boolean
  seatIndex: number
}

export interface BlackjackHand {
  cards: Card[]
  bet: number
  isStanding: boolean
  isBusted: boolean
  isBlackjack: boolean
  value: number
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

export interface BlackjackPlayer extends Player {
  hand: BlackjackHand
  result?: 'win' | 'lose' | 'push' | 'blackjack'
  payout?: number
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

export interface Room {
  id: string
  code: string
  gameType: GameType
  hostId: string
  players: Player[]
  maxPlayers: number
  isStarted: boolean
  createdAt: string
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

export interface TableSettings {
  gameType: GameType
  maxPlayers: number
  startingChips: number
  minimumBet: number
  isPrivate: boolean
  cardsPerPlayer?: number
  winsToWin?: number
}
