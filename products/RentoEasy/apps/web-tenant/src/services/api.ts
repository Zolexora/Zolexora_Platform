import axios, { AxiosError } from 'axios'
import { useAuthStore }       from '@/store/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4020'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = []

api.interceptors.response.use(
  (res) => res.data?.data ?? res.data, // unwrap { success, data }
  async (error: AxiosError) => {
    const original = error.config as any

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry   = true
      isRefreshing      = true
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        useAuthStore.getState().logout()
        return Promise.reject(error)
      }

      try {
        const res = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = res.data?.data ?? res.data

        localStorage.setItem('access_token',  accessToken)
        localStorage.setItem('refresh_token', newRefresh)

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
        failedQueue.forEach((q) => q.resolve(accessToken))
        failedQueue = []

        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        failedQueue.forEach((q) => q.reject(error))
        failedQueue = []
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    // Unwrap error message
    const msg = (error.response?.data as any)?.message ?? error.message
    return Promise.reject(new Error(Array.isArray(msg) ? msg[0] : msg))
  },
)

// ─── API METHODS ──────────────────────────────────────────────────────────────

export const authAPI = {
  sendOTP:    (phone: string, role: string) => api.post('/auth/send-otp', { phone, role }),
  verifyOTP:  (phone: string, otp: string, role: string, name?: string, googleIdToken?: string, email?: string, profilePhoto?: string, password?: string) =>
                api.post('/auth/verify-otp', { phone, otp, role, name, googleIdToken, email, profilePhoto, password }),
  emailLogin: (email: string, password: string) => api.post('/auth/email/login', { email, password, role: 'tenant' }),
  setPassword: (password: string) => api.post('/auth/set-password', { password }),
  logout:     (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
  me:         () => api.get('/auth/me'),
}

export const propertiesAPI = {
  search:     (params: Record<string, any>) => api.get('/properties', { params }),
  mapPins:    (lat: number, lng: number, radiusKm = 10) =>
                api.get('/properties/map-pins', { params: { lat, lng, radiusKm } }),
  getOne:     (id: string) => api.get(`/properties/${id}`),
  amenities:  () => api.get('/properties/amenities'),
}

export const bookingsAPI = {
  create:       (data: any)             => api.post('/bookings', data),
  myBookings:   (params?: any)          => api.get('/bookings/tenant/my-bookings', { params }),
  getOne:       (id: string)            => api.get(`/bookings/${id}`),
  cancel:       (id: string, reason?: string) => api.patch(`/bookings/${id}/cancel`, { reason }),
  getSigningUrl:(id: string)            => api.get(`/bookings/${id}/signing-url`),
}

export const paymentsAPI = {
  getDue:       ()                      => api.get('/payments/due'),
  history:      (page = 1)              => api.get('/payments/history', { params: { page } }),
  createOrder:  (data: any)             => api.post('/payments/order', data),
  verify:       (data: any)             => api.post('/payments/verify', data),
  setupAutoPay: (data: any)             => api.post('/payments/auto-pay/setup', data),
}

export const kycAPI = {
  getStatus:    ()                      => api.get('/kyc/status'),
  uploadAadhaar:(file: File)            => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/kyc/aadhaar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  retryAadhaar: (file: File, nameOnAadhaar: string, birthYear: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('nameOnAadhaar', nameOnAadhaar)
    form.append('birthYear', birthYear)
    return api.post('/kyc/aadhaar/retry', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const chatAPI = {
  getRooms:     ()                      => api.get('/chat/rooms'),
  getMessages:  (roomId: string, page = 1) =>
                  api.get(`/chat/rooms/${roomId}/messages`, { params: { page } }),
}

export const usersAPI = {
  updateProfile:(data: any)             => api.patch('/users/me/tenant', data),
  uploadPhoto:  (file: File)            => {
    const form = new FormData()
    form.append('photo', file)
    return api.post('/users/me/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  updateFCM:    (fcmToken: string)      => api.patch('/users/me/fcm-token', { fcmToken }),
  updateDevice: (data: any)             => api.patch('/users/me/device', data),
}

export const maintenanceAPI = {
  create:  (data: any)  => api.post('/maintenance', data),
  myList:  (params: any) => api.get('/maintenance/tenant/my-requests', { params }),
  getOne:  (id: string) => api.get(`/maintenance/${id}`),
}

export const notificationsAPI = {
  list:       (page = 1)  => api.get('/notifications', { params: { page } }),
  markRead:   (id?: string) => id
    ? api.patch(`/notifications/${id}/read`)
    : api.patch('/notifications/read'),
}
