'use client'

import { ProtectedGate } from '@/components/providers/protected-gate'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedGate>{children}</ProtectedGate>
}
