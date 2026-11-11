// ─── USER ────────────────────────────────────────────────────────────────────
export type UserRole = 'tenant' | 'owner' | 'admin'

export type KYCStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

export interface User {
  id: string
  phone: string
  email?: string
  name: string
  role: UserRole
  profilePhoto?: string
  kycStatus: KYCStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Tenant extends User {
  role: 'tenant'
  permanentAddress?: string
  city?: string
  declaredIdType?: 'aadhaar' | 'pan' | 'passport' | 'voter'
  declaredIdLastFour?: string
}

export interface Owner extends User {
  role: 'owner'
  panNumber?: string
  aadhaarVerified: boolean
  panVerified: boolean
  bankVerified: boolean
  bankAccountNumber?: string
  bankIfsc?: string
  bankAccountName?: string
  totalListings: number
  totalEarnings: number
}

// ─── PROPERTY ────────────────────────────────────────────────────────────────
export type PropertyType = 'single' | 'shared' | 'pg' | 'flat' | 'studio'
export type FurnishingType = 'furnished' | 'semi-furnished' | 'unfurnished'
export type GenderPreference = 'male' | 'female' | 'any'
export type PropertyStatus = 'active' | 'occupied' | 'inactive' | 'under_review'

export interface Amenity {
  id: string
  name: string
  icon: string
}

export interface PropertyPhoto {
  id: string
  url: string
  thumbnailUrl: string
  isPrimary: boolean
  order: number
}

export interface Property {
  id: string
  ownerId: string
  owner?: Owner
  title: string
  description: string
  type: PropertyType
  status: PropertyStatus
  monthlyRent: number
  securityDeposit: number
  furnishing: FurnishingType
  genderPreference: GenderPreference
  amenities: Amenity[]
  photos: PropertyPhoto[]
  address: PropertyAddress
  rules?: string
  availableFrom: string
  rating?: number
  reviewCount: number
  createdAt: string
  updatedAt: string
}

export interface PropertyAddress {
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  landmark?: string
  latitude: number
  longitude: number
}

// ─── BOOKING ─────────────────────────────────────────────────────────────────
export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'active'
  | 'cancelled'
  | 'completed'

export interface Booking {
  id: string
  propertyId: string
  property?: Property
  tenantId: string
  tenant?: Tenant
  ownerId: string
  status: BookingStatus
  moveInDate: string
  moveOutDate?: string
  monthlyRent: number
  securityDeposit: number
  agreementUrl?: string
  agreementSignedAt?: string
  policeVerificationStatus?: 'pending' | 'submitted' | 'verified'
  createdAt: string
  updatedAt: string
}

// ─── PAYMENT ─────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded'
export type PaymentType = 'rent' | 'security_deposit' | 'refund'
export type PaymentMethod = 'upi' | 'card' | 'net_banking' | 'wallet'

export interface Payment {
  id: string
  bookingId: string
  booking?: Booking
  tenantId: string
  ownerId: string
  amount: number
  platformFee: number
  ownerAmount: number
  type: PaymentType
  status: PaymentStatus
  method?: PaymentMethod
  razorpayOrderId?: string
  razorpayPaymentId?: string
  receiptUrl?: string
  paidAt?: string
  dueDate: string
  createdAt: string
}

// ─── KYC ─────────────────────────────────────────────────────────────────────
export type DocumentType = 'aadhaar' | 'pan' | 'bank_account' | 'property_doc'

export interface KYCDocument {
  id: string
  userId: string
  type: DocumentType
  status: KYCStatus
  digioRequestId?: string
  verifiedData?: Record<string, string>
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
export interface ChatRoom {
  id: string
  bookingId: string
  tenantId: string
  ownerId: string
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: string
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderRole: UserRole
  content: string
  type: 'text' | 'image' | 'system'
  readAt?: string
  createdAt: string
}

// ─── MAINTENANCE ─────────────────────────────────────────────────────────────
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface MaintenanceRequest {
  id: string
  bookingId: string
  propertyId: string
  tenantId: string
  title: string
  description: string
  status: MaintenanceStatus
  priority: MaintenancePriority
  photos?: string[]
  resolvedAt?: string
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface OTPRequest {
  phone: string
}

export interface OTPVerify {
  phone: string
  otp: string
  role: UserRole
}

// ─── SEARCH / FILTERS ────────────────────────────────────────────────────────
export interface PropertySearchParams {
  city?: string
  pincode?: string
  latitude?: number
  longitude?: number
  radiusKm?: number
  type?: PropertyType
  minRent?: number
  maxRent?: number
  furnishing?: FurnishingType
  genderPreference?: GenderPreference
  amenities?: string[]
  availableFrom?: string
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'rating'
  page?: number
  limit?: number
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export type NotificationType =
  | 'booking_request'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'rent_due'
  | 'rent_paid'
  | 'maintenance_update'
  | 'agreement_ready'
  | 'kyc_verified'
  | 'kyc_rejected'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
  readAt?: string
  createdAt: string
}
export * from '@zolexora/api-contracts';
