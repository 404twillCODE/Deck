import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FloatingBackground } from '@/components/ui/floating-background'
import { ToastContainer } from '@/components/ui/toast-system'
import { AuthProvider } from '@/components/providers/auth-provider'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'FunDeck — Play Cards With Friends',
  description: 'Premium multiplayer card games. Poker, Blackjack, and more — beautifully crafted.',
  metadataBase: new URL('https://playdeck.app'),
  openGraph: {
    title: 'FunDeck — Play Cards With Friends',
    description: 'Premium multiplayer card games with friends.',
    siteName: 'FunDeck',
    type: 'website',
  },
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050507',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <FloatingBackground />
        <AuthProvider initialAuthUser={user}>
          {children}
        </AuthProvider>
        <ToastContainer />
      </body>
    </html>
  )
}
