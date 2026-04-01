import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FloatingBackground } from '@/components/ui/floating-background'
import { ToastContainer } from '@/components/ui/toast-system'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Deck — Play Cards With Friends',
  description: 'Premium multiplayer card games. Poker, Blackjack, and more — beautifully crafted.',
  metadataBase: new URL('https://playdeck.app'),
  openGraph: {
    title: 'Deck — Play Cards With Friends',
    description: 'Premium multiplayer card games with friends.',
    siteName: 'Deck',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <FloatingBackground />
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}
