import { create }    from 'zustand'
import { persist }   from 'zustand/middleware'

export interface TenantUser {
  id:           string
  phone:        string
  name:         string
  role:         'tenant'
  profilePhoto: string | null
  kycStatus:    string
  email?:       string
  city?:        string
  permanentAddress?: string
  aadhaarVerified:   boolean
}

interface AuthState {
  user:            TenantUser | null
  isAuthenticated: boolean
  isLoading:       boolean
  setAuth:         (user: TenantUser, accessToken: string, refreshToken: string) => void
  updateUser:      (patch: Partial<TenantUser>) => void
  logout:          () => void
  setLoading:      (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      isAuthenticated: false,
      isLoading:       false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token',  accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, isAuthenticated: true })
      },

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : null })),

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false })
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name:       'ras-tenant-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
