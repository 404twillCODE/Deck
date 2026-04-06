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
import { UnoTable } from '@/components/game/uno-table'
import { HotPotatoTable } from '@/components/game/hot-potato-table'
import { RouletteTable } from '@/components/game/roulette-table'
import { ArrowLeft, Copy, Users, Play, Loader2, RefreshCw, Shield } from 'lucide-react'
import Link from 'next/link'
import { recordGameResult } from '@/lib/stats'
import type {
  BlackjackState,
  GameType,
  HotPotatoState,
  PokerState,
  RouletteState,
  RoomState,
  ServerMessage,
  UnoState,
} from '@/types'

function useStatsRecorder(isFreePlay: boolean) {
  const roomState = useGameStore((s) => s.roomState)
  const { user, isGuest, setUser } = useAuthStore()
  const recordedRef = useRef<string>('')

  useEffect(() => {
    if (!roomState?.gameState || !user || isGuest) return

    const gs = roomState.gameState
    const gameType = roomState.gameType as GameType
    if (!('phase' in gs) || gs.phase !== 'complete') return

    const roundKey = `${gameType}-${('roundNumber' in gs ? gs.roundNumber : 0)}`
    if (recordedRef.current === roundKey) return

    let won = false

    if (gameType === 'blackjack') {
      const blackjackState = gs as BlackjackState
      const player = blackjackState.players.find((p) => p.id === user.id)
      if (!player) return
      won = player.result === 'win' || player.result === 'blackjack'
    } else if (gameType === 'poker') {
      const pokerState = gs as PokerState
      const player = pokerState.players.find((p) => p.id === user.id)
      if (!player) return
      won = player.result === 'win' || (player.winnings ?? 0) > 0
    } else if (gameType === 'uno' || gameType === 'ultimate-uno') {
      const unoState = gs as UnoState
      won = unoState.winnerId === user.id
    } else if (gameType === 'hot-potato') {
      const hotPotatoState = gs as HotPotatoState
      won = hotPotatoState.winnerId === user.id
    } else if (gameType === 'roulette') {
      const rouletteState = gs as RouletteState
      const rPlayer = rouletteState.players.find((p) => p.id === user.id)
      if (!rPlayer) return
      won = rPlayer.result === 'win' || rPlayer.result === 'mixed'
    }

    recordedRef.current = roundKey
    recordGameResult(user.id, gameType, won).catch(() => {})

    if (!isFreePlay) {
      const maybeFinalChips =
        gameType === 'blackjack'
          ? (gs as BlackjackState).players.find((p) => p.id === user.id)?.chips
          : gameType === 'poker'
            ? (gs as PokerState).players.find((p) => p.id === user.id)?.chips
            : gameType === 'roulette'
              ? (gs as RouletteState).players.find((p) => p.id === user.id)?.chips
              : (gameType === 'uno' || gameType === 'ultimate-uno')
                ? null
                : gameType === 'hot-potato'
                  ? null
                  : null

      if (typeof maybeFinalChips === 'number') {
        const supabase = createClient()
        supabase
          .from('profiles')
          .update({ chips_balance: maybeFinalChips })
          .eq('id', user.id)
          .then(() => setUser({ ...user, chips_balance: maybeFinalChips }))
          .catch(() => {})
      }
    }
  }, [roomState?.gameState, roomState?.gameType, user, isGuest, isFreePlay, setUser])
}

function RoomContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = (params.code as string).toUpperCase()
  const gameTypeQuery = searchParams.get('game')
  const [resolvedGameType, setResolvedGameType] = useState<string | null>(gameTypeQuery)
  const gameTypeParam = resolvedGameType || 'blackjack'

  const { user, isGuest } = useAuthStore()
  const freePlayQuery = searchParams.get('freePlay')
  const [isFreePlay, setIsFreePlay] = useState(freePlayQuery === '1')
  const addToast = useUIStore((s) => s.addToast)
  useStatsRecorder(isFreePlay)

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
  const [freePlayUpdating, setFreePlayUpdating] = useState(false)
  const wsRef = useRef<GameWebSocket | null>(null)
  const mountedRef = useRef(true)

  // If someone opens a room link without ?game=..., resolve it via the worker
  // before attempting the websocket connection. This is critical when joining
  // a poker/uno/etc room from a login redirect or shared link.
  useEffect(() => {
    const cur = searchParams.get('game')
    if (cur) {
      setResolvedGameType(cur)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
        }
        const res = await fetch(`${workerUrl}/api/rooms/${code}`)
        const data = res.ok ? await res.json() as { gameType?: string; freePlay?: boolean } : null
        const gt = data?.gameType || 'blackjack'
        const fp = data?.freePlay ? '&freePlay=1' : ''
        if (cancelled) return
        setResolvedGameType(gt)
        router.replace(`/room/${code}?game=${encodeURIComponent(gt)}${fp}`)
      } catch {
        if (cancelled) return
        setResolvedGameType('blackjack')
      }
    })()

    return () => { cancelled = true }
  }, [code, router, searchParams])

  // If the room is free-play but the URL doesn't include `freePlay=1`,
  // fetch the room metadata so chip syncing stays disabled.
  useEffect(() => {
    if (freePlayQuery) return
    let cancelled = false

    void (async () => {
      try {
        let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
        }
        const res = await fetch(`${workerUrl}/api/rooms/${code}`)
        const data = res.ok ? await res.json() as { freePlay?: boolean } : null
        if (cancelled) return
        setIsFreePlay(!!data?.freePlay)
      } catch {
        // Ignore
      }
    })()

    return () => { cancelled = true }
  }, [code, freePlayQuery])

  const doConnect = useCallback(async (ws: GameWebSocket) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const displayName =
        user?.display_name?.trim() ||
        user?.username?.trim() ||
        'Player'

      // Fetch bankroll at connect-time to avoid racing auth/profile hydration.
      let accountChips = 0
      if (user && !isGuest) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('chips_balance')
            .eq('id', user.id)
            .maybeSingle()
          if (profile && typeof profile.chips_balance === 'number') accountChips = profile.chips_balance
          else accountChips = user.chips_balance ?? 0
        } catch {
          accountChips = user.chips_balance ?? 0
        }
      } else {
        accountChips = user?.chips_balance ?? 0
      }

      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }
      const u = new URL(workerUrl)
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:'
      const pathPrefix = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
      const wsUrl = `${wsProto}//${u.host}${pathPrefix}/ws/room/${code}?game=${encodeURIComponent(gameTypeParam)}`

      await ws.connect(wsUrl, token, code, displayName, accountChips)
    } catch {
      if (mountedRef.current) {
        setConnectionError('Failed to connect to game server')
        setConnStatus('failed')
      }
    }
  }, [code, gameTypeParam, user?.display_name, user?.username, user?.id, user?.chips_balance, isGuest, setConnectionError])

  useEffect(() => {
    if (!resolvedGameType) return
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
        case 'uno_state':
        case 'hp_state':
          updateGameState(message.payload)
          break
        case 'rl_state':
        case 'rl_round_result':
          updateGameState(message.payload)
          break
        case 'chips_reset':
          addToast({ type: 'info', title: 'Chips Reset', message: `Everyone is out of chips! All players reset to ${message.payload.startingChips.toLocaleString()} chips.` })
          break
        case 'error':
          if (message.payload.code === 'ROOM_NOT_FOUND') {
            router.push('/')
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
  }, [code, gameTypeParam, resolvedGameType])

  const isHost = roomState?.hostId === user?.id
  const minPlayers = roomState?.gameType === 'roulette' ? 1 : roomState?.gameType === 'ultimate-uno' ? 2 : 2
  const allReady = roomState?.players?.every((p) => p.isReady) && (roomState?.players?.length ?? 0) >= minPlayers

  // Authoritative: follow the room's actual setting (so toggles update everyone).
  useEffect(() => {
    if (typeof roomState?.settings?.freePlay === 'boolean') setIsFreePlay(!!roomState.settings.freePlay)
  }, [roomState?.settings?.freePlay])

  function handleReady() {
    wsRef.current?.send({ type: 'player_ready' })
  }

  function handleStartGame() {
    wsRef.current?.send({ type: 'start_game' })
  }

  async function handleToggleFreePlay(next: boolean) {
    if (!roomState || !user) return
    if (!isHost) return
    if (roomState.isStarted) return
    if (roomState.gameType !== 'blackjack' && roomState.gameType !== 'poker' && roomState.gameType !== 'roulette') return

    setFreePlayUpdating(true)
    try {
      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }

      const res = await fetch(`${workerUrl}/api/rooms/${code}/freeplay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freePlay: next }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Failed to update free play (${res.status})`)
      }

      setIsFreePlay(next)
    } catch (e) {
      addToast({ type: 'error', title: 'Free Play update failed', message: e instanceof Error ? e.message : 'Try again.' })
    } finally {
      setFreePlayUpdating(false)
    }
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
        case 'uno_state': case 'hp_state': updateGameState(message.payload); break
        case 'rl_state': case 'rl_round_result': updateGameState(message.payload); break
        case 'chips_reset':
          addToast({ type: 'info', title: 'Chips Reset', message: `Everyone reset to ${message.payload.startingChips.toLocaleString()} chips.` })
          break
        case 'error':
          if (message.payload.code === 'ROOM_NOT_FOUND') router.push('/')
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
                <AnimatedButton href="/" variant="ghost">Back Home</AnimatedButton>
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
    if (roomState.gameType === 'blackjack') return <BlackjackTable wsRef={wsRef} />
    if (roomState.gameType === 'poker') return <PokerTable wsRef={wsRef} />
    if (roomState.gameType === 'uno' || roomState.gameType === 'ultimate-uno') return <UnoTable wsRef={wsRef} />
    if (roomState.gameType === 'hot-potato') return <HotPotatoTable wsRef={wsRef} />
    if (roomState.gameType === 'roulette') return <RouletteTable wsRef={wsRef} />
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
            <Link href="/" className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-text-secondary">
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
              {(roomState?.gameType || gameTypeParam) === 'poker'
                ? 'Poker Table'
                : (roomState?.gameType || gameTypeParam) === 'uno'
                  ? 'Uno Table'
                  : (roomState?.gameType || gameTypeParam) === 'ultimate-uno'
                    ? 'Ultimate Uno'
                    : (roomState?.gameType || gameTypeParam) === 'hot-potato'
                      ? 'Hot Potato'
                      : (roomState?.gameType || gameTypeParam) === 'roulette'
                        ? 'Roulette Table'
                        : 'Blackjack Table'}
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

            {isHost && !roomState?.isStarted && (roomState?.gameType === 'blackjack' || roomState?.gameType === 'poker' || roomState?.gameType === 'roulette') && (
              <div className="mb-4 flex items-center justify-between p-4 rounded-xl glass border border-white/[0.06]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-primary">Free Play</span>
                  <span className="text-xs text-text-tertiary">Uses table chips (starting chips)</span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isFreePlay}
                    disabled={freePlayUpdating}
                    onChange={(e) => void handleToggleFreePlay(e.target.checked)}
                    aria-label="Free Play"
                  />
                  <span
                    className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                      isFreePlay ? 'bg-accent/60' : 'bg-white/10'
                    }`}
                  />
                  <span
                    className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isFreePlay ? 'translate-x-6' : 'translate-x-0'
                    } ${freePlayUpdating ? 'opacity-70' : ''}`}
                  />
                </label>
              </div>
            )}

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

          {(roomState?.gameType === 'uno' || roomState?.gameType === 'ultimate-uno') && !roomState?.isStarted && (
            <GlassPanel className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-text-secondary" />
                <h3 className="text-sm font-medium text-text-secondary">Teams (Optional)</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {['Solo', 'Team 1', 'Team 2', 'Team 3', 'Team 4'].map((label) => {
                  const teamValue = label === 'Solo' ? null : label.toLowerCase().replace(' ', '-')
                  const myTeam = roomState?.players?.find((p) => p.id === user?.id)?.team ?? null
                  const isSelected = myTeam === teamValue
                  const teamColors: Record<string, string> = {
                    'Solo': 'border-white/[0.06] bg-white/[0.02]',
                    'Team 1': 'border-blue-500/30 bg-blue-500/5',
                    'Team 2': 'border-red-500/30 bg-red-500/5',
                    'Team 3': 'border-emerald-500/30 bg-emerald-500/5',
                    'Team 4': 'border-amber-500/30 bg-amber-500/5',
                  }
                  const teamActiveColors: Record<string, string> = {
                    'Solo': 'border-accent/50 bg-accent/10 shadow-[0_0_12px_rgba(99,102,241,0.1)]',
                    'Team 1': 'border-blue-500/60 bg-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
                    'Team 2': 'border-red-500/60 bg-red-500/15 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
                    'Team 3': 'border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
                    'Team 4': 'border-amber-500/60 bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
                  }
                  return (
                    <button
                      key={label}
                      onClick={() => wsRef.current?.send({ type: 'set_team', payload: { team: teamValue } })}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        isSelected ? teamActiveColors[label] : teamColors[label]
                      } ${isSelected ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-text-tertiary">
                {roomState?.players?.map((p) => {
                  const teamLabel = p.team ? p.team.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Solo'
                  return (
                    <span key={p.id} className="px-2 py-1 rounded-lg bg-white/[0.03]">
                      {p.displayName}: {teamLabel}
                    </span>
                  )
                })}
              </div>
            </GlassPanel>
          )}

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
