import { create } from 'zustand'
import type { RoomState, BlackjackState, PokerState, UnoState, HotPotatoState, RouletteState, Player } from '@/types'

interface GameStore {
  roomState: RoomState | null
  isConnected: boolean
  isReconnecting: boolean
  connectionError: string | null
  
  setRoomState: (state: RoomState | null) => void
  updateGameState: (gameState: BlackjackState | PokerState | UnoState | HotPotatoState | RouletteState) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  setPlayerReady: (playerId: string) => void
  setConnected: (connected: boolean) => void
  setReconnecting: (reconnecting: boolean) => void
  setConnectionError: (error: string | null) => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  roomState: null,
  isConnected: false,
  isReconnecting: false,
  connectionError: null,

  setRoomState: (roomState) => set({ roomState }),
  
  updateGameState: (gameState) => {
    const current = get().roomState
    if (current) {
      set({ roomState: { ...current, gameState, isStarted: true } })
    }
  },
  
  addPlayer: (player) => {
    const current = get().roomState
    if (current) {
      const exists = current.players.some((p) => p.id === player.id)
      set({
        roomState: {
          ...current,
          players: exists
            ? current.players.map((p) => (p.id === player.id ? { ...p, ...player, isConnected: true } : p))
            : [...current.players, player],
        },
      })
    }
  },
  
  removePlayer: (playerId) => {
    const current = get().roomState
    if (current) {
      set({
        roomState: {
          ...current,
          players: current.players.filter((p) => p.id !== playerId),
        },
      })
    }
  },
  
  setPlayerReady: (playerId) => {
    const current = get().roomState
    if (current) {
      set({
        roomState: {
          ...current,
          players: current.players.map((p) =>
            p.id === playerId ? { ...p, isReady: true } : p
          ),
        },
      })
    }
  },
  
  setConnected: (isConnected) => set({ isConnected, connectionError: null }),
  setReconnecting: (isReconnecting) => set({ isReconnecting }),
  setConnectionError: (connectionError) => set({ connectionError, isConnected: false }),
  reset: () =>
    set({
      roomState: null,
      isConnected: false,
      isReconnecting: false,
      connectionError: null,
    }),
}))
