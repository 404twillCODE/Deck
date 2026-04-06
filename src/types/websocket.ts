import type { BlackjackState, PokerState, UnoState, HotPotatoState, RouletteState, RouletteBetDef, Player, TableSettings, Card } from './game'

export type ClientMessage =
  | { type: 'join_room'; payload: { roomCode: string; token: string; displayName?: string; accountChips?: number } }
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
  | { type: 'uno_choose_swap_target'; payload: { targetPlayerId: string } }
  | { type: 'set_team'; payload: { team: string | null } }
  | { type: 'hp_pass' }
  | { type: 'rl_place_bet'; payload: { bets: RouletteBetDef[] } }
  | { type: 'rl_clear_bets' }
  | { type: 'rl_confirm_bets' }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'room_state'; payload: RoomState }
  | { type: 'player_joined'; payload: { player: Player } }
  | { type: 'player_left'; payload: { playerId: string } }
  | { type: 'player_ready'; payload: { playerId: string } }
  | { type: 'game_started'; payload: { gameType: string } }
  | { type: 'bj_state'; payload: BlackjackState }
  | { type: 'bj_deal_card'; payload: { playerId: string; card: Card; handValue: number } }
  | { type: 'bj_dealer_card'; payload: { card: Card; dealerValue: number } }
  | { type: 'bj_round_result'; payload: BlackjackState }
  | { type: 'pk_state'; payload: PokerState }
  | { type: 'pk_deal_hand'; payload: { cards: Card[] } }
  | { type: 'pk_community_cards'; payload: { cards: Card[]; phase: string } }
  | { type: 'pk_action'; payload: { playerId: string; action: string; amount?: number } }
  | { type: 'pk_showdown'; payload: PokerState }
  | { type: 'pk_winner'; payload: { playerId: string; amount: number; handRank: string; isSplit?: boolean; winnerIds?: string[] } }
  | { type: 'uno_state'; payload: UnoState }
  | { type: 'hp_state'; payload: HotPotatoState }
  | { type: 'rl_state'; payload: RouletteState }
  | { type: 'rl_round_result'; payload: RouletteState }
  | { type: 'chips_reset'; payload: { startingChips: number } }
  | { type: 'chat'; payload: { playerId: string; username: string; message: string; timestamp: number } }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'pong' }

export interface RoomState {
  roomId: string
  roomCode: string
  gameType: string
  hostId: string
  players: Player[]
  maxPlayers: number
  isStarted: boolean
  settings: TableSettings
  gameState?: BlackjackState | PokerState | UnoState | HotPotatoState | RouletteState
}
