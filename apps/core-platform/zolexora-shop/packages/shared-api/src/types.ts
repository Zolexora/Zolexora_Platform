// ─── User ─────────────────────────────────────────────────────────────────────
/** Marketplace profile of the signed-in user (GET /users/me). */
export interface User {
  id: string; email: string; name: string;
  coin_balance: number; is_active: boolean; is_email_verified: boolean;
  phone_number: string | null; is_phone_verified: boolean;
  picture: string | null; created_at: string | null;
  /** Track 2 staff: the Zolexora organisation (ZX-ORG id) they signed in to. */
  zolexora_org_id?: string | null;
}

// ─── Reel ─────────────────────────────────────────────────────────────────────
export type ReelContentType = "organic" | "sponsored";
export interface SponsorData { cta_label: string; cta_url: string; brand_name: string; product_id?: string; }
export interface Reel {
  id: string; creator_id: string; creator_name: string; title: string; description: string;
  video_url: string | null; thumbnail_url: string | null; media_type: "video" | "image";
  content_type: ReelContentType; linked_product_id: string | null; sponsor_data: SponsorData | null;
  is_active: boolean; views_count: number; likes_count: number; created_at: string;
}
export interface ReelCreateRequest {
  title: string; description?: string; linked_product_id?: string;
  content_type?: ReelContentType; sponsor_data?: SponsorData;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductCategory = "Electronics"|"Fashion"|"Home & Living"|"Beauty"|"Sports"|"Food"|"Other";
/** An amount in the smallest currency unit (paise for INR), as the API sends and expects it. */
export interface Money { amount_minor: number; currency: string; }
/** Rupees (e.g. 499.5) as API money. */
export const inrMoney = (rupees: number): Money => ({ amount_minor: Math.round(rupees * 100), currency: "INR" });
/** API money as rupees, for display and form fields. */
export const rupees = (money: Money | null | undefined): number => (money?.amount_minor ?? 0) / 100;

export interface Product {
  id: string; seller_id: string; seller_name: string; title: string; description: string;
  price: Money; original_price: Money | null; discount_percent: number | null;
  category: ProductCategory; images: string[]; stock: number; is_active: boolean;
  rating: number; reviews_count: number; created_at: string;
}
export interface ProductCreateRequest {
  title: string; description: string; price: Money; original_price?: Money;
  discount_percent?: number; category?: ProductCategory; images?: string[]; stock?: number;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem { id: string; user_id: string; product_id: string; quantity: number; product: Product; }

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus    = "pending"|"processing"|"shipped"|"delivered"|"cancelled";
export type PaymentStatus  = "pending"|"awaiting_verification"|"paid"|"failed";
export type PaymentMethod  = "razorpay"|"upi"|"coins";

export interface DeliveryAddress {
  name: string; phone: string; email: string; address: string;
  city: string; state: string; pincode: string;
}
export interface OrderItem { product_id: string; product_title: string; price: number; quantity: number; image: string | null; }
export interface Order {
  id: string; buyer_id: string; buyer_name: string; seller_id: string; seller_name: string;
  items: OrderItem[]; subtotal: number; coins_used: number; coins_discount: number; total_paid: number;
  payment_method: PaymentMethod; payment_status: PaymentStatus;
  razorpay_order_id: string | null; razorpay_payment_id: string | null;
  upi_transaction_ref: string | null; upi_verified_by: string | null; upi_verified_at: string | null;
  delivery_name: string | null; delivery_phone: string | null; delivery_email: string | null;
  delivery_address: string | null; delivery_city: string | null; delivery_state: string | null;
  delivery_pincode: string | null; status: OrderStatus; order_status?: string; admin_note: string | null;
  created_at: string; updated_at: string;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
export interface CheckoutRequest {
  coins_to_use?: number;
  payment_method: PaymentMethod;
  delivery_address?: DeliveryAddress;
}
export interface CheckoutResponse {
  type: "razorpay"|"upi"|"coins"|"razorpay_not_configured";
  order_id: string;
  amount?: number;
  currency?: string;
  razorpay_order_id?: string;
  key_id?: string;
  upi_id?: string;
  upi_link?: string;
  merchant_name?: string;
  instructions?: string[];
  message?: string;
}

// ─── Coins ────────────────────────────────────────────────────────────────────
export type CoinTxType = "earned"|"spent"|"bonus";
export interface CoinTransaction { id: string; user_id: string; amount: number; type: CoinTxType; description: string; ref_id: string | null; created_at: string; }
export interface CoinBalance { coin_balance: number; }
export interface DiscountCode { id: string; user_id: string; code: string; discount_percent: number; coins_spent: number; is_used: boolean; product_id: string | null; created_at: string; }

// ─── Subscriptions ────────────────────────────────────────────────────────────
export interface SubscriptionPlan { name: string; price: number; coins_bonus: number; description: string; }
export type SubscriptionPlans = Record<string, SubscriptionPlan>;

// ─── Admin ────────────────────────────────────────────────────────────────────
export interface AdminStats {
  total_users: number;
  total_reels: number; sponsored_reels: number;
  total_products: number; active_products: number;
  total_orders: number; paid_orders: number;
  pending_upi_verification: number; total_reel_views: number; pending_orders: number;
}

// ─── API Error ────────────────────────────────────────────────────────────────
export interface ApiError { detail: string; }

// ─── Seller Organization & Grants (MR-05) ─────────────────────────────────
export type OrgStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "INACTIVE";
export type OrgMemberRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | "NEEDS_REVISION";
export type GrantStatus = "PENDING" | "APPROVED" | "REVOKED" | "SUSPENDED";

export interface SellerOrganization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  verification_status: VerificationStatus;
  onboarding_state: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SellerOrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  permissions?: string[] | null;
  status: string;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface StorefrontGrant {
  id: string;
  organization_id: string;
  storefront_id: string;
  grant_status: GrantStatus;
  granted_by_user_id?: string | null;
  grant_reason?: string | null;
  effective_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerAuditLog {
  id: string;
  organization_id: string;
  actor_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface SellerVerificationHistory {
  id: string;
  organization_id: string;
  verified_by_user_id: string;
  status: string;
  notes?: string | null;
  created_at: string;
}

