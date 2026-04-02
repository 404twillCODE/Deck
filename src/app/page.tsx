'use client'

import { useState, useCallback } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatedButton, DeckLogo } from '@/components/ui'
import { ArrowRight, Users, Shield, Zap, Sparkles, Search, Loader2 } from 'lucide-react'
import { isGuestMode, enableGuestMode } from '@/lib/guest'
import { generateRoomCode } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function FloatingCard({ suit, rank, className, delay }: { suit: string; rank: string; className?: string; delay?: number }) {
  const isRedSuit = suit === '♥' || suit === '♦'
  const color = isRedSuit ? 'text-red-400' : 'text-white/80'

  return (
    <div className={`absolute z-[5] pointer-events-auto ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{
          opacity: 1,
          y: [0, -10, 0],
          scale: 1,
          rotate: [0, 1.5, -1, 0],
        }}
        transition={{
          opacity: { delay: delay || 0, duration: 0.6 },
          scale: { delay: delay || 0, duration: 0.6 },
          y: { delay: (delay || 0) + 0.6, duration: 5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { delay: (delay || 0) + 0.6, duration: 7, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <motion.div
          className="w-20 h-28 md:w-24 md:h-36 cursor-pointer will-change-transform rounded-xl md:rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16162a] to-[#0f0f1e] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.4),0_12px_40px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] p-2 md:p-2.5 flex flex-col"
          style={{ perspective: 800 }}
          whileHover={{
            scale: 1.18,
            y: -14,
            rotateY: 10,
            rotateX: -6,
            boxShadow: isRedSuit
              ? '0 25px 50px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 25px 50px rgba(99,102,241,0.35), 0 0 40px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
          whileTap={{ scale: 1.08 }}
        >
          <div className={`flex flex-col items-start ${color}`}>
            <span className="text-sm md:text-base font-extrabold leading-none">{rank}</span>
            <span className="text-[10px] md:text-xs leading-none">{suit}</span>
          </div>

          <div className={`flex-1 flex items-center justify-center ${color}`}>
            <span className="text-2xl md:text-3xl opacity-70 drop-shadow-sm">{suit}</span>
          </div>

          <div className={`flex flex-col items-end rotate-180 ${color}`}>
            <span className="text-sm md:text-base font-extrabold leading-none">{rank}</span>
            <span className="text-[10px] md:text-xs leading-none">{suit}</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function HeroSection() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()
  const isSignedIn = !!user && !isLoading
  const [joinOpen, setJoinOpen] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)

  function handleGetStarted() {
    if (isSignedIn) {
      document.getElementById('game-library')?.scrollIntoView({ behavior: 'smooth' })
    } else {
      router.push('/signup')
    }
  }

  async function handleJoin() {
    const code = roomCode.trim().toUpperCase()
    if (!code || code.length < 4) return
    setJoining(true)

    if (!isGuestMode()) {
      enableGuestMode()
    }

    try {
      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }
      const res = await fetch(`${workerUrl}/api/rooms/${code}`)
      if (res.ok) {
        const data = await res.json() as { gameType: string }
        router.push(`/room/${code}?game=${data.gameType}`)
      } else {
        router.push(`/room/${code}?game=blackjack`)
      }
    } catch {
      router.push(`/room/${code}?game=blackjack`)
    }
  }

  return (
    <section className="relative min-h-dvh flex items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_60%)]" />

      <FloatingCard suit="♠" rank="A" className="top-[15%] left-[8%] md:left-[15%] -rotate-12 opacity-60" delay={0.2} />
      <FloatingCard suit="♥" rank="K" className="top-[20%] right-[8%] md:right-[18%] rotate-6 opacity-50" delay={0.4} />
      <FloatingCard suit="♦" rank="Q" className="bottom-[25%] left-[12%] md:left-[22%] rotate-12 opacity-40" delay={0.6} />
      <FloatingCard suit="♣" rank="J" className="bottom-[20%] right-[10%] md:right-[15%] -rotate-6 opacity-50" delay={0.8} />
      <FloatingCard suit="♥" rank="10" className="top-[45%] left-[3%] rotate-[20deg] opacity-30 hidden md:block" delay={1.0} />
      <FloatingCard suit="♠" rank="9" className="top-[40%] right-[5%] -rotate-[15deg] opacity-30 hidden md:block" delay={1.2} />

      <div className="relative z-10 text-center max-w-3xl mx-auto pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium text-text-secondary">
            <Sparkles className="h-3.5 w-3.5 text-accent-light" />
            Play with friends instantly
          </span>
        </motion.div>

        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="text-gradient">Your deck</span>
          <br />
          <span className="text-gradient-accent">is waiting.</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-text-secondary max-w-lg mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Your favorite classic and casino games, all in one place. Create a room, share the code, and start playing in seconds.
        </motion.p>

        <motion.div
          className="flex flex-col items-center gap-4 pointer-events-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <AnimatedButton size="lg" className="min-w-[180px]" onClick={handleGetStarted}>
              {isSignedIn ? 'Browse Games' : 'Get Started'}
              <ArrowRight className="h-4 w-4" />
            </AnimatedButton>
            <AnimatedButton
              variant="secondary"
              size="lg"
              className="min-w-[180px]"
              onClick={() => setJoinOpen(!joinOpen)}
            >
              Join Game
            </AnimatedButton>
          </div>

          <AnimatePresence>
            {joinOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-xs overflow-hidden"
              >
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    maxLength={6}
                    autoFocus
                    className="flex-1 px-4 py-3 rounded-xl glass text-text-primary placeholder:text-text-tertiary text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-accent/30 bg-transparent uppercase"
                  />
                  <AnimatedButton onClick={handleJoin} disabled={roomCode.trim().length < 4} loading={joining}>
                    Go
                  </AnimatedButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/10 flex justify-center pt-2">
          <motion.div
            className="w-1 h-2 rounded-full bg-white/30"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  )
}

function FeatureSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [60, -60])

  const features = [
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Real-time Multiplayer',
      description: 'Play with friends across any device. Instant sync, smooth reconnects, zero hassle.',
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Fair & Secure',
      description: 'Server side authoritative game logic. Every shuffle, every deal verified and tamper proof.',
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Instant Rooms',
      description: 'Create a table in one tap. Share a 6 digit code. Your friends join in seconds.',
    },
  ]

  return (
    <section ref={ref} className="relative py-32 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div style={{ y }} className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-gradient mb-4">
            Cards, reimagined.
          </h2>
          <p className="text-text-secondary text-lg max-w-md mx-auto">
            Everything you need for the perfect game night from casino classics to party favorites.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="glass rounded-2xl p-8 hover:bg-white/[0.06] transition-colors duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent-light mb-5">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const GAMES = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Classic 21 with multiplayer tables. Hit, stand, or double down — with fluid card animations and real-time updates.',
    emoji: '🃏',
    category: 'casino' as const,
    tags: ['2-7 Players', 'Server Dealt'],
    status: 'live' as const,
  },
  {
    id: 'poker',
    name: "Texas Hold'em",
    description: 'Full poker experience — blinds, community cards, all-in moments. Server-side shuffles keep every hand honest.',
    emoji: '♠️',
    category: 'casino' as const,
    tags: ['2-9 Players', 'No Limit'],
    status: 'live' as const,
  },
  {
    id: 'uno',
    name: 'Uno',
    description: 'The classic color-matching card game. Play action cards, reverse turns, and race to empty your hand first.',
    emoji: '🔴',
    category: 'party' as const,
    tags: ['2-10 Players', 'Color Match'],
    status: 'live' as const,
  },
  {
    id: 'hot-potato',
    name: 'Hot Potato',
    description:
      'A fast-paced elimination game where players pass a “hot potato” before a hidden timer runs out. If you’re holding it when time hits zero, you’re out.',
    emoji: '🔥',
    category: 'party' as const,
    tags: ['3-10 Players', 'Elimination'],
    status: 'live' as const,
  },
  {
    id: 'roulette',
    name: 'Roulette',
    description: 'Place your bets and spin the wheel. Predict where it lands — numbers, colors, or ranges — and win chips if you’re right.',
    emoji: '🎰',
    category: 'casino' as const,
    tags: ['Betting', 'Wheel'],
    status: 'wip' as const,
  },
  {
    id: 'sus-meter',
    name: 'Sus Meter',
    description: 'Answer a prompt and vote on who fits it best. Results reveal who the group thinks is the most “sus.”',
    emoji: '🤨',
    category: 'party' as const,
    tags: ['Voting', 'Social'],
    status: 'wip' as const,
  },
  {
    id: 'would-you-rather',
    name: 'Would You Rather',
    description: 'Pick between two tough or funny choices. After everyone votes, see how your answer compares to the group.',
    emoji: '⚖️',
    category: 'party' as const,
    tags: ['Voting', 'Party'],
    status: 'wip' as const,
  },
  {
    id: 'guess-the-ranking',
    name: 'Guess the Ranking',
    description:
      'Put items in the correct order based on a category (like fastest, biggest, most popular). Closest to the real ranking wins.',
    emoji: '📊',
    category: 'party' as const,
    tags: ['Trivia', 'Order'],
    status: 'wip' as const,
    externalUrl: 'https://www.higherorlowergame.com/',
  },
  {
    id: 'pictionary',
    name: 'Pictionary',
    description: 'Draw a word or phrase while others try to guess it before time runs out. No words — just your drawing skills.',
    emoji: '🎨',
    category: 'party' as const,
    tags: ['Drawing', 'Guessing'],
    status: 'wip' as const,
    externalUrl: 'https://skribbl.io/',
  },
  {
    id: 'music-guess',
    name: 'Music Guess',
    description: 'Listen to a short clip and guess the song or artist as quickly as possible. Fastest correct answer wins the round.',
    emoji: '🎵',
    category: 'party' as const,
    tags: ['Music', 'Speed'],
    status: 'wip' as const,
    externalUrl: 'https://guessthesong.io/',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'All Games' },
  { id: 'casino', label: 'Casino' },
  { id: 'party', label: 'Party' },
]

function GameShowcase() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isSignedIn = !!user
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [creatingGame, setCreatingGame] = useState<string | null>(null)

  const filtered = GAMES.filter((g) => {
    if (category !== 'all' && g.category !== category) return false
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handlePlayGame = useCallback(async (gameId: string) => {
    if (!isSignedIn) {
      router.push(`/signup?game=${gameId}`)
      return
    }

    if (creatingGame) return
    setCreatingGame(gameId)

    const code = generateRoomCode()
    try {
      let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        workerUrl = workerUrl.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname)
      }

      const res = await fetch(`${workerUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, gameType: gameId, hostId: 'pending', maxPlayers: gameId === 'hot-potato' ? 8 : gameId === 'poker' ? 6 : 5 }),
      })

      if (res.ok) {
        router.push(`/room/${code}?game=${gameId}`)
      } else {
        setCreatingGame(null)
      }
    } catch {
      setCreatingGame(null)
    }
  }, [isSignedIn, creatingGame, router])

  return (
    <section id="game-library" className="relative py-32 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-gradient mb-4">Game Library</h2>
          <p className="text-text-secondary text-lg max-w-md mx-auto">
            Pick your game. Create a room. Start playing.
          </p>
        </motion.div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl glass text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-1 focus:ring-accent/30 bg-transparent"
          />
        </div>

        {/* Category filters */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat.id
                  ? 'bg-accent/20 text-accent-light border border-accent/30'
                  : 'glass text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Game grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((game, i) => {
              const isLive = game.status === 'live'
              const externalUrl = game.status === 'wip' ? game.externalUrl : undefined

              const inner = (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  whileHover={isLive || externalUrl ? { scale: 1.03, y: -4 } : {}}
                  whileTap={isLive || externalUrl ? { scale: 0.98 } : {}}
                  className={`glass rounded-2xl p-6 relative overflow-hidden group transition-colors text-left ${
                    isLive || externalUrl
                      ? 'cursor-pointer hover:bg-white/[0.06]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {game.status === 'wip' && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-medium text-amber-400 leading-none">Coming Soon</span>
                    </div>
                  )}
                  {isLive && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400 leading-none">Play Now</span>
                    </div>
                  )}
                  <div className="text-3xl mb-3">{game.emoji}</div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">{game.name}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">{game.description}</p>
                  {externalUrl && (
                    <p className="text-xs text-accent/90 mb-3 font-medium">Similar game — opens in a new tab</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {game.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] text-text-tertiary">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )

              if (isLive) {
                return (
                  <div key={game.id} onClick={() => handlePlayGame(game.id)} className="cursor-pointer relative">
                    {creatingGame === game.id && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-sm">
                        <Loader2 className="h-6 w-6 animate-spin text-accent-light" />
                      </div>
                    )}
                    {inner}
                  </div>
                )
              }
              if (externalUrl) {
                return (
                  <a key={game.id} href={externalUrl} target="_blank" rel="noopener noreferrer">
                    {inner}
                  </a>
                )
              }
              return <div key={game.id}>{inner}</div>
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-secondary">No games found matching your search.</div>
        )}
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="relative py-32 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-gradient mb-6">
            Ready to deal?
          </h2>
          <p className="text-text-secondary text-lg mb-10">
            Create your free account and start playing in under a minute.
          </p>
          <AnimatedButton href="/signup" size="lg" className="min-w-[200px]">
            Create Account
            <ArrowRight className="h-4 w-4" />
          </AnimatedButton>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DeckLogo size="sm" />
          <span className="text-sm font-semibold text-text-primary">Deck</span>
        </div>
        <p className="text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} Deck. Built for game night.
        </p>
      </div>
    </footer>
  )
}

function NavBar() {
  const { user, isLoading } = useAuthStore()
  const isSignedIn = !!user

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <DeckLogo />
          <span className="text-lg font-semibold text-text-primary">Deck</span>
        </Link>
        {!isLoading && (
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <AnimatedButton href="/profile" variant="ghost" size="sm">Profile</AnimatedButton>
                <AnimatedButton href="/leaderboard" variant="ghost" size="sm">Leaderboard</AnimatedButton>
              </>
            ) : (
              <>
                <AnimatedButton href="/login" variant="ghost" size="sm">Sign In</AnimatedButton>
                <AnimatedButton href="/signup" size="sm">Sign Up</AnimatedButton>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

export default function LandingPage() {
  return (
    <main>
      <NavBar />
      <HeroSection />
      <FeatureSection />
      <GameShowcase />
      <CTASection />
      <Footer />
    </main>
  )
}
