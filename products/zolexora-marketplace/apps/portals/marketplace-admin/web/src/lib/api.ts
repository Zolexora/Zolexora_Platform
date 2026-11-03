import axios from "axios";
import { expireStoredSession, storedSessionToken } from "@zolexora/marketplace-sign-in";
import { runtimeConfig } from "./runtime";

export const api = axios.create({ timeout: 15000 });
api.interceptors.request.use((c) => {
  c.baseURL = runtimeConfig().apiUrl;
  const token = storedSessionToken();
  if (token) c.headers.set("Authorization", `Bearer ${token}`);
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) expireStoredSession();
    return Promise.reject(e);
  }
);

export const adminApi = {
  stats:          () => api.get("/admin/stats").then(r=>r.data),
  analytics:      () => api.get("/admin/analytics").then(r=>r.data),
  users:          () => api.get("/admin/users", { params: { limit: 1000 } }).then(r=>r.data.items ?? r.data),
  setUserRole:    (uid:string,role:string) => api.put(`/admin/users/${uid}/role`,null,{params:{role}}).then(r=>r.data),
  toggleUser:     (uid:string) => api.put(`/admin/users/${uid}/toggle`).then(r=>r.data),
  products:       () => api.get("/admin/products").then(r=>r.data),
  toggleProduct:  (pid:string) => api.put(`/admin/products/${pid}/toggle`).then(r=>r.data),
  deleteProduct:  (pid:string) => api.delete(`/admin/products/${pid}`).then(r=>r.data),
  reels:          () => api.get("/admin/reels").then(r=>r.data),
  toggleReel:     (rid:string) => api.put(`/admin/reels/${rid}/toggle`).then(r=>r.data),
  deleteReel:     (rid:string) => api.delete(`/admin/reels/${rid}`).then(r=>r.data),
  orders:         () => api.get("/admin/orders").then(r=>r.data),
  pendingUpi:     () => api.get("/admin/orders/pending-upi").then(r=>r.data),
  verifyUpi:      (order_id:string,approve:boolean,admin_note?:string) =>
    api.put(`/admin/orders/${order_id}/verify-upi`,{approve,admin_note}).then(r=>r.data),
};

export const adminCatalogApi = {
  list:       () => api.get("/admin/catalog/listings").then(r=>r.data),
  get:        (id:string) => api.get(`/admin/catalog/listings/${id}`).then(r=>r.data),
  inventory:  (id:string) => api.get(`/admin/catalog/listings/${id}/inventory`).then(r=>r.data),
  moderate:   (id:string,action:"approve"|"reject",reason?:string) =>
    api.put(`/admin/catalog/listings/${id}/moderation`,{action,reason}).then(r=>r.data),
};
