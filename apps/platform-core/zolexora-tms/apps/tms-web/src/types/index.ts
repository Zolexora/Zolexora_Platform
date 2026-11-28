export type WorkspaceType = 'SERVICE_PROVIDER' | 'CLIENT';

export interface Organisation {
  id: string;
  name: string;
  organisation_type: string;
  workspace_type: WorkspaceType;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  zolexora_org_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthMeResponse {
  user_id: string;
  email: string | null;
  full_name?: string | null;
  zolexora_id?: string | null;
  phone_number?: string | null;
  member_kind?: 'person' | 'employee' | string | null;
  organisation_id: string | null;
  role_code: string | null;
  permissions?: string[];
  is_creator: boolean;
  is_commander: boolean;
  zolexora_org_id?: string | null;
  org_name?: string | null;
  business_kind?: string | null;
  is_platform_admin?: boolean;
  is_business_session?: boolean;
  mfa_setup_required?: boolean;
  verification?: Record<string, string>;
  workspace_type?: WorkspaceType | null;
}

export interface AuthBootstrapResponse {
  me: AuthMeResponse;
  organisation: Organisation | null;
  effective_permissions: import('./roles').EffectivePermissionsResponse | null;
  runtime: import('./runtime').RuntimeConfiguration | null;
}

export interface OrganisationMember {
  id: string;
  organisation_id: string;
  user_id: string;
  role_code: string;
  role_name: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  created_at: string;
}

export interface InviteMemberRequest {
  email: string;
  role_code: 'ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';
}

export interface Customer {
  id: string;
  organisation_id: string;
  client_code?: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  billing_address?: string;
  gstin?: string;
  pan?: string;
  payment_terms_days: number;
  credit_limit: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ONBOARDING' | 'SUSPENDED';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  billing_address?: string;
  gstin?: string;
  pan?: string;
  payment_terms_days?: number;
  credit_limit?: string;
  notes?: string;
}

export interface CustomerBulkItemError {
  row: number;
  name?: string;
  error: string;
}

export interface CustomerBulkCreateResponse {
  created_count: number;
  failed_count: number;
  created: Customer[];
  errors: CustomerBulkItemError[];
}

export interface Vendor {
  id: string;
  organisation_id: string;
  vendor_code?: string;
  name: string;
  vendor_type: 'FLEET_SUPPLIER' | 'DCO' | 'EMI_DRIVER' | 'WORKSHOP' | 'FUEL_PARTNER' | 'BROKER' | 'OTHER';
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface VendorCreate {
  name: string;
  vendor_type: 'FLEET_SUPPLIER' | 'DCO' | 'EMI_DRIVER' | 'WORKSHOP' | 'FUEL_PARTNER' | 'BROKER' | 'OTHER';
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
}

export interface VendorBulkItemError {
  row: number;
  name?: string;
  error: string;
}

export interface VendorBulkCreateResponse {
  created_count: number;
  failed_count: number;
  created: Vendor[];
  errors: VendorBulkItemError[];
}

export interface Driver {
  id: string;
  organisation_id: string;
  driver_code?: string;
  vendor_id?: string;
  vendor_code?: string;
  vendor_name?: string;
  vendor_pan?: string;
  full_name: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  license_number: string;
  license_type: string;
  license_expiry?: string;
  badge_number?: string;
  aadhaar_last4?: string;
  pan?: string;
  driver_type: 'PERMANENT' | 'CONTRACT' | 'MARKET';
  status: 'AVAILABLE' | 'ON_DUTY' | 'ON_LEAVE' | 'INACTIVE';
  avatar_url?: string;
  documents: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface DriverCreate {
  vendor_id?: string;
  vendor_code?: string;
  full_name: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  license_number: string;
  license_type?: string;
  license_expiry?: string;
  badge_number?: string;
  aadhaar_last4?: string;
  pan?: string;
  driver_type?: 'PERMANENT' | 'CONTRACT' | 'MARKET';
}

export interface DriverBulkItemError {
  row: number;
  full_name?: string;
  error: string;
}

export interface DriverBulkCreateResponse {
  created_count: number;
  failed_count: number;
  created: Driver[];
  errors: DriverBulkItemError[];
}

export type VehicleBodyType =
  | 'SEDAN'
  | 'HATCHBACK'
  | 'SUV'
  | 'TEMPO_TRAVELLER'
  | 'MINI_BUS'
  | 'BUS'
  | 'AUTO_RICKSHAW'
  | 'EV_CAB'
  | 'TRUCK'
  | 'TRAILER'
  | 'CONTAINER'
  | 'TANKER'
  | 'TIPPER'
  | 'TEMPO'
  | 'PICKUP'
  | 'OTHER';

export interface Vehicle {
  id: string;
  organisation_id: string;
  vendor_id?: string;
  vendor_code?: string;
  vendor_name?: string;
  vendor_pan?: string;
  registration_number: string;
  vehicle_type: VehicleBodyType;
  custom_vehicle_type?: string;
  ownership_type: 'OWNED' | 'LEASED' | 'EMI' | 'ATTACHED';
  make?: string;
  model?: string;
  year?: number;
  fuel_type: 'DIESEL' | 'CNG' | 'ELECTRIC' | 'PETROL';
  payload_capacity_kg?: string;
  volume_cft?: string;
  odometer_km: string;
  fastag_id?: string;
  gps_device_id?: string;
  rc_number?: string;
  rc_expiry?: string;
  fitness_expiry?: string;
  permit_expiry?: string;
  insurance_expiry?: string;
  puc_expiry?: string;
  status: 'AVAILABLE' | 'ON_DUTY' | 'MAINTENANCE' | 'DECOMMISSIONED';
  documents: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreate {
  vendor_id?: string;
  vendor_code?: string;
  registration_number: string;
  vehicle_type: VehicleBodyType;
  custom_vehicle_type?: string;
  ownership_type?: 'OWNED' | 'LEASED' | 'EMI' | 'ATTACHED';
  make?: string;
  model?: string;
  year?: number;
  fuel_type?: 'DIESEL' | 'CNG' | 'ELECTRIC' | 'PETROL';
  payload_capacity_kg?: string;
  volume_cft?: string;
  odometer_km?: string;
  fastag_id?: string;
  gps_device_id?: string;
  rc_number?: string;
}

// -------------------------------------------------------------
// Phase 4: Core Operational Engine Types
// -------------------------------------------------------------

export type BookingType =
  | 'ETS'
  | 'SPOT'
  | 'FIXED'
  | 'RENTAL'
  | 'AIRPORT'
  | 'LOCAL'
  | 'OUTSTATION'
  | 'CORPORATE'
  | 'CONTRACT'
  | 'RECURRING';

export type BookingServiceType = 'PASSENGER' | 'CARGO';

export type BookingRequestStatus = 'DRAFT' | 'REQUESTED' | 'CONFIRMED' | 'CANCELLED';

export type BookingOperationalStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DutyLifecycleStatus =
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'ARRIVED_PICKUP'
  | 'IN_TRANSIT'
  | 'ARRIVED_DROP'
  | 'DUTY_COMPLETED'
  | 'CANCELLED';

export type TripLifecycleStatus = 'NOT_STARTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface BookingRequest {
  id: string;
  request_number: string;
  organisation_id: string;
  customer_id: string;
  booking_type: BookingType;
  service_type: BookingServiceType;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_address: string;
  drop_lat?: number;
  drop_lng?: number;
  pickup_datetime: string;
  expected_completion_datetime?: string;
  passenger_info: Record<string, any>;
  cargo_info: Record<string, any>;
  vehicle_requirements: Record<string, any>;
  special_instructions?: string;
  source: string;
  estimated_pricing?: string;
  status: BookingRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface BookingRequestCreate {
  customer_id: string;
  booking_type?: BookingType;
  service_type?: BookingServiceType;
  pickup_address: string;
  drop_address: string;
  pickup_datetime: string;
  expected_completion_datetime?: string;
  passenger_info?: Record<string, any>;
  cargo_info?: Record<string, any>;
  vehicle_requirements?: Record<string, any>;
  special_instructions?: string;
  estimated_pricing?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  booking_request_id?: string;
  organisation_id: string;
  customer_id: string;
  booking_type: BookingType;
  service_type: BookingServiceType;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_address: string;
  drop_lat?: number;
  drop_lng?: number;
  pickup_datetime: string;
  expected_completion_datetime?: string;
  passenger_info: Record<string, any>;
  cargo_info: Record<string, any>;
  vehicle_requirements: Record<string, any>;
  driver_requirements: Record<string, any>;
  boarding_pin?: string | null;
  escort_required?: boolean;
  escort_guard_name?: string | null;
  safe_drop_confirmed_at?: string | null;
  status: BookingOperationalStatus;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface BookingCreate {
  customer_id: string;
  booking_type?: BookingType;
  service_type?: BookingServiceType;
  pickup_address: string;
  drop_address: string;
  pickup_datetime: string;
  expected_completion_datetime?: string;
  passenger_info?: Record<string, any>;
  cargo_info?: Record<string, any>;
  vehicle_requirements?: Record<string, any>;
  driver_requirements?: Record<string, any>;
  operational_instructions?: string;
}

export interface Duty {
  id: string;
  duty_number: string;
  organisation_id: string;
  booking_id: string;
  driver_id?: string;
  vehicle_id?: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  status: DutyLifecycleStatus;
  notes?: string;
  dispatched_at?: string;
  dispatched_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DutyCreate {
  booking_id: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  driver_id?: string;
  vehicle_id?: string;
  notes?: string;
}

export interface DutyAssignRequest {
  driver_id: string;
  vehicle_id: string;
}

export interface TripStartRequest {
  start_odometer: number | string;
  start_location?: Record<string, any>;
}

export interface TripCompleteRequest {
  end_odometer: number | string;
  end_location?: Record<string, any>;
  toll_amount?: number | string;
  fuel_amount?: number | string;
  parking_amount?: number | string;
  waiting_minutes?: number;
  pod_attachment_url?: string;
  pod_notes?: string;
  notes?: string;
}

export interface Trip {
  id: string;
  trip_number: string;
  organisation_id: string;
  duty_id: string;
  driver_id: string;
  vehicle_id: string;
  start_odometer: string;
  end_odometer?: string;
  total_distance_km?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  start_location: Record<string, any>;
  end_location: Record<string, any>;
  toll_amount: string;
  fuel_amount: string;
  parking_amount: string;
  waiting_minutes: number;
  status: TripLifecycleStatus;
  pod_attachment_url?: string;
  pod_notes?: string;
  operational_receipts: Array<Record<string, any>>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DispatchBoardItem {
  id: string;
  duty_number: string;
  booking_id: string;
  booking_number?: string;
  customer_name?: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_id?: string;
  vehicle_registration?: string;
  vehicle_type?: string;
  pickup_address?: string;
  drop_address?: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time?: string;
  notes?: string;
  status: DutyLifecycleStatus;
  // People-transport fields
  booking_type?: string | null;
  service_type?: string | null;
  passenger_name?: string | null;
  passenger_count?: number | null;
  shift_label?: string | null;
  escort_required?: boolean | null;
}


export * from './roles';
