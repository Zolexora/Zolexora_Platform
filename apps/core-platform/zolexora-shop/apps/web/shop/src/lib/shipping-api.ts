import { api } from "./api";

export const shippingApi = {
  getOrderShipment: (orderId: string) => api.get(`/shipping/orders/${orderId}/options`).then(r => r.data),
  getShipment: (id: string) => api.get(`/shipping/shipments/${id}`).then(r => r.data),
  trackByAwb: (awb: string) => api.get(`/shipping/track/${awb}`).then(r => r.data),
  syncShipment: (id: string) => api.post(`/shipping/sync/${id}`).then(r => r.data),
};
