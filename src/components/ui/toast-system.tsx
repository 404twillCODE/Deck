'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-accent-light" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
}

const borderColors = {
  success: 'border-l-success/50',
  error: 'border-l-danger/50',
  info: 'border-l-accent/50',
  warning: 'border-l-warning/50',
}

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'glass-strong rounded-xl p-4 pointer-events-auto cursor-pointer',
              'border-l-2',
              borderColors[toast.type]
            )}
            onClick={() => removeToast(toast.id)}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5">{icons[toast.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-text-secondary mt-0.5">{toast.message}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
                className="flex-shrink-0 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
