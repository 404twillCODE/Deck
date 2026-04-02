'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export function ProtectedGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    if (user) return
    const fullPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : (pathname || '/')
    router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`)
  }, [isLoading, user, router, pathname])

  if (isLoading) return null
  if (!user) return null
  return <>{children}</>
}
