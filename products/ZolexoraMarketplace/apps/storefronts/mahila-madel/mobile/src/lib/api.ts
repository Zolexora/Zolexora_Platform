import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { STOREFRONT_HEADER } from "@zolexora/shared-api/storefront";
import { STOREFRONT_KEY, validateStorefrontKey } from "../config/storefront";

validateStorefrontKey();

function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (__DEV__) return "http://localhost:4100/api";
  throw new Error("EXPO_PUBLIC_API_URL is required for production builds.");
}

const BASE = resolveApiBaseUrl();

export const api = axios.create({ baseURL: BASE, timeout: 20000, headers: { "X-Session-Transport": "native" } });

export function applyStorefrontHeader(headers: { set?: (name: string, value: string) => void; [key: string]: unknown }) {
  if (typeof headers.set === "function") headers.set(STOREFRONT_HEADER, STOREFRONT_KEY);
  else headers[STOREFRONT_HEADER] = STOREFRONT_KEY;
  return headers;
}

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("z_token");
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  if (config.headers) applyStorefrontHeader(config.headers);
  return config;
});

export const authApi = {
  register:       (d: any)                                  => api.post("/auth/register", d).then(r => r.data),
  login:          (email: string, password: string)         => api.post("/auth/login", { email, password }).then(r => r.data),
  verifyOtp:      (email: string, otp: string)               => api.post("/auth/verify-register", { email, otp }).then(r => r.data),
  forgotPassword: (email: string)                           => api.post("/auth/forgot-password", { email }).then(r => r.data),
  resetPassword:  (token: string, new_password: string)     => api.post("/auth/reset-password", { token, new_password }).then(r => r.data),
  me:             ()                                        => api.get("/auth/me").then(r => r.data),
  logout:         ()                                        => api.post("/auth/logout").then(r => r.data),
};

export const productsApi = {
  list: (params?: any) => api.get("/products", { params }).then(r => r.data),
  get:  (id: string)   => api.get(`/products/${id}`).then(r => r.data),
};

export const reelsApi = {
  list: (params?: any) => api.get("/reels", { params }).then(r => r.data),
  view: (id: string)   => api.post(`/reels/${id}/view`).then(r => r.data),
};

export const cartApi = {
  get:    ()                                 => api.get("/cart").then(r => r.data),
  count:  ()                                 => api.get("/cart/count").then(r => r.data),
  add:    (product_id: string, quantity = 1) => api.post("/cart/items", { product_id, quantity }).then(r => r.data),
  update: (product_id: string, quantity: number) =>
    api.put(`/cart/items/${product_id}`, null, { params: { quantity } }).then(r => r.data),
  remove: (product_id: string) => api.delete(`/cart/items/${product_id}`).then(r => r.data),
  checkout: (d: any)           => api.post("/cart/checkout", d).then(r => r.data),
  verifyRazorpay: (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) =>
    api.post("/cart/checkout/verify-payment", { razorpay_order_id, razorpay_payment_id, razorpay_signature }).then(r => r.data),
  upiPaid: (order_id: string, upi_transaction_ref: string) =>
    api.post("/cart/checkout/upi-paid", { order_id, upi_transaction_ref }).then(r => r.data),
};

export const ordersApi = {
  my:  ()           => api.get("/orders/my").then(r => r.data),
  get: (id: string) => api.get(`/orders/${id}`).then(r => r.data),
};

export const coinsApi = {
  balance:   ()           => api.get("/coins/balance").then(r => r.data),
  history:   ()           => api.get("/coins/history").then(r => r.data),
  discounts: ()           => api.get("/coins/discounts").then(r => r.data),
  generate:  (coins: number, product_id?: string) =>
    api.post("/coins/generate-discount", { coins_to_spend: coins, product_id }).then(r => r.data),
};
