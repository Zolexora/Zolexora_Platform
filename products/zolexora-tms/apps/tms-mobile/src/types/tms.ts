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
  make?: string;
  model?: string;
  fuel_type?: string;
  odometer_km?: number;
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
  name: string;
  phone: string;
  email: string;
  license_number: string;
  license_expiry: string;
  is_on_duty: boolean;
  active_duty_id?: string;
  assigned_vehicle_reg?: string;
}

export interface TenantContext {
  organisation_id: string;
  organisation_name: string;
}
