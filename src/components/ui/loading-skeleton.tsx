'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white/[0.04] animate-shimmer',
        className
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto aspect-[16/10] glass rounded-3xl p-8 flex items-center justify-center">
      <div className="space-y-4 w-full max-w-xs">
        <Skeleton className="h-6 w-32 mx-auto" />
        <div className="flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="w-12 h-[4.5rem] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  )
}
