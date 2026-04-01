'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/stores/game-store'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { GameWebSocket } from '@/lib/websocket/client'
import { createClient } from '@/lib/supabase/client'
import {
  AnimatedButton,
  GlassPanel,
  RoomCodeBadge,
  StatusPill,
} from '@/components/ui'
import { BlackjackTable } from '@/components/game/blackjack-table'
import { PokerTable } from '@/components/game/poker-table'
import { ArrowLeft, Copy, Users, Play, Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import type { ServerMessage, RoomState } from '@/types'

function RoomContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = (params.code as string).toUpperCase()
  const gameTypeParam = searchParams.get('game') || 'blackjack'

  const { user } = useAuthStore()
  const addToast = useUIStore((s) => s.addToast)

  const roomState = useGameStore((s) => s.roomState)
  const isConnected = useGameStore((s) => s.isConnected)
  const setRoomState = useGameStore((s) => s.setRoomState)
  const addPlayer = useGameStore((s) => s.addPlayer)
  const removePlayer = useGameStore((s) => s.removePlayer)
  const setPlayerReady = useGameStore((s) => s.setPlayerReady)
  const setConnected = useGameStore((s) => s.setConnected)
  const setConnectionError = useGameStore((s) => s.setConnectionError)
  const updateGameState = useGameStore((s) => s.updateGameState)
  const resetStore = useGameStore((s) => s.reset)

  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>('connecting')
  const wsRef = useRef<GameWebSocket | null>(null)
  const mountedRef = useRef(true)

  const doConnect = useCallback(async (ws: GameWebSocket) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const displayName = user?.display_name || 'Player'

      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }
      const wsUrl = workerUrl.replace(/^http/, 'ws') + `/ws/room/${code}?game=${gameTypeParam}`

      await ws.connect(wsUrl, token, code, displayName)
    } catch {
      if (mountedRef.current) {
        setConnectionError('Failed to connect to game server')
        setConnStatus('failed')
      }
    }
  }, [code, gameTypeParam, user?.display_name, setConnectionError])

  useEffect(() => {
    mountedRef.current = true
    const ws = new GameWebSocket()
    wsRef.current = ws

    const unsubMessage = ws.onMessage((message: ServerMessage) => {
      if (!mountedRef.current) return

      switch (message.type) {
        case 'room_state':
          setRoomState(message.payload as RoomState)
          setConnected(true)
          setConnStatus('connected')
          break
        case 'player_joined':
          addPlayer(message.payload.player)
          break
        case 'player_left':
          removePlayer(message.payload.playerId)
          break
        case 'player_ready':
          setPlayerReady(message.payload.playerId)
          break
        case 'game_started': {
          const current = useGameStore.getState().roomState
          if (current) setRoomState({ ...current, isStarted: true })
          break
        }
        case 'bj_state':
        case 'bj_round_result':
          updateGameState(message.payload)
          break
        case 'pk_state':
        case 'pk_showdown':
          updateGameState(message.payload)
          break
        case 'chips_reset':
          addToast({ type: 'info', title: 'Chips Reset', message: `Everyone is out of chips! All players reset to ${message.payload.startingChips.toLocaleString()} chips.` })
          break
        case 'error':
          if (message.payload.code === 'ROOM_NOT_FOUND') {
            router.push('/dashboard')
          }
          break
        case 'pong':
          break
      }
    })

    const unsubState = ws.onStateChange((state) => {
      if (!mountedRef.current) return
      switch (state) {
        case 'connecting':
          setConnStatus((prev) => prev === 'connected' ? 'reconnecting' : prev === 'failed' ? 'connecting' : prev)
          break
        case 'connected':
          setConnected(true)
          setConnStatus('connected')
          setConnectionError(null)
          break
        case 'failed':
          setConnectionError('Unable to reach the game server')
          setConnStatus('failed')
          break
      }
    })

    doConnect(ws)

    return () => {
      mountedRef.current = false
      unsubMessage()
      unsubState()
      ws.disconnect()
      wsRef.current = null
      resetStore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, gameTypeParam])

  const isHost = roomState?.hostId === user?.id
  const allReady = roomState?.players?.every((p) => p.isReady) && (roomState?.players?.length ?? 0) >= 2

  function handleReady() {
    wsRef.current?.send({ type: 'player_ready' })
  }

  function handleStartGame() {
    wsRef.current?.send({ type: 'start_game' })
  }

  function handleRetry() {
    if (!wsRef.current) return
    setConnStatus('connecting')
    setConnectionError(null)
    const ws = new GameWebSocket()
    wsRef.current?.disconnect()
    wsRef.current = ws

    ws.onMessage((message: ServerMessage) => {
      if (!mountedRef.current) return
      switch (message.type) {
        case 'room_state':
          setRoomState(message.payload as RoomState)
          setConnected(true)
          setConnStatus('connected')
          break
        case 'player_joined': addPlayer(message.payload.player); break
        case 'player_left': removePlayer(message.payload.playerId); break
        case 'player_ready': setPlayerReady(message.payload.playerId); break
        case 'game_started': {
          const current = useGameStore.getState().roomState
          if (current) setRoomState({ ...current, isStarted: true })
          break
        }
        case 'bj_state': case 'bj_round_result': updateGameState(message.payload); break
        case 'pk_state': case 'pk_showdown': updateGameState(message.payload); break
        case 'chips_reset':
          addToast({ type: 'info', title: 'Chips Reset', message: `Everyone reset to ${message.payload.startingChips.toLocaleString()} chips.` })
          break
        case 'error':
          if (message.payload.code === 'ROOM_NOT_FOUND') router.push('/dashboard')
          break
      }
    })

    ws.onStateChange((state) => {
      if (!mountedRef.current) return
      if (state === 'connected') { setConnected(true); setConnStatus('connected'); setConnectionError(null) }
      if (state === 'failed') { setConnectionError('Unable to reach the game server'); setConnStatus('failed') }
    })

    doConnect(ws)
  }

  const connectionError = useGameStore((s) => s.connectionError)

  if (connStatus === 'connecting' || connStatus === 'failed' || (connStatus === 'reconnecting' && !roomState)) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4 px-6"
        >
          {connStatus === 'failed' ? (
            <>
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2">
                <RefreshCw className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-red-400 font-medium">{connectionError || 'Connection failed'}</p>
              <p className="text-text-tertiary text-sm">Make sure the game server is running.</p>
              <div className="flex gap-3 justify-center pt-2">
                <AnimatedButton onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </AnimatedButton>
                <Link href="/dashboard">
                  <AnimatedButton variant="ghost">Back to Lobby</AnimatedButton>
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
              <p className="text-text-secondary">Connecting to room {code}...</p>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  if (roomState?.isStarted && roomState.gameState) {
    return roomState.gameType === 'blackjack' ? (
      <BlackjackTable wsRef={wsRef} />
    ) : (
      <PokerTable wsRef={wsRef} />
    )
  }

  return (
    <div className="min-h-dvh">
      {connStatus === 'reconnecting' && (
        <motion.div
          initial={{ y: -40 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-black text-center text-sm font-medium py-1.5"
        >
          Reconnecting...
        </motion.div>
      )}

      <header className="sticky top-0 z-40 glass border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <RoomCodeBadge code={code} />
          </div>
          <StatusPill status={isConnected ? 'online' : 'offline'} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gradient mb-2">
              {(roomState?.gameType || gameTypeParam) === 'poker' ? 'Poker Table' : 'Blackjack Table'}
            </h1>
            <p className="text-text-secondary">
              Waiting for players... Share the room code to invite friends.
            </p>
          </div>

          <GlassPanel className="p-6 text-center">
            <p className="text-sm text-text-secondary mb-3">Share this code with friends</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-text-primary">
                {code}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code)
                  addToast({ type: 'success', title: 'Code copied!' })
                }}
                className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-text-tertiary"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Users className="h-4 w-4" />
                Players ({roomState?.players?.length || 0}/{roomState?.maxPlayers || '—'})
              </h3>
            </div>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {roomState?.players?.map((player) => (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-accent-light">
                          {player.displayName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {player.displayName}
                          {player.id === user?.id && (
                            <span className="ml-2 text-xs text-text-tertiary">(you)</span>
                          )}
                          {player.isHost && (
                            <span className="ml-2 text-xs text-accent-light">(Host)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={player.isReady ? 'ready' : 'waiting'} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {!roomState?.players?.length && (
                <div className="text-center py-8 text-text-tertiary text-sm">
                  Waiting for players to join...
                </div>
              )}
            </div>
          </GlassPanel>

          <div className="flex gap-3">
            {!roomState?.players?.find((p) => p.id === user?.id)?.isReady && (
              <AnimatedButton className="flex-1" onClick={handleReady}>
                Ready Up
              </AnimatedButton>
            )}
            {isHost && (
              <AnimatedButton
                className="flex-1"
                onClick={handleStartGame}
                disabled={!allReady}
                icon={<Play className="h-4 w-4" />}
              >
                Start Game
              </AnimatedButton>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default function RoomPage() {
  return (
    <Suspense>
      <RoomContent />
    </Suspense>
  )
}
