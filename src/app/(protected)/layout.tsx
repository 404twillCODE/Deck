'use client'

import { AuthProvider } from '@/components/providers/auth-provider'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
