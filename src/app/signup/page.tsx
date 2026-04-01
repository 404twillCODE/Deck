'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AuthCard, AnimatedButton, PremiumInput, DeckLogo } from '@/components/ui'
import { useUIStore } from '@/stores/ui-store'
import { Mail, Lock, User, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const { addToast } = useUIStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (!displayName.trim()) e.displayName = 'Display name is required'
    else if (displayName.trim().length < 2) e.displayName = 'At least 2 characters'
    if (!email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'At least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      addToast({ type: 'error', title: 'Signup failed', message: error.message })
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      setSuccess(true)
    } else {
      addToast({ type: 'success', title: 'Account created!' })
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <AuthCard>
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <DeckLogo size="lg" />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Create your account</h1>
        <p className="text-sm text-text-secondary">Start playing in seconds</p>
      </div>

      {success ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Check your email</h3>
          <p className="text-sm text-text-secondary">
            We sent a confirmation link to <strong className="text-text-primary">{email}</strong>
          </p>
        </motion.div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4">
          <PremiumInput
            label="Display Name"
            type="text"
            placeholder="How others see you"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            icon={<User className="h-4 w-4" />}
            autoComplete="name"
          />
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
            autoComplete="new-password"
          />

          <div className="pt-2">
            <AnimatedButton type="submit" loading={loading} className="w-full">
              Create Account
            </AnimatedButton>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-text-secondary mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-accent-light hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
