import axios from "axios";
import { expireStoredSession, storedSessionToken } from "@zolexora/marketplace-sign-in";
import { runtimeConfig } from "./runtime";
import { STOREFRONT_HEADER, type StorefrontKey } from "@zolexora/marketplace-shared-api/storefront";

export const STOREFRONT_KEY = "zolexora-shop" satisfies StorefrontKey;

export function applyStorefrontHeader(headers: { set?: (name: string, value: string) => void; [key: string]: unknown }) {
  if (typeof headers.set === "function") headers.set(STOREFRONT_HEADER, STOREFRONT_KEY);
  else headers[STOREFRONT_HEADER] = STOREFRONT_KEY;
  return headers;
}

// Base URL and token are resolved per request: the URL comes from the runtime config
// (Infisical), the token is the Zolexora auth-service session.
export const api = axios.create({ timeout: 20000 });

/** Marketplace profile of the signed-in user (GET /users/me). */
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  coin_balance?: number;
  phone_number?: string | null;
  picture?: string | null;
}

export interface Money {
  amount_minor: number;
  currency: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: Money;
  original_price?: Money | null;
  discount_percent?: number | null;
  category?: string;
  images?: string[];
  stock?: number;
  rating?: number;
  reviews_count?: number;
  seller_name?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: Product;
}

export interface OrderItem {
  product_id: string;
  image?: string;
  product_title: string;
  quantity: number;
  price: Money;
}

export interface Order {
  id: string;
  order_number?: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_paid?: number;
  grand_total?: { amount_minor: number; currency: string };
  subtotal?: number;
  coins_used?: number;
  coins_discount: number;
  items?: OrderItem[];
  lines?: any[];
  shipping_address?: any;
  created_at: string;
  upi_transaction_ref?: string;
  delivery_name?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  admin_note?: string;
}

export interface CoinBalance {
  coin_balance: number;
}

export interface CoinTransaction {
  id: string;
  amount: number;
  type: "earned" | "spent" | string;
  description: string;
  created_at: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount_percent: number;
  coins_spent: number;
  is_used: boolean;
  created_at: string;
}

export interface CheckoutRequest {
  coins_to_use?: number;
  payment_method: string;
  delivery_address?: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export type ProductListParams = {
  category?: string;
  search?: string;
  sort?: string;
  limit?: number;
  skip?: number;
};

api.interceptors.request.use((c) => {
  c.baseURL = runtimeConfig().apiUrl;
  const token = storedSessionToken();
  if (token) c.headers.set("Authorization", `Bearer ${token}`);
  applyStorefrontHeader(c.headers);
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401 && typeof window !== "undefined") expireStoredSession();
    return Promise.reject(e);
  }
);

/** Sign-in, sign-up and passwords belong to the Zolexora auth service (see app/auth). */
export const authApi = {
  me:     ()                                          => api.get<User>("/users/me").then(r => r.data),
  update: (data: { name?: string; picture?: string }) => api.put<User>("/users/me", data).then(r => r.data),
};

export const productsApi = {
  list: (p?: ProductListParams) => api.get<Product[]>("/products", { params: p }).then(r => r.data),
  get:  (id: string) => api.get<Product>(`/products/${id}`).then(r => r.data),
};

export const cartApi = {
  get:    ()                               => api.get<CartItem[]>("/cart").then(r => r.data),
  count:  ()                               => api.get("/cart/count").then(r => r.data),
  add:    (product_id: string, qty = 1)   => api.post("/cart/items", { product_id, quantity: qty }).then(r => r.data),
  update: (product_id: string, qty: number) => api.put(`/cart/items/${product_id}`, { quantity: qty }).then(r => r.data),
  remove: (product_id: string)             => api.delete(`/cart/items/${product_id}`).then(r => r.data),
  checkout: (d: CheckoutRequest)           => api.post("/cart/checkout", d).then(r => r.data),
  verifyRazorpay: (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) =>
    api.post("/cart/checkout/verify-payment", { razorpay_order_id, razorpay_payment_id, razorpay_signature }).then(r => r.data),
  verifyCashfree: (order_id: string) =>
    api.post("/cart/checkout/verify-cashfree", { order_id }).then(r => r.data),
  upiPaid: (order_id: string, upi_transaction_ref: string) =>
    api.post("/cart/checkout/upi-paid", { order_id, upi_transaction_ref }).then(r => r.data),
};

export const ordersApi = {
  my:  ()           => api.get<Order[]>("/orders/my").then(r => r.data),
  get: (id: string) => api.get(`/orders/${id}`).then(r => r.data),
};

export const coinsApi = {
  balance:   ()           => api.get<CoinBalance>("/coins/balance").then(r => r.data),
  history:   ()           => api.get<CoinTransaction[]>("/coins/history").then(r => r.data),
  discounts: ()           => api.get<DiscountCode[]>("/coins/discounts").then(r => r.data),
  generate:  (coins: number, product_id?: string) =>
    api.post("/coins/generate-discount", { coins_to_spend: coins, product_id }).then(r => r.data),
};

export interface Address {
  id: string;
  name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  house_no?: string;
  village_town?: string;
  landmark?: string;
  post_office?: string;
  district?: string;
  division?: string;
  region?: string;
  country?: string;
  postal_delivery_status?: string;
  digipin?: string;
  address_validation_status?: string;
  shipping_serviceability?: string;
  email?: string;
  created_at: string;
}

export interface PostOfficeInfo {
  name: string;
  delivery_status: string;
  circle?: string;
  district?: string;
  division?: string;
  region?: string;
  state?: string;
  country?: string;
}

export interface PincodeResult {
  pincode: string;
  country: string;
  state: string;
  region: string;
  division: string;
  district: string;
  post_offices: PostOfficeInfo[];
  postal_delivery_status: string;
}

export interface ShippingServiceabilityResult {
  serviceable: boolean;
  provider: string;
  estimated_delivery_days?: number;
  cod_available: boolean;
  message?: string;
}

export interface UserContacts {
  primary_email: string;
  is_email_verified: boolean;
  verified_emails: string[];
  primary_phone?: string | null;
  is_phone_verified: boolean;
  verified_phones: string[];
}

export interface UserProfileDetails {
  id: string;
  name: string;
  role: string;
  picture?: string | null;
  coin_balance: number;
  created_at: string;
  contacts: UserContacts;
  addresses: Address[];
}

export const usersApi = {
  getProfile: () => api.get<UserProfileDetails>("/users/me/profile").then(r => r.data),
  getAddresses: () => api.get<Address[]>("/users/me/addresses").then(r => r.data),
  addAddress: (data: Partial<Address>) => api.post<Address>("/users/me/addresses", data).then(r => r.data),
  updateAddress: (id: string, data: Partial<Address>) => api.put<Address>(`/users/me/addresses/${id}`, data).then(r => r.data),
  lookupPincode: (pincode: string) => api.get<PincodeResult>(`/users/me/addresses/pincode-lookup?pincode=${pincode}`).then(r => r.data),
  checkServiceability: (pincode: string) => api.post<ShippingServiceabilityResult>("/users/me/addresses/check-serviceability", { pincode }).then(r => r.data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}`).then(r => r.data),
};
