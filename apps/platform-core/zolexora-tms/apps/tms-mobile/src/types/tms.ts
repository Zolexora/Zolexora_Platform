export enum DutyStatus {
  UNASSIGNED = 'UNASSIGNED',
  ASSIGNED = 'ASSIGNED',
  DRIVER_ACCEPTANCE_PENDING = 'DRIVER_ACCEPTANCE_PENDING',
  ACCEPTED = 'ACCEPTED',
  DISPATCHED = 'DISPATCHED',
  ARRIVED_PICKUP = 'ARRIVED_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED_DROP = 'ARRIVED_DROP',
  DUTY_COMPLETED = 'DUTY_COMPLETED',
  CANCELLED = 'CANCELLED',
}

export type WorkspaceType = 'SERVICE_PROVIDER' | 'CLIENT';

export type MobilePersona =
  | 'driver'
  | 'vendor'
  | 'driver_vendor'
  | 'supervisor'
  | 'owner_ops'
  | 'fleet_manager'
  | 'finance_manager'
  | 'client';

export interface BookingDetails {
  id: string;
  booking_number: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_address: string;
  drop_lat?: number;
  drop_lng?: number;
  pickup_datetime: string;
  cargo_description?: string;
  cargo_weight_kg?: number;
  special_instructions?: string;
}

export interface VehicleDetails {
  id: string;
  registration_number: string;
  vehicle_type?: string;
  ownership_type?: string;
  vendor_id?: string | null;
  make?: string;
  model?: string;
  fuel_type?: string;
  odometer_km?: number;
  status?: string;
  year?: number;
  payload_capacity_kg?: number;
  rc_expiry?: string | null;
  puc_expiry?: string | null;
  insurance_expiry?: string | null;
  permit_expiry?: string | null;
  fitness_expiry?: string | null;
}

export interface DutyDriverSummary {
  id: string;
  full_name: string;
  phone: string;
  vendor_id?: string | null;
}

export interface DutyTripSummary {
  id: string;
  trip_number: string;
  status: string;
  start_odometer: number;
  end_odometer?: number | null;
  total_distance_km?: number | null;
  toll_amount: number;
  fuel_amount: number;
  parking_amount: number;
  waiting_minutes: number;
  pod_attachment_url?: string | null;
  pod_notes?: string | null;
  operational_receipts?: Array<Record<string, unknown>>;
}

export interface Duty {
  id: string;
  duty_number: string;
  organisation_id: string;
  driver_id?: string;
  vehicle_id?: string;
  booking_id: string;
  status: DutyStatus;
  scheduled_start_time: string;
  scheduled_end_time: string;
  start_time?: string;
  end_time?: string;
  start_km?: number;
  end_km?: number;
  notes?: string;
  booking?: BookingDetails;
  vehicle?: VehicleDetails;
  driver?: DutyDriverSummary;
  trip?: DutyTripSummary | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory = 'FUEL' | 'TOLL' | 'PARKING' | 'MAINTENANCE' | 'OTHER';

export interface ExpenseRecord {
  id: string;
  duty_id?: string;
  category: ExpenseCategory;
  amount: number;
  liters?: number;
  odometer_km?: number;
  notes?: string;
  date: string;
  receipt_url?: string;
}

export interface DriverProfile {
  id: string;
  full_name?: string;
  name: string;
  phone: string;
  email: string;
  vendor_id?: string | null;
  driver_type?: string;
  status?: string;
  license_number: string;
  license_type?: string;
  license_expiry: string | null;
}

export interface VendorProfile {
  id: string;
  organisation_id: string;
  name: string;
  vendor_type: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  status: string;
}

export interface TenantContext {
  organisation_id: string;
  organisation_name: string;
}

export interface UserMe {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  zolexora_id?: string | null;
  phone_number?: string | null;
  member_kind?: string | null;
  organisation_id: string | null;
  workspace_type?: WorkspaceType | null;
  zolexora_org_id?: string | null;
  org_name?: string | null;
  business_kind?: string | null;
  is_creator: boolean;
  is_commander: boolean;
  is_platform_admin: boolean;
  is_business_session: boolean;
  mfa_setup_required: boolean;
  role_code?: string | null;
}

export interface OrganisationSummary {
  id: string;
  name: string;
  organisation_type: string;
  workspace_type: WorkspaceType;
  status: string;
  zolexora_org_id?: string | null;
}

export interface EffectivePermissions {
  user_id: string;
  organisation_id: string;
  is_commander: boolean;
  role_name?: string | null;
  permissions: string[];
}

export interface MobileBootstrapResponse {
  me: UserMe;
  organisation?: OrganisationSummary | null;
  effective_permissions?: EffectivePermissions | null;
  runtime?: Record<string, unknown> | null;
  driver?: (Omit<DriverProfile, 'name' | 'email'> & { full_name: string; email?: string | null }) | null;
  vendor?: VendorProfile | null;
}

export interface BusinessOption {
  zolexora_org_id: string;
  name: string;
  status?: string;
  role?: string | null;
  role_name?: string | null;
}

export interface BusinessSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  session_id: string;
  org: {
    zolexora_org_id: string;
    name: string;
    role: string | null;
  };
}
