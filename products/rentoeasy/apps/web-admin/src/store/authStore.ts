import { create }  from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUser { id: string; phone: string; name: string; role: 'admin' }

interface AuthState {
  user: AdminUser | null; isAuthenticated: boolean
  setAuth:  (user: AdminUser, access: string) => void
  logout:   () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, isAuthenticated: false,
      setAuth: (user, access) => {
        localStorage.setItem('ras_admin_access', access)
        set({ user, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('ras_admin_access')
        set({ user: null, isAuthenticated: false })
      },
    }),
    { name: 'ras-admin-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) },
  ),
)
