import type {
  SystemHealthResponse,
  DatabaseHealthReport,
  AccountsListResponse,
  AccountSyncResponse,
  DiscoveredAccount,
  AccountStatus,
  CapacityTelemetryResponse,
  ArchivePreviewResponse,
  ArchiveExclusionsResponse,
  EmailQuotasResponse,
  EmailLogsResponse,
  EmailSendRequest,
  EmailSendResponse,
  FleetService,
  FleetResponse,
  Connection,
  ConnectionInput,
  ProbeResult,
  ProviderSpec,
} from './types';
import { SESSION_EXPIRED_EVENT, SESSION_STORAGE_KEY } from '@zolexora/auth-client';

// Browser: same origin, through the nginx gateway (/api -> backend). Set NEXT_PUBLIC_API_URL only for `next dev`.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/** Bearer token of the signed-in platform admin (stored by @zolexora/auth-client). */
function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const token = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || 'null')?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Generic JSON fetch wrapper with timeout and error handling.
 */
export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...(options?.headers || {}),
      },
      cache: 'no-store',
      signal: options?.signal || AbortSignal.timeout(10000),
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT)); // back to the login form
    }
    if (!res.ok) {
      const errorText = await res.text();
      let detail = errorText;
      try {
        const parsed = JSON.parse(errorText).detail;
        detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      } catch {}
      throw new Error(detail || `API error ${res.status} on ${endpoint}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[Platform Admin API] Request to ${endpoint} failed:`, error);
    throw error;
  }
}

// -------------------------------------------------------------
// Health Probes & Telemetry
// -------------------------------------------------------------

export async function fetchSystemHealth(): Promise<SystemHealthResponse> {
  try {
    return await fetchJson<SystemHealthResponse>('/api/health');
  } catch {
    return {
      status: 'degraded',
      service: 'platform-admin-backend',
      version: '1.0.0',
      environment: 'development (offline)',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function fetchDatabaseHealth(): Promise<DatabaseHealthReport> {
  try {
    return await fetchJson<DatabaseHealthReport>('/api/health/databases');
  } catch {
    return {
      overall_status: 'degraded',
      targets: {},
      timestamp: new Date().toISOString(),
    };
  }
}

// -------------------------------------------------------------
// Accounts & Infisical Sync
// -------------------------------------------------------------

export async function fetchAccounts(): Promise<AccountsListResponse> {
  try {
    return await fetchJson<AccountsListResponse>('/api/accounts');
  } catch (error) {
    console.error('Failed to fetch accounts from API:', error);
    return {
      accounts: [],
      total_count: 0,
      active_count: 0,
      throttled_count: 0,
      alerts: [
        {
          event: 'CONTROL_PLANE_OFFLINE',
          severity: 'CRITICAL',
          provider: 'system',
          target_product: 'platform-admin',
          expected_secret: 'BACKEND_API_URL',
          infisical_path: '/platform-admin',
          message: 'Unable to connect to Platform Admin control plane API.',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

export async function syncAccounts(): Promise<AccountSyncResponse> {
  return await fetchJson<AccountSyncResponse>('/api/accounts/sync', {
    method: 'POST',
  });
}

export async function updateAccountStatus(accountId: string, status: AccountStatus): Promise<DiscoveredAccount> {
  return await fetchJson<DiscoveredAccount>(`/api/accounts/${accountId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// -------------------------------------------------------------
// Storage & Capacity Telemetry
// -------------------------------------------------------------

export async function fetchCapacityTelemetry(): Promise<CapacityTelemetryResponse> {
  try {
    return await fetchJson<CapacityTelemetryResponse>('/api/telemetry/capacity');
  } catch (error) {
    console.error('Failed to fetch capacity telemetry:', error);
    return {
      databases: [],
      overall_threshold_alert: false,
      hot_tables: [],
      timestamp: new Date().toISOString(),
    };
  }
}

export async function previewArchive(database: string, targetCapacityPercent = 40): Promise<ArchivePreviewResponse> {
  return await fetchJson<ArchivePreviewResponse>('/api/telemetry/archive/preview', {
    method: 'POST',
    body: JSON.stringify({
      database,
      target_capacity_percent: targetCapacityPercent,
    }),
  });
}

export async function fetchArchiveExclusions(): Promise<ArchiveExclusionsResponse> {
  try {
    return await fetchJson<ArchiveExclusionsResponse>('/api/telemetry/archive/exclusions');
  } catch {
    return { pinned_tables: [] };
  }
}

export async function toggleArchiveExclusion(tableName: string, pinned: boolean): Promise<ArchiveExclusionsResponse> {
  return await fetchJson<ArchiveExclusionsResponse>('/api/telemetry/archive/exclusions/toggle', {
    method: 'POST',
    body: JSON.stringify({
      table_name: tableName,
      pinned,
    }),
  });
}

// -------------------------------------------------------------
// Email Operations & Quotas
// -------------------------------------------------------------

export async function fetchEmailQuotas(): Promise<EmailQuotasResponse> {
  try {
    return await fetchJson<EmailQuotasResponse>('/api/email/quotas');
  } catch (error) {
    console.error('Failed to fetch email quotas:', error);
    return {
      providers: [],
      timestamp: new Date().toISOString(),
    };
  }
}

export async function fetchEmailLogs(params?: {
  product?: string;
  provider?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<EmailLogsResponse> {
  const query = new URLSearchParams();
  if (params?.product) query.append('product', params.product);
  if (params?.provider) query.append('provider', params.provider);
  if (params?.status) query.append('status', params.status);
  if (params?.page) query.append('page', params.page.toString());
  if (params?.limit) query.append('limit', params.limit.toString());

  const queryString = query.toString() ? `?${query.toString()}` : '';

  try {
    return await fetchJson<EmailLogsResponse>(`/api/email/logs${queryString}`);
  } catch (error) {
    console.error('Failed to fetch email logs:', error);
    return {
      logs: [],
      total: 0,
      page: params?.page || 1,
      limit: params?.limit || 50,
    };
  }
}

export async function sendTestEmail(request: EmailSendRequest): Promise<EmailSendResponse> {
  return await fetchJson<EmailSendResponse>('/api/email/send', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// -------------------------------------------------------------
// Fleet Overview (Live Telemetry from Control Plane)
// -------------------------------------------------------------

export async function fetchFleetOverview(): Promise<FleetService[]> {
  try {
    const res = await fetchJson<FleetResponse>('/api/telemetry/fleet');
    return res.services || [];
  } catch (error) {
    console.error('Failed to fetch live fleet telemetry:', error);
    return [];
  }
}

// -------------------------------------------------------------
// Connections
// -------------------------------------------------------------

export const fetchProviders = () => fetchJson<ProviderSpec[]>('/api/connections/providers');

export const fetchConnections = () => fetchJson<Connection[]>('/api/connections');

export const testConnection = (input: ConnectionInput) =>
  fetchJson<ProbeResult>('/api/connections/test', { method: 'POST', body: JSON.stringify(input) });

export const createConnection = (input: ConnectionInput) =>
  fetchJson<Connection>('/api/connections', { method: 'POST', body: JSON.stringify(input) });

export const deleteConnection = (id: string) =>
  fetchJson<void>(`/api/connections/${id}`, { method: 'DELETE' });
