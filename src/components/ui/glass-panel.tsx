'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  intensity?: 'subtle' | 'medium' | 'strong'
  hover?: boolean
  glow?: boolean
}

const intensityMap = {
  subtle: 'glass',
  medium: 'glass',
  strong: 'glass-strong',
}

const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, intensity = 'medium', hover = false, glow = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          intensityMap[intensity],
          'rounded-2xl',
          hover && 'transition-colors duration-300 hover:bg-white/[0.08]',
          glow && 'shadow-[0_0_40px_rgba(99,102,241,0.08)]',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
GlassPanel.displayName = 'GlassPanel'

export { GlassPanel }
