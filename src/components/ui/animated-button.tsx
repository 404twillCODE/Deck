'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface AnimatedButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: React.MouseEvent) => void
  title?: string
  href?: string
}

const styleVariants = {
  primary:
    'bg-accent text-white shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:brightness-110',
  secondary:
    'glass hover:bg-white/[0.08] text-text-primary',
  ghost:
    'bg-transparent hover:bg-white/[0.04] text-text-secondary hover:text-text-primary',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20',
}

const sizes = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-6 text-sm gap-2',
  lg: 'h-13 px-8 text-base gap-2.5',
}

const AnimatedButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, AnimatedButtonProps>(
  function AnimatedButton(
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      icon,
      children,
      disabled,
      type = 'button',
      onClick,
      title,
      href,
    },
    ref
  ) {
    const classes = cn(
      'relative inline-flex items-center justify-center font-medium rounded-xl',
      'transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
      'active:scale-[0.97] hover:scale-[1.02]',
      styleVariants[variant],
      sizes[size],
      disabled || loading ? 'opacity-40 pointer-events-none' : '',
      className
    )

    const content = (
      <>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </>
    )

    if (href) {
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          title={title}
          onClick={onClick}
        >
          {content}
        </Link>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={disabled || loading}
        type={type}
        onClick={onClick}
        title={title}
      >
        {content}
      </button>
    )
  }
)

export { AnimatedButton }
