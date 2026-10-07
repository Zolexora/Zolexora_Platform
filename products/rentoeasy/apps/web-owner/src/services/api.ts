import axios, { AxiosError } from 'axios'
import { useAuthStore }       from '@/store/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ras_owner_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let queue: any[] = []

api.interceptors.response.use(
  (res) => res.data?.data ?? res.data,
  async (error: AxiosError) => {
    const orig = error.config as any
    if (error.response?.status === 401 && !orig._retry) {
      if (isRefreshing) {
        return new Promise((res, rej) => queue.push({ res, rej }))
          .then((t) => { orig.headers.Authorization = `Bearer ${t}`; return api(orig) })
      }
      orig._retry = true; isRefreshing = true
      const rt = localStorage.getItem('ras_owner_refresh')
      if (!rt) { useAuthStore.getState().logout(); return Promise.reject(error) }
      try {
        const r = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken: rt })
        const { accessToken, refreshToken: nr } = r.data?.data ?? r.data
        localStorage.setItem('ras_owner_access', accessToken)
        localStorage.setItem('ras_owner_refresh', nr)
        queue.forEach((q) => q.res(accessToken)); queue = []
        orig.headers.Authorization = `Bearer ${accessToken}`
        return api(orig)
      } catch { queue.forEach((q) => q.rej(error)); queue = []; useAuthStore.getState().logout(); window.location.href = '/login'; return Promise.reject(error) }
      finally { isRefreshing = false }
    }
    const msg = (error.response?.data as any)?.message ?? error.message
    return Promise.reject(new Error(Array.isArray(msg) ? msg[0] : msg))
  },
)

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  sendOTP:      (phone: string) => api.post('/auth/send-otp', { phone, role: 'owner' }),
  verifyOTP:    (phone: string, otp: string, name?: string, googleIdToken?: string, email?: string, profilePhoto?: string, password?: string) =>
                  api.post('/auth/verify-otp', { phone, otp, role: 'owner', name, googleIdToken, email, profilePhoto, password }),
  emailLogin:   (email: string, password: string) =>
                  api.post('/auth/email/login', { email, password, role: 'owner' }),
  google:       (idToken: string, name?: string) =>
                  api.post('/auth/google', { idToken, role: 'owner', name }),
  setPassword:  (password: string) => api.post('/auth/set-password', { password }),
  logout:       (rt?: string)  => api.post('/auth/logout', { refreshToken: rt }),
  me:           ()             => api.get('/auth/me'),
}

// ─── KYC ──────────────────────────────────────────────────────────────────────
export const kycAPI = {
  getStatus:   () => api.get('/kyc/status'),
  uploadAadhaar: (file: File) => {
    const f = new FormData(); f.append('file', file)
    return api.post('/kyc/aadhaar', f, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  retryAadhaar: (file: File, nameOnAadhaar: string, birthYear: string) => {
    const f = new FormData(); f.append('file', file)
    f.append('nameOnAadhaar', nameOnAadhaar); f.append('birthYear', birthYear)
    return api.post('/kyc/aadhaar/retry', f, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  verifyPAN:  (panNumber: string) => api.post('/kyc/pan', { panNumber }),
  verifyBank: (accountNumber: string, ifsc: string) =>
                api.post('/kyc/bank', { accountNumber, ifsc }),
}

// ─── PROPERTIES ───────────────────────────────────────────────────────────────
export const propertiesAPI = {
  myListings:  (params?: any) => api.get('/properties/owner/my-listings', { params }),
  getOne:      (id: string)   => api.get(`/properties/${id}`),
  create:      (data: any)    => api.post('/properties', data),
  update:      (id: string, data: any) => api.patch(`/properties/${id}`, data),
  updateStatus:(id: string, status: string) => api.patch(`/properties/${id}/status`, { status }),
  delete:      (id: string)   => api.delete(`/properties/${id}`),
  addPhoto:    (id: string, file: File) => {
    const f = new FormData(); f.append('photo', file)
    return api.post(`/properties/${id}/photos`, f, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deletePhoto:    (id: string, photoId: string) => api.delete(`/properties/${id}/photos/${photoId}`),
  setPrimary:     (id: string, photoId: string) => api.patch(`/properties/${id}/photos/${photoId}/primary`),
  reorderPhotos:  (id: string, photoIds: string[]) => api.patch(`/properties/${id}/photos/reorder`, { photoIds }),
  amenities:      () => api.get('/properties/amenities'),
}

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────
export const bookingsAPI = {
  myBookings:      (params?: any) => api.get('/bookings/owner/my-bookings', { params }),
  getOne:          (id: string)   => api.get(`/bookings/${id}`),
  respond:         (id: string, action: 'accepted' | 'rejected', reason?: string) =>
                     api.patch(`/bookings/${id}/respond`, { action, reason }),
  getPoliceForm:   (id: string)   => api.get(`/bookings/${id}/police-verification`),
  updatePolice:    (id: string, status: string) =>
                     api.patch(`/bookings/${id}/police-verification`, { status }),
  generateAgreement: (id: string) => api.post(`/bookings/${id}/agreement/generate`),
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const paymentsAPI = {
  earnings: () => api.get('/payments/earnings'),
  history:  (page = 1) => api.get('/payments/owner/history', { params: { page } }),
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getRooms:    () => api.get('/chat/rooms'),
  getMessages: (roomId: string, page = 1) =>
                 api.get(`/chat/rooms/${roomId}/messages`, { params: { page } }),
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  updateProfile: (data: any) => api.patch('/users/me/owner', data),
  uploadPhoto:   (file: File) => {
    const f = new FormData(); f.append('photo', file)
    return api.post('/users/me/photo', f, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const maintenanceAPI = {
  ownerList:    (params?: any)  => api.get('/maintenance/owner/requests', { params }),
  update:       (id: string, data: any) => api.patch(`/maintenance/${id}`, data),
}
