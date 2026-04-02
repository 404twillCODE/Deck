'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export function ProtectedGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isGuest, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    if (user || isGuest) return
    const fullPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : (pathname || '/')
    router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`)
    router.refresh()
  }, [isLoading, user, isGuest, router, pathname])

  if (isLoading) return null
  if (!user && !isGuest) return null
  return <>{children}</>
}

