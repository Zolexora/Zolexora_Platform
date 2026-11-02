import { apiClient } from '../lib/api';
import { Duty, DutyStatus } from '../types/tms';

/** Duties of the signed-in driver. Errors propagate: the app never fakes success. */
export const dutiesService = {
  getDuties(params?: { status?: DutyStatus; driver_id?: string }): Promise<Duty[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.driver_id) query.set('driver_id', params.driver_id);
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
};
