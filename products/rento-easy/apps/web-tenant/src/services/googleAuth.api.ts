import { api } from './api'

export const googleAuthAPI = {
  // Exchange Firebase ID token for our JWT tokens
  loginWithGoogle: (idToken: string, name?: string) =>
    api.post('/auth/google', { idToken, name, role: 'tenant' }),
}
