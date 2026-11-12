import axios from "axios";
import { clearSessionToken, mobileConfig, sessionToken } from "@zolexora/shop-mobile-sign-in";
import { STOREFRONT_HEADER } from "@zolexora/shop-shared-api/storefront";
import { STOREFRONT_KEY, validateStorefrontKey } from "../config/storefront";

validateStorefrontKey();

export const api = axios.create({ timeout: 20000 });

export function applyStorefrontHeader(headers: { set?: (name: string, value: string) => void; [key: string]: unknown }) {
  if (typeof headers.set === "function") headers.set(STOREFRONT_HEADER, STOREFRONT_KEY);
  else headers[STOREFRONT_HEADER] = STOREFRONT_KEY;
  return headers;
}

// Every request carries the Zolexora auth-service session token; the API URL comes from Infisical.
api.interceptors.request.use(async (config) => {
  config.baseURL = mobileConfig().apiUrl;
  const token = await sessionToken();
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  if (config.headers) applyStorefrontHeader(config.headers);
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) await clearSessionToken();
    return Promise.reject(error);
  },
);

/** Marketplace profile of the signed-in account; sign-in itself is the auth service. */
export const authApi = {
  me:     () => api.get("/users/me").then(r => r.data),
  update: (data: { name?: string }) => api.put("/users/me", data).then(r => r.data),
};

export const productsApi = {
  list: (params?: any) => api.get("/products", { params }).then(r => r.data),
  get:  (id: string)   => api.get(`/products/${id}`).then(r => r.data),
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
