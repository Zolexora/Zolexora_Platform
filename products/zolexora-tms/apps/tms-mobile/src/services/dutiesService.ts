import { apiClient } from '../lib/api';
import { Duty, DutyStatus, ExpenseRecord } from '../types/tms';

// Mock dataset for offline or immediate test driving
export const MOCK_DUTIES: Duty[] = [
  {
    id: 'd-101',
    duty_number: 'DUTY-2026-0891',
    organisation_id: 'org-demo-01',
    driver_id: 'drv-demo-01',
    vehicle_id: 'veh-demo-01',
    booking_id: 'bk-501',
    status: DutyStatus.IN_TRANSIT,
    scheduled_start_time: '2026-10-27T08:00:00Z',
    scheduled_end_time: '2026-10-27T14:30:00Z',
    start_time: '2026-10-27T08:15:00Z',
    start_km: 12450.5,
    notes: 'Priority medical cargo. Requires temperature-controlled trailer verification.',
    booking: {
      id: 'bk-501',
      booking_number: 'BKG-2026-781',
      customer_name: 'Metro Pharma Logistics Ltd',
      customer_phone: '+91 98765 43210',
      pickup_address: 'Warehouse B-4, Navi Mumbai Industrial Area, Maharashtra',
      drop_address: 'Apollo Central Logistics Depot, Sector 18, Pune',
      pickup_datetime: '2026-10-27T08:30:00Z',
      cargo_description: 'Pharmaceutical Consumables (Cold Chain)',
      cargo_weight_kg: 2400,
      special_instructions: 'Handle with care. Gate pass code: MP-8942.',
    },
    vehicle: {
      id: 'veh-demo-01',
      registration_number: 'MH 12 QX 4521',
      make: 'Tata',
      model: 'Signa 2823',
      fuel_type: 'Diesel',
      odometer_km: 12450,
    },
    created_at: '2026-10-27T06:00:00Z',
    updated_at: '2026-10-27T08:15:00Z',
  },
  {
    id: 'd-102',
    duty_number: 'DUTY-2026-0892',
    organisation_id: 'org-demo-01',
    driver_id: 'drv-demo-01',
    vehicle_id: 'veh-demo-01',
    booking_id: 'bk-502',
    status: DutyStatus.DRIVER_ACCEPTANCE_PENDING,
    scheduled_start_time: '2026-10-27T16:00:00Z',
    scheduled_end_time: '2026-10-27T21:00:00Z',
    notes: 'Return freight dispatch back to Mumbai terminal.',
    booking: {
      id: 'bk-502',
      booking_number: 'BKG-2026-782',
      customer_name: 'Zolexora Retail Distribution',
      customer_phone: '+91 91234 56789',
      pickup_address: 'Chakan Industrial Hub, Phase 2, Pune',
      drop_address: 'Zolexora Central Hub, Bhiwandi, Thane',
      pickup_datetime: '2026-10-27T16:30:00Z',
      cargo_description: 'Packaged FMCG Goods',
      cargo_weight_kg: 3200,
    },
    vehicle: {
      id: 'veh-demo-01',
      registration_number: 'MH 12 QX 4521',
      make: 'Tata',
      model: 'Signa 2823',
      fuel_type: 'Diesel',
      odometer_km: 12450,
    },
    created_at: '2026-10-27T07:30:00Z',
    updated_at: '2026-10-27T07:30:00Z',
  },
  {
    id: 'd-103',
    duty_number: 'DUTY-2026-0888',
    organisation_id: 'org-demo-01',
    driver_id: 'drv-demo-01',
    vehicle_id: 'veh-demo-01',
    booking_id: 'bk-499',
    status: DutyStatus.DUTY_COMPLETED,
    scheduled_start_time: '2026-10-26T07:00:00Z',
    scheduled_end_time: '2026-10-26T13:00:00Z',
    start_time: '2026-10-26T07:10:00Z',
    end_time: '2026-10-26T12:45:00Z',
    start_km: 12280.0,
    end_km: 12450.0,
    booking: {
      id: 'bk-499',
      booking_number: 'BKG-2026-775',
      customer_name: 'Apex Industrial Parts Ltd',
      pickup_address: 'Turbhe MIDC, Navi Mumbai',
      drop_address: 'Hadapsar Industrial Estate, Pune',
      pickup_datetime: '2026-10-26T07:15:00Z',
      cargo_description: 'Precision Steel Fasteners',
    },
    created_at: '2026-10-25T15:00:00Z',
    updated_at: '2026-10-26T12:45:00Z',
  },
];

