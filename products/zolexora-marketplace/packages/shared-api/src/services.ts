import { getApiClient } from "./client";
import type {
  Product, ProductCreateRequest, Reel, ReelCreateRequest,
  CartItem, Order, CheckoutRequest, CheckoutResponse,
  CoinTransaction, CoinBalance, DiscountCode,
  SubscriptionPlans, AdminStats, User,
} from "./types";

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = {
  list:   (params?: any)                  => getApiClient().get<Product[]>("/products", { params }).then(r => r.data),
  get:    (id: string)                    => getApiClient().get<Product>(`/products/${id}`).then(r => r.data),
  my:     ()                             => getApiClient().get<Product[]>("/products/my").then(r => r.data),
  create: (d: ProductCreateRequest)      => getApiClient().post<Product>("/products", d).then(r => r.data),
  update: (id: string, d: Partial<ProductCreateRequest>) => getApiClient().put(`/products/${id}`, d).then(r => r.data),
  delete: (id: string)                   => getApiClient().delete(`/products/${id}`).then(r => r.data),
  uploadImage: (id: string, file: File)  => {
    const fd = new FormData(); fd.append("file", file);
    return getApiClient().post<{ image_url: string; storage: string }>(`/products/${id}/upload-image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
};

// ─── Reels ────────────────────────────────────────────────────────────────────
export const reels = {
  list:   (params?: any)                 => getApiClient().get<Reel[]>("/reels", { params }).then(r => r.data),
  my:     ()                            => getApiClient().get<Reel[]>("/reels/my").then(r => r.data),
  create: (d: ReelCreateRequest)        => getApiClient().post<Reel>("/reels", d).then(r => r.data),
  update: (id: string, d: any)          => getApiClient().put(`/reels/${id}`, d).then(r => r.data),
  delete: (id: string)                  => getApiClient().delete(`/reels/${id}`).then(r => r.data),
  view:   (id: string)                  => getApiClient().post<{ coins_earned: number; message: string }>(`/reels/${id}/view`).then(r => r.data),
  uploadMedia: (id: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return getApiClient().post<{ video_url: string; storage: string }>(`/reels/${id}/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const cart = {
  get:    ()                                   => getApiClient().get<CartItem[]>("/cart").then(r => r.data),
  count:  ()                                   => getApiClient().get<{ count: number }>("/cart/count").then(r => r.data),
  add:    (product_id: string, quantity = 1)   => getApiClient().post("/cart/items", { product_id, quantity }).then(r => r.data),
  update: (product_id: string, quantity: number) => getApiClient().put(`/cart/items/${product_id}`, null, { params: { quantity } }).then(r => r.data),
  remove: (product_id: string)                 => getApiClient().delete(`/cart/items/${product_id}`).then(r => r.data),
  checkout: (d: CheckoutRequest)               => getApiClient().post<CheckoutResponse>("/cart/checkout", d).then(r => r.data),
  // Razorpay — IDs in body (not query params)
  verifyRazorpay: (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) =>
    getApiClient().post("/cart/checkout/verify-payment", { razorpay_order_id, razorpay_payment_id, razorpay_signature }).then(r => r.data),
  // UPI — submit UTR after paying
  upiPaid: (order_id: string, upi_transaction_ref: string) =>
    getApiClient().post("/cart/checkout/upi-paid", { order_id, upi_transaction_ref }).then(r => r.data),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = {
  my:     ()                                   => getApiClient().get<Order[]>("/orders/my").then(r => r.data),
  seller: ()                                   => getApiClient().get<Order[]>("/orders/seller").then(r => r.data),
  get:    (id: string)                         => getApiClient().get<Order>(`/orders/${id}`).then(r => r.data),
  updateStatus: (id: string, status: string)   => getApiClient().put(`/orders/${id}/status`, null, { params: { status } }).then(r => r.data),
};

// ─── Coins ────────────────────────────────────────────────────────────────────
export const coins = {
  balance:          ()                                   => getApiClient().get<CoinBalance>("/coins/balance").then(r => r.data),
  history:          ()                                   => getApiClient().get<CoinTransaction[]>("/coins/history").then(r => r.data),
  generateDiscount: (coins_to_spend: number, product_id?: string) =>
    getApiClient().post<DiscountCode>("/coins/generate-discount", { coins_to_spend, product_id }).then(r => r.data),
  myDiscounts:      ()                                   => getApiClient().get<DiscountCode[]>("/coins/discounts").then(r => r.data),
};

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = {
  plans:    ()              => getApiClient().get<SubscriptionPlans>("/subscriptions/plans").then(r => r.data),
  checkout: (plan_type: string) => getApiClient().post("/subscriptions/checkout", { plan_type }).then(r => r.data),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const admin = {
  stats:          ()                               => getApiClient().get<AdminStats>("/admin/stats").then(r => r.data),
  analytics:      ()                               => getApiClient().get("/admin/analytics").then(r => r.data),
  users:          ()                               => getApiClient().get<User[]>("/admin/users").then(r => r.data),
  setUserRole:    (uid: string, role: string)      => getApiClient().put(`/admin/users/${uid}/role`, null, { params: { role } }).then(r => r.data),
  toggleUser:     (uid: string)                    => getApiClient().put(`/admin/users/${uid}/toggle`).then(r => r.data),
  products:       ()                               => getApiClient().get<Product[]>("/admin/products").then(r => r.data),
  toggleProduct:  (pid: string)                    => getApiClient().put(`/admin/products/${pid}/toggle`).then(r => r.data),
  deleteProduct:  (pid: string)                    => getApiClient().delete(`/admin/products/${pid}`).then(r => r.data),
  reels:          ()                               => getApiClient().get<Reel[]>("/admin/reels").then(r => r.data),
  toggleReel:     (rid: string)                    => getApiClient().put(`/admin/reels/${rid}/toggle`).then(r => r.data),
  deleteReel:     (rid: string)                    => getApiClient().delete(`/admin/reels/${rid}`).then(r => r.data),
  orders:         ()                               => getApiClient().get<Order[]>("/admin/orders").then(r => r.data),
  pendingUpiOrders: ()                             => getApiClient().get<Order[]>("/admin/orders/pending-upi").then(r => r.data),
  verifyUpi:      (order_id: string, approve: boolean, admin_note?: string) =>
    getApiClient().put(`/admin/orders/${order_id}/verify-upi`, { approve, admin_note }).then(r => r.data),
};

// ─── Seller ───────────────────────────────────────────────────────────────────
export const sellerOrg = {
  listMy:           ()                                     => getApiClient().get("/seller/organizations/me").then(r => r.data),
  create:           (data: unknown)                        => getApiClient().post("/seller/organizations", data).then(r => r.data),
  get:              (orgId: string)                        => getApiClient().get(`/seller/organizations/${orgId}`).then(r => r.data),
  listMembers:      (orgId: string)                        => getApiClient().get(`/seller/organizations/${orgId}/members`).then(r => r.data),
  inviteMember:     (orgId: string, data: unknown)         => getApiClient().post(`/seller/organizations/${orgId}/members/invite`, data).then(r => r.data),
  updateMemberRole: (orgId: string, memberId: string, data: unknown) => getApiClient().put(`/seller/organizations/${orgId}/members/${memberId}/role`, data).then(r => r.data),
  removeMember:     (orgId: string, memberId: string)      => getApiClient().delete(`/seller/organizations/${orgId}/members/${memberId}`).then(r => r.data),
  listGrants:       (orgId: string)                        => getApiClient().get(`/seller/organizations/${orgId}/grants`).then(r => r.data),
  requestGrant:     (orgId: string, data: unknown)         => getApiClient().post(`/seller/organizations/${orgId}/grants`, data).then(r => r.data),
  getAuditLog:      (orgId: string)                        => getApiClient().get(`/seller/organizations/${orgId}/audit-log`).then(r => r.data),
};

export const sellerCatalog = {
  list:         ()                                         => getApiClient().get("/seller/catalog/listings").then(r => r.data),
  get:          (id: string)                               => getApiClient().get(`/seller/catalog/listings/${id}`).then(r => r.data),
  create:       (data: unknown)                            => getApiClient().post("/seller/catalog/listings", data).then(r => r.data),
  update:       (id: string, data: unknown)                => getApiClient().put(`/seller/catalog/listings/${id}`, data).then(r => r.data),
  inventory:    (id: string)                               => getApiClient().get(`/seller/catalog/listings/${id}/inventory`).then(r => r.data),
  setInventory: (id: string, quantity: number)             => getApiClient().put(`/seller/catalog/listings/${id}/inventory`, { quantity }).then(r => r.data),
  lifecycle:    (id: string, action: "pause" | "resume" | "archive") => getApiClient().put(`/seller/catalog/listings/${id}/lifecycle`, { action }).then(r => r.data),
};
