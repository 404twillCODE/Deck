'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PremiumInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const PremiumInput = forwardRef<HTMLInputElement, PremiumInputProps>(
  ({ className, label, error, icon, type, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-text-secondary pl-1">
            {label}
          </label>
        )}
        <motion.div
          className={cn(
            'relative flex items-center rounded-xl',
            'bg-white/[0.03] border transition-all duration-300',
            focused
              ? 'border-accent/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
              : 'border-white/[0.06] hover:border-white/[0.1]',
            error && 'border-danger/50'
          )}
          animate={{
            borderColor: error
              ? 'rgba(248, 113, 113, 0.5)'
              : focused
                ? 'rgba(99, 102, 241, 0.5)'
                : 'rgba(255, 255, 255, 0.06)',
          }}
          transition={{ duration: 0.2 }}
        >
          {icon && (
            <span className="pl-4 text-text-tertiary">{icon}</span>
          )}
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            className={cn(
              'w-full bg-transparent px-4 py-3 text-sm text-text-primary',
              'placeholder:text-text-tertiary',
              'focus:outline-none',
              icon && 'pl-2',
              isPassword && 'pr-12',
              className
            )}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              className="absolute right-3 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </motion.div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-danger pl-1"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)
PremiumInput.displayName = 'PremiumInput'

export { PremiumInput }
