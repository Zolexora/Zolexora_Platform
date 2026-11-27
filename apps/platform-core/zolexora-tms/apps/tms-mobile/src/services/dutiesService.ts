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
  status: 'NOT_STARTED' | 'IN_TRANSIT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  pod_attachment_url?: string | null;
  pod_notes?: string | null;
  pod_uploaded_at?: string | null;
  operational_receipts: Array<{ receipt_type: string; amount: number; receipt_url: string; notes?: string }>;
  notes?: string | null;
}

export interface TripEventRecord {
  id: string;
  trip_id: string;
  event_type: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

/** Duties + trip operations. Errors propagate: the app never fakes success. */
export const dutiesService = {
  getDuties(params?: {
    status?: DutyStatus;
    driver_id?: string;
    vendor_id?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<Duty[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.driver_id) query.set('driver_id', params.driver_id);
    if (params?.vendor_id) query.set('vendor_id', params.vendor_id);
    if (params?.search) query.set('search', params.search);
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
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

  assignDuty(dutyId: string, payload: { driver_id: string; vehicle_id: string }): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  dispatchDuty(dutyId: string): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/dispatch`, { method: 'POST' });
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

  postTripEvent(
    tripId: string,
    payload: { event_type: string; latitude?: number; longitude?: number; notes?: string; timestamp?: string },
  ): Promise<TripEventRecord> {
    return apiClient<TripEventRecord>(`/api/v1/trips/${tripId}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getTripEvents(
    tripId: string,
    params?: { event_type?: string; limit?: number },
  ): Promise<TripEventRecord[]> {
    const query = new URLSearchParams();
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient<TripEventRecord[]>(`/api/v1/trips/${tripId}/events${qs ? `?${qs}` : ''}`);
  },

  createShareLink(tripId: string): Promise<{ share_token: string; share_url: string; expires_at: string }> {
    return apiClient<{ share_token: string; share_url: string; expires_at: string }>(
      `/api/v1/trips/${tripId}/share-link`,
      { method: 'POST' },
    );
  },

  updateEwayBill(
    bookingId: string,
    payload: { eway_bill_number: string; eway_bill_valid_until: string },
  ): Promise<unknown> {
    return apiClient(`/api/v1/bookings/${bookingId}/eway-bill`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDutyStop(
    dutyId: string,
    seq: number,
    payload: { status: 'ARRIVED' | 'DELIVERED'; pod_url?: string; notes?: string; latitude?: number; longitude?: number },
  ): Promise<Duty> {
    return apiClient<Duty>(`/api/v1/duties/${dutyId}/stops/${seq}/update`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getTripFastagReconciliation(tripId: string): Promise<{
    trip_id: string;
    trip_number: string;
    driver_manual_toll: string | number;
    fastag_synced_toll: string | number;
    variance: string | number;
    duplicate_count: number;
    transactions: Array<{
      id: string;
      transaction_ref: string;
      plaza_name: string;
      amount: string | number;
      transacted_at: string;
      duplicate_flag: boolean;
    }>;
  }> {
    return apiClient(`/api/v1/integrations/fastag/trips/${tripId}/reconciliation`);
  },
};
