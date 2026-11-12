import axios, { AxiosError } from 'axios'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4020') + '/api/v1'

export const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('ras_admin_access')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

api.interceptors.response.use(
  (r) => r.data?.data ?? r.data,
  (e: AxiosError) => {
    if (e.response?.status === 401) { localStorage.removeItem('ras_admin_access'); window.location.href = '/login' }
    const msg = (e.response?.data as any)?.message ?? e.message
    return Promise.reject(new Error(Array.isArray(msg) ? msg[0] : msg))
  },
)

export const authAPI = {
  emailLogin: (email: string, password: string) => api.post('/auth/email/login', { email, password, role: 'admin' }),
  me:        () => api.get('/auth/me'),
  logout:    () => api.post('/auth/logout'),
}

export const adminAPI = {
  dashboard:    () => api.get('/admin/dashboard'),
  cityStats:    () => api.get('/admin/city-stats'),
  auditLogs:    (page = 1) => api.get('/admin/audit-logs', { params: { page } }),
  getConfig:    () => api.get('/admin/config'),
  updateConfig: (data: any) => api.patch('/admin/config', data),
  payoutQueue:  (page = 1) => api.get('/admin/payout-queue', { params: { page } }),
  triggerPayout:(paymentId: string) => api.post('/payments/admin/payout', { paymentId }),
  refund:       (data: any) => api.post('/payments/admin/refund', data),
  paymentOverview: () => api.get('/payments/admin/overview'),
}

export const usersAPI = {
  list:         (params: any) => api.get('/users', { params }),
  getOne:       (id: string)  => api.get(`/users/${id}`),
  toggleStatus: (id: string, isActive: boolean, reason?: string) =>
                  api.patch(`/users/${id}/status`, { isActive, reason }),
}

export const kycAPI = {
  queue:        (status = 'submitted', page = 1) => api.get('/kyc/admin/queue', { params: { status, page } }),
  updateStatus: (docId: string, status: string, reason?: string) =>
                  api.patch(`/kyc/admin/${docId}`, { status, reason }),
}

export const propertiesAPI = {
  list:         (params: any) => api.get('/properties/admin/all', { params }),
  updateStatus: (id: string, status: string, reason?: string) =>
                  api.patch(`/properties/admin/${id}/status`, { status, reason }),
}
