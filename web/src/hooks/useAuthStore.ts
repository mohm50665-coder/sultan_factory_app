import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  department?: string
  allowedSections?: string[]
  toolPermissions?: Record<string, boolean>
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,

      login: async (email: string, password: string) => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
          })

          if (!response.ok) throw new Error('فشل تسجيل الدخول')

          const data = await response.json()
          set({ user: data.user })
          localStorage.setItem('session_id', data.sessionId)
        } catch (error) {
          console.error('Login error:', error)
          throw error
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
          })
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({ user: null })
          localStorage.removeItem('session_id')
        }
      },

      refreshUser: async () => {
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          })

          if (response.ok) {
            const data = await response.json()
            set({ user: data })
          } else {
            set({ user: null })
          }
        } catch (error) {
          console.error('Refresh user error:', error)
          set({ user: null })
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
)

// Initialize on mount
if (typeof window !== 'undefined') {
  useAuthStore.getState().refreshUser()
}
