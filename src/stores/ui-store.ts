import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
}

interface UIStore {
  soundEnabled: boolean
  reducedMotion: boolean
  toasts: Toast[]
  
  toggleSound: () => void
  setReducedMotion: (reduced: boolean) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUIStore = create<UIStore>((set, get) => ({
  soundEnabled: true,
  reducedMotion: false,
  toasts: [],

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  
  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    const duration = toast.duration ?? 4000
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => get().removeToast(id), duration)
  },
  
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
