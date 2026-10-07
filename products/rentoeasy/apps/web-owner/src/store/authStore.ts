import { create }  from 'zustand'
import { persist } from 'zustand/middleware'

export interface OwnerUser {
  id: string; phone: string; name: string; role: 'owner'
  profilePhoto: string | null; kycStatus: string
  aadhaarVerified: boolean; panVerified: boolean; bankVerified: boolean
  email?: string; bankAccountName?: string; bankAccountMasked?: string; bankIfsc?: string
}

interface AuthState {
  user: OwnerUser | null; isAuthenticated: boolean
  setAuth:    (user: OwnerUser, access: string, refresh: string) => void
  updateUser: (patch: Partial<OwnerUser>) => void
  logout:     () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, isAuthenticated: false,
      setAuth: (user, access, refresh) => {
        localStorage.setItem('ras_owner_access',  access)
        localStorage.setItem('ras_owner_refresh', refresh)
        set({ user, isAuthenticated: true })
      },
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),
      logout: () => {
        localStorage.removeItem('ras_owner_access')
        localStorage.removeItem('ras_owner_refresh')
        set({ user: null, isAuthenticated: false })
      },
    }),
    { name: 'ras-owner-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) },
  ),
)
