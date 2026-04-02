'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AuthCard, AnimatedButton, PremiumInput, DeckLogo } from '@/components/ui'
import { useUIStore } from '@/stores/ui-store'
import { Mail, Lock, Wand2 } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const urlError = searchParams.get('error')
  const { addToast } = useUIStore()

  useEffect(() => {
    if (urlError) {
      addToast({ type: 'error', title: 'Authentication failed', message: 'Please sign in again.' })
    }
  }, [urlError, addToast])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    console.log('[login] signInWithPassword →', error ? `error: ${error.message}` : `user: ${data.user?.id}`)

    if (error) {
      let message = error.message
      if (message.toLowerCase().includes('email not confirmed')) {
        message = 'Your email is not confirmed yet. Check your inbox for the confirmation link.'
      } else if (message.toLowerCase().includes('invalid login credentials')) {
        message = 'Wrong email or password. Double-check and try again.'
      }
      addToast({ type: 'error', title: 'Sign in failed', message })
      setLoading(false)
      return
    }

    addToast({ type: 'success', title: 'Welcome back!' })
    router.replace(redirect)
    router.refresh()
  }

  async function handleMagicLink() {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: 'Enter your email first' })
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}` },
    })

    setLoading(false)

    if (error) {
      addToast({ type: 'error', title: 'Failed to send magic link', message: error.message })
      return
    }

    setMagicLinkSent(true)
    addToast({ type: 'success', title: 'Magic link sent!', message: 'Check your email' })
  }

  return (
    <AuthCard>
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <DeckLogo size="lg" />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome back</h1>
        <p className="text-sm text-text-secondary">Sign in to join your table</p>
      </div>

      {magicLinkSent ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-7 w-7 text-accent-light" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Check your email</h3>
          <p className="text-sm text-text-secondary mb-6">
            We sent a magic link to <strong className="text-text-primary">{email}</strong>
          </p>
          <button
            onClick={() => setMagicLinkSent(false)}
            className="text-sm text-accent-light hover:underline"
          >
            Use password instead
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <PremiumInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            icon={<Mail className="h-4 w-4" />}
            autoComplete="email"
          />
          <PremiumInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            icon={<Lock className="h-4 w-4" />}
            autoComplete="current-password"
          />

          <div className="pt-2 space-y-3">
            <AnimatedButton type="submit" loading={loading} className="w-full">
              Sign In
            </AnimatedButton>

            <AnimatedButton
              type="button"
              variant="ghost"
              className="w-full"
              icon={<Wand2 className="h-4 w-4" />}
              onClick={handleMagicLink}
              disabled={loading}
            >
              Send Magic Link
            </AnimatedButton>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-text-secondary mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent-light hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
