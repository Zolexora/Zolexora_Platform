import { apiClient } from '../lib/api';
import { Duty, DutyStatus } from '../types/tms';

export interface TripRecord {
  id: string;
  trip_number: string;
  duty_id: string;
  driver_id: string;
  vehicle_id: string;
  start_odometer: number;
  end_odometer?: number | null;
  total_distance_km?: number | null;
  start_timestamp?: string | null;
  end_timestamp?: string | null;
  toll_amount: number;
  fuel_amount: number;
  parking_amount: number;
  waiting_minutes: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  pod_attachment_url?: string | null;
  pod_notes?: string | null;
  pod_uploaded_at?: string | null;
  operational_receipts: Array<{ receipt_type: string; amount: number; receipt_url: string; notes?: string }>;
  notes?: string | null;
}

/** Duties + trip operations. Errors propagate: the app never fakes success. */
export const dutiesService = {
  getDuties(params?: { status?: DutyStatus; driver_id?: string; vendor_id?: string }): Promise<Duty[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.driver_id) query.set('driver_id', params.driver_id);
    if (params?.vendor_id) query.set('vendor_id', params.vendor_id);
    const qs = query.toString();
    return apiClient<Duty[]>(`/api/v1/duties${qs ? `?${qs}` : ''}`);
  },

  getDutyById(dutyId: string): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}`);
  },

  acceptDuty(dutyId: string): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/accept`, { method: 'POST' });
  },

  rejectDuty(dutyId: string, reason?: string): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  advanceMilestone(
    dutyId: string,
    milestone: 'arrived-pickup' | 'in-transit' | 'arrived-drop' | 'complete',
    payload?: { start_km?: number; end_km?: number; notes?: string }
  ): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/${milestone}`, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    });
  },

  // ── Trip ops ──────────────────────────────────────────────────────────────

  startTrip(dutyId: string, payload: { start_odometer: number; start_location?: Record<string, unknown> }): Promise<TripRecord> {
    return apiClient<TripRecord>(`/api/v1/trips/duties/${dutyId}/start`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, start_location: payload.start_location ?? {} }),
    });
  },

  completeTrip(
    tripId: string,
    payload: {
      end_odometer: number;
      end_location?: Record<string, unknown>;
      toll_amount?: number;
      fuel_amount?: number;
      parking_amount?: number;
      waiting_minutes?: number;
      pod_attachment_url?: string;
      pod_notes?: string;
      notes?: string;
    }
  ): Promise<TripRecord> {
    return apiClient<TripRecord>(`/api/v1/trips/${tripId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ end_location: {}, ...payload }),
    });
  },

  uploadPod(tripId: string, formData: FormData): Promise<{ pod_attachment_url: string }> {
    return apiClient<{ pod_attachment_url: string }>(`/api/v1/trips/${tripId}/pod`, {
      method: 'POST',
      body: formData,
      // Let browser set multipart boundary — omit Content-Type header
      headers: {},
    });
  },

  addReceipt(tripId: string, payload: { receipt_type: string; amount: number; receipt_url: string; notes?: string }): Promise<TripRecord> {
    return apiClient<TripRecord>(`/api/v1/trips/${tripId}/receipts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getTrip(tripId: string): Promise<TripRecord> {
    return apiClient<TripRecord>(`/api/v1/trips/${tripId}`);
  },
};