let localDuties = [...MOCK_DUTIES];

export const dutiesService = {
  async getDuties(params?: { status?: DutyStatus; driver_id?: string }): Promise<Duty[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set('status', params.status);
      if (params?.driver_id) queryParams.set('driver_id', params.driver_id);
      
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const duties = await apiClient<Duty[]>(`/api/v1/duties${queryStr}`);
      return duties;
    } catch {
      // Return local memory dataset on network/backend offline
      let filtered = [...localDuties];
      if (params?.status) {
        filtered = filtered.filter((d) => d.status === params.status);
      }
      return filtered;
    }
  },

  async getDutyById(dutyId: string): Promise<Duty> {
    try {
      return await apiClient<Duty>(`/api/v1/duties/${dutyId}`);
    } catch {
      const found = localDuties.find((d) => d.id === dutyId);
      if (found) return found;
      throw new Error(`Duty ${dutyId} not found`);
    }
  },

  async acceptDuty(dutyId: string): Promise<Duty> {
    try {
      return await apiClient<Duty>(`/api/v1/duties/${dutyId}/accept`, {
        method: 'POST',
      });
    } catch {
      localDuties = localDuties.map((d) =>
        d.id === dutyId ? { ...d, status: DutyStatus.ACCEPTED, updated_at: new Date().toISOString() } : d
      );
      return this.getDutyById(dutyId);
    }
  },

  async rejectDuty(dutyId: string, reason?: string): Promise<Duty> {
    try {
      return await apiClient<Duty>(`/api/v1/duties/${dutyId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch {
      localDuties = localDuties.map((d) =>
        d.id === dutyId ? { ...d, status: DutyStatus.CANCELLED, notes: reason, updated_at: new Date().toISOString() } : d
      );
      return this.getDutyById(dutyId);
    }
  },

  async advanceMilestone(
    dutyId: string,
    milestone: 'arrived-pickup' | 'in-transit' | 'arrived-drop' | 'complete',
    payload?: { start_km?: number; end_km?: number; notes?: string }
  ): Promise<Duty> {
    try {
      return await apiClient<Duty>(`/api/v1/duties/${dutyId}/${milestone}`, {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } catch {
      const statusMap: Record<string, DutyStatus> = {
        'arrived-pickup': DutyStatus.ARRIVED_PICKUP,
        'in-transit': DutyStatus.IN_TRANSIT,
        'arrived-drop': DutyStatus.ARRIVED_DROP,
        'complete': DutyStatus.DUTY_COMPLETED,
      };

      const newStatus = statusMap[milestone] || DutyStatus.IN_TRANSIT;
      localDuties = localDuties.map((d) => {
        if (d.id === dutyId) {
          return {
            ...d,
            status: newStatus,
            start_km: payload?.start_km ?? d.start_km,
            end_km: payload?.end_km ?? d.end_km,
            notes: payload?.notes ?? d.notes,
            updated_at: new Date().toISOString(),
          };
        }
        return d;
      });
      return this.getDutyById(dutyId);
    }
  },

  async recordExpense(expense: Omit<ExpenseRecord, 'id'>): Promise<ExpenseRecord> {
    const record: ExpenseRecord = {
      ...expense,
      id: `exp-${Date.now()}`,
    };
    return record;
  },
};
