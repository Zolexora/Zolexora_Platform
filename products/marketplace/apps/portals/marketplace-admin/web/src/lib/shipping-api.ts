import { api } from "./api";

export const shippingApi = {
  stats: () => api.get("/shipping/admin/shipments/stats").then(r => r.data),
  all: () => api.get("/shipping/admin/shipments").then(r => r.data),
  attentionRequired: () => api.get("/shipping/admin/shipments/attention-required").then(r => r.data),
  getShipment: (id: string) => api.get(`/shipping/shipments/${id}`).then(r => r.data),
  syncTracking: (id: string) => api.post(`/shipping/sync/${id}`).then(r => r.data),
  retryBooking: (id: string) => api.post(`/shipping/shipments/${id}/retry-booking`).then(r => r.data),
  cancelShipment: (id: string) => api.post(`/shipping/shipments/${id}/cancel`).then(r => r.data),
  trackByAwb: (awb: string) => api.get(`/shipping/track/${awb}`).then(r => r.data),
};
