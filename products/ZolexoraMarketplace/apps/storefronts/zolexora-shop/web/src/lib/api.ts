import axios from "axios";
import { STOREFRONT_HEADER, type StorefrontKey } from "@zolexora/shared-api/storefront";

export const STOREFRONT_KEY = "zolexora-shop" satisfies StorefrontKey;

export function applyStorefrontHeader(headers: { set?: (name: string, value: string) => void; [key: string]: unknown }) {
  if (typeof headers.set === "function") headers.set(STOREFRONT_HEADER, STOREFRONT_KEY);
  else headers[STOREFRONT_HEADER] = STOREFRONT_KEY;
  return headers;
}

function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  if (process.env.NODE_ENV !== "production") {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    if (hostname.endsWith(".github.dev") || hostname.endsWith(".app.github.dev")) {
      const apiHost = hostname.replace(/-300[0-9]/, "-8000");
      return `https://${apiHost}/api`;
    }
    return `http://${hostname}:8000/api`;
  }
  throw new Error("NEXT_PUBLIC_API_URL is required for production builds.");
}

const BASE = resolveApiBaseUrl();

export const api = axios.create({ baseURL: BASE, timeout: 20000, withCredentials: true });

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  coin_balance?: number;
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

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
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
  const csrf = typeof document === "undefined" ? undefined : document.cookie.match(/(?:^|; )z_csrf=([^;]*)/)?.[1];
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(c.method?.toUpperCase() || "")) c.headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  if (c.headers) applyStorefrontHeader(c.headers);
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("z:logout"));
    }
    return Promise.reject(e);
  }
);

export const authApi = {
  register:       (d: RegisterRequest)          => api.post("/auth/register", d).then(r => r.data),
  resendOtp:      (email: string)               => api.post("/auth/resend-otp-body", { email }).then(r => r.data),
  verifyOtp:      (email: string, otp: string)  => api.post("/auth/verify-register", { email, otp }).then(r => r.data),
  login:          (email: string, pass: string) => api.post("/auth/login", { email, password: pass }).then(r => r.data),
  loginPhone:      (phone: string, pass: string) => api.post("/auth/login-phone", { phone, password: pass }).then(r => r.data),
  forgotPassword: (email: string)               => api.post("/auth/forgot-password", { email }).then(r => r.data),
  resetPassword:  (token: string, new_password: string) => api.post("/auth/reset-password", { token, new_password }).then(r => r.data),
  me:             ()                            => api.get<User>("/auth/me").then(r => r.data),
  logout:         ()                            => api.post("/auth/logout").then(r => r.data),
  firebase:       (idToken: string, registrationName?: string) => api.post("/auth/firebase", { id_token: idToken, registration_name: registrationName }).then(r => r.data),
  enrollFirebaseEmail: (idToken: string) => api.post<{ user: User }>("/auth/enroll-firebase-email", { id_token: idToken }).then(r => r.data),

  // Unified Multi-Platform Authentication (Web & Android)
  checkEmail: (email: string) =>
    api.post<{ exists: boolean; masked_phone?: string; auth_methods: string[] }>("/auth/check-email", { email }).then(r => r.data),
  checkPhone: (phone: string) =>
    api.post<{ exists: boolean; masked_phone?: string; masked_email?: string }>("/auth/check-phone", { phone }).then(r => r.data),
  sendLoginOtp: (params: { email?: string; phone?: string; channel: "email" | "sms" }) =>
    api.post<{ message: string }>("/auth/send-login-otp", params).then(r => r.data),
  verifyLoginOtp: (params: { email?: string; phone?: string; otp: string }) =>
    api.post<{ user: User }>("/auth/verify-login-otp", params).then(r => r.data),
  googleAuth: (params: { id_token?: string; email: string; name?: string; google_id?: string }) =>
    api.post<{ is_new_user: boolean; email: string; verified: boolean; user?: User }>("/auth/google", params).then(r => r.data),
  sendPhoneOtp: (phone: string, purpose = "auth") =>
    api.post<{ message: string }>("/auth/send-phone-otp", { phone, channel: "sms", purpose }).then(r => r.data),
  verifyPhoneOtp: (phone: string, otp: string, purpose = "auth") =>
    api.post<{ message: string }>("/auth/verify-phone-otp", { phone, otp, purpose }).then(r => r.data),
  sendEmailOtp: (email: string, purpose = "auth") =>
    api.post<{ message: string }>("/auth/send-email-otp", { email, channel: "email", purpose }).then(r => r.data),
  verifyEmailOtp: (email: string, otp: string, purpose = "auth") =>
    api.post<{ message: string }>("/auth/verify-email-otp", { email, otp, purpose }).then(r => r.data),
  completeUnifiedRegistration: (data: {
    email: string;
    name: string;
    password: string;
    phone: string;
    email_otp?: string;
    phone_otp?: string;
    google_verified?: boolean;
    platform?: "web" | "android";
    pnv_token?: string;
    firebase_id_token?: string;
  }) =>
    api.post<{ user: User }>("/auth/complete-unified-registration", data).then(r => r.data),
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
  phone_otp?: string;
  email_otp?: string;
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
  sendAddressPhoneOtp: (phone: string) => api.post<{ message: string; phone: string }>("/users/me/addresses/send-otp", { phone }).then(r => r.data),
  verifyAddressPhoneOtp: (phone: string, otp: string) => api.post<{ message: string; phone: string; verified: boolean }>("/users/me/addresses/verify-phone-otp", { phone, otp }).then(r => r.data),
  sendAddressEmailOtp: (email: string) => api.post<{ message: string; email: string }>("/users/me/addresses/send-email-otp", { email }).then(r => r.data),
  verifyAddressEmailOtp: (email: string, otp: string) => api.post<{ message: string; email: string; verified: boolean }>("/users/me/addresses/verify-email-otp", { email, otp }).then(r => r.data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}`).then(r => r.data),
};
