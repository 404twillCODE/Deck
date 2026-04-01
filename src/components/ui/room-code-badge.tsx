'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface RoomCodeBadgeProps {
  code: string
  className?: string
}

export function RoomCodeBadge({ code, className }: RoomCodeBadgeProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.button
      className={cn(
        'glass inline-flex items-center gap-2 px-4 py-2 rounded-xl',
        'hover:bg-white/[0.08] transition-colors cursor-pointer',
        className
      )}
      onClick={handleCopy}
      whileTap={{ scale: 0.97 }}
    >
      <span className="text-text-tertiary text-xs font-medium uppercase tracking-wider">
        Room
      </span>
      <span className="font-mono font-bold text-sm tracking-[0.2em] text-text-primary">
        {code}
      </span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-text-tertiary" />
      )}
    </motion.button>
  )
}
