import {
  getApiClient,
  auth,
  products,
  sellerOrg,
  sellerCatalog,
  reels,
  orders,
  admin,
  coins
} from "@zolexora/shared-api";

// Keep local session cookies on the same host as the seller browser tab.
// `localhost` and `127.0.0.1` are different cookie domains.
const sellerApiBaseUrl = typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? `http://${window.location.hostname}:4100/api`
  : undefined;

export const api = getApiClient(sellerApiBaseUrl);

export const authApi = {
  ...auth,
  // All portals share the same Firebase identity namespace. A first-time
  // sign-in may create the marketplace profile; seller permissions remain
  // server-authoritative and are checked by seller APIs.
  firebase: (idToken: string, registrationName?: string) => api.post("/auth/firebase", { id_token: idToken, registration_name: registrationName, allow_buyer_registration: true }).then((r: any) => r.data),
  checkEmail: (email: string) => api.post("/auth/check-email", { email }).then((r: any) => r.data),
  checkPhone: (phone: string) => api.post("/auth/check-phone", { phone }).then((r: any) => r.data),
  sendLoginOtp: (data: any) => api.post("/auth/send-login-otp", data).then((r: any) => r.data),
  verifyLoginOtp: (data: any) => api.post("/auth/verify-login-otp", data).then((r: any) => r.data),
  sendEmailOtp: (email: string, purpose = "registration") => api.post("/auth/send-email-otp", { email, purpose }).then((r: any) => r.data),
  verifyEmailOtp: (email: string, otp: string, purpose = "registration") => api.post("/auth/verify-email-otp", { email, otp, purpose }).then((r: any) => r.data),
  sendPhoneOtp: (phone: string, purpose = "registration") => api.post("/auth/send-phone-otp", { phone, purpose }).then((r: any) => r.data),
  verifyPhoneOtp: (phone: string, otp: string, purpose = "registration") => api.post("/auth/verify-phone-otp", { phone, otp, purpose }).then((r: any) => r.data),
  completeUnifiedRegistration: (data: any) => api.post("/auth/complete-unified-registration", data).then((r: any) => r.data),
  verifyGstin: (gstin: string) => api.get(`/seller/verification/gst/${encodeURIComponent(gstin)}`).then((r: any) => r.data),
  health: () => api.get("/health").then((r: any) => r.data),
};

export const productsApi = {
  ...products,
  bulkCreate: (data: any[]) => api.post("/products/bulk", data).then((r: any) => r.data),
};

export const sellerOrgApi = sellerOrg;
export const sellerCatalogApi = sellerCatalog;

export const reelsApi = reels;

export const ordersApi = orders;

export const analyticsApi = {
  stats: () => admin.stats(),
};

export const coinsApi = coins;
