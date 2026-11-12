import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4020'

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Extract error message
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message ?? err.message ?? 'Network error'
    return Promise.reject(new Error(Array.isArray(msg) ? msg[0] : msg))
  },
)

export const emailAuthAPI = {
  login: (email: string, password: string, role: 'owner' | 'admin') =>
    api.post('/auth/email/login', { email, password, role }),

  register: (email: string, password: string, name: string, role: 'owner' = 'owner') =>
    api.post('/auth/email/register', { email, password, name, role }),
}
