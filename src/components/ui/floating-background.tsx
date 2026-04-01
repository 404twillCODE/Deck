'use client'

import { motion } from 'framer-motion'

export function FloatingBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Primary ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.08),transparent_60%)]" />
      
      {/* Floating orbs */}
      <motion.div
        className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-[100px]"
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[100px]"
        animate={{
          x: [0, -40, 20, 0],
          y: [0, 30, -30, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-[60%] left-[50%] w-[300px] h-[300px] rounded-full bg-blue-500/[0.02] blur-[80px]"
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -20, 40, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Subtle grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
