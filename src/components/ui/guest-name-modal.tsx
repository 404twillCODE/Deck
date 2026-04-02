'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GlassPanel } from './glass-panel'
import { PremiumInput } from './premium-input'
import { AnimatedButton } from './animated-button'

export function GuestNameModal({
  open,
  onClose,
  onConfirm,
  title = 'Play as guest',
  description = 'Enter a name so other players know who you are.',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (name: string) => void
  title?: string
  description?: string
}) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)

  const error = useMemo(() => {
    if (!touched) return undefined
    const v = name.trim()
    if (!v) return 'Name is required'
    if (v.length < 2) return 'At least 2 characters'
    if (v.length > 16) return 'Max 16 characters'
    return undefined
  }, [name, touched])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-sm"
          >
            <GlassPanel className="p-5 rounded-2xl">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-text-primary">{title}</h3>
                <p className="text-sm text-text-secondary mt-1">{description}</p>
              </div>

              <PremiumInput
                label="Guest name"
                placeholder="e.g. Beetogle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                error={error}
                maxLength={16}
              />

              <div className="flex gap-3 mt-4">
                <AnimatedButton
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </AnimatedButton>
                <AnimatedButton
                  className="flex-1"
                  onClick={() => {
                    setTouched(true)
                    const v = name.trim()
                    if (!v || v.length < 2 || v.length > 16) return
                    onConfirm(v)
                  }}
                >
                  Continue
                </AnimatedButton>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

