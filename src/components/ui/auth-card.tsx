'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <motion.div
        className={cn(
          'glass-strong rounded-3xl p-8 md:p-10 w-full max-w-[420px]',
          'shadow-2xl shadow-black/40',
          className
        )}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  )
}
