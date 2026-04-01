'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { AnimatedButton } from '@/components/ui'
import { ArrowRight, Users, Shield, Zap, Sparkles } from 'lucide-react'

function FloatingCard({ suit, rank, className, delay }: { suit: string; rank: string; className?: string; delay?: number }) {
  const isRedSuit = suit === '♥' || suit === '♦'
  const color = isRedSuit ? 'text-red-400' : 'text-white/80'

  return (
    <div className={`absolute z-[5] pointer-events-auto ${className}`}>
      {/* Float layer -- perpetual bob, never interrupted */}
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
        {/* Hover layer -- separate so it doesn't fight the float */}
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
          <span className="text-gradient">Your table</span>
          <br />
          <span className="text-gradient-accent">is waiting.</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-text-secondary max-w-lg mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Poker and Blackjack, beautifully crafted. Create a room, share the code, and deal in seconds.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Link href="/signup">
            <AnimatedButton size="lg" className="min-w-[180px]">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </AnimatedButton>
          </Link>
          <Link href="/login">
            <AnimatedButton variant="secondary" size="lg" className="min-w-[180px]">
              Sign In
            </AnimatedButton>
          </Link>
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
      description: 'Server-authoritative game logic. Every shuffle, every deal — verified and tamper-proof.',
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Instant Rooms',
      description: 'Create a table in one tap. Share a 6-digit code. Your friends join in seconds.',
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
            Everything you need for the perfect game night, designed with obsessive attention to detail.
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

function GameShowcase() {
  return (
    <section className="relative py-32 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/[0.06] to-transparent rounded-bl-full" />
            <div className="text-4xl mb-4">🃏</div>
            <h3 className="text-2xl font-bold text-text-primary mb-3">Blackjack</h3>
            <p className="text-text-secondary leading-relaxed mb-6">
              Classic 21 with multiplayer tables. Hit, stand, or double down — with fluid card animations and real-time updates.
            </p>
            <div className="flex gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-text-tertiary">2-7 Players</span>
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-text-tertiary">Server Dealt</span>
            </div>
          </motion.div>

          <motion.div
            className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-accent/[0.06] to-transparent rounded-bl-full" />
            <div className="text-4xl mb-4">♠️</div>
            <h3 className="text-2xl font-bold text-text-primary mb-3">Texas Hold&apos;em</h3>
            <p className="text-text-secondary leading-relaxed mb-6">
              Full poker experience — blinds, community cards, all-in moments. Server-side shuffles keep every hand honest.
            </p>
            <div className="flex gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-text-tertiary">2-9 Players</span>
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-text-tertiary">No Limit</span>
            </div>
          </motion.div>
        </div>
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
          <Link href="/signup">
            <AnimatedButton size="lg" className="min-w-[200px]">
              Create Account
              <ArrowRight className="h-4 w-4" />
            </AnimatedButton>
          </Link>
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
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-bold text-accent-light">D</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">Deck</span>
        </div>
        <p className="text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} Deck. Built for game night.
        </p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <main>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
              <span className="text-sm font-bold text-accent-light">D</span>
            </div>
            <span className="text-lg font-semibold text-text-primary">Deck</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <AnimatedButton variant="ghost" size="sm">Sign In</AnimatedButton>
            </Link>
            <Link href="/signup">
              <AnimatedButton size="sm">Get Started</AnimatedButton>
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />
      <FeatureSection />
      <GameShowcase />
      <CTASection />
      <Footer />
    </main>
  )
}
