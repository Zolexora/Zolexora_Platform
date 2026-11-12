// Business verification, accepted documents, activity groups and catalog approvals.
// Served by the auth service through the backend's /api/identity proxy (ADR 0004 §6, ADR 0005 §2).
import { fetchJson } from './api';

export type CheckType = 'identity' | 'pan' | 'gst' | 'registration' | 'authority' | 'bank';
export type VStatus = 'pending' | 'verified' | 'rejected' | 'needs_revision';

export interface QueueItem {
  id: string;
  check_type: CheckType;
  status: VStatus;
  provider: string;
  method: string | null;
  value_last4: string | null;
  registered_name: string | null;
  reason: string | null;
  updated_at: string;
  zolexora_org_id: string | null;
  org_name: string | null;
  business_kind: string | null;
  user_zolexora_id: string | null;
  user_name: string | null;
  payout_account_id: string | null;
}

export interface VerificationDetail {
  verification: QueueItem & { details: Record<string, unknown>; document_ids: string[]; decided_by: string | null; decided_at: string | null };
  value: unknown;
  organization: null | {
    zolexora_org_id: string; name: string; legal_name: string | null; trade_name: string | null;
    business_kind: string | null; pan: string | null; owner_identity_names: string[];
  };
  documents: { document_id: string; document_type: string; label: string | null; mime_type: string; file_size: number; official_url: string | null; verify_url: string | null }[];
  attempts: { provider: string; method: string | null; paid: boolean; outcome: string; registered_name: string | null; note: string | null; actor_id: string | null; created_at: string }[];
}

export interface DocumentType {
  key: string; label: string; check_type: Exclude<CheckType, 'bank'>; business_kinds: string[];
  official_url: string | null; verify_url: string | null; instructions: string; active: boolean; sort_order: number;
}

export interface ActivityGroup { key: string; label: string; hidden: boolean; sort_order: number }

export interface CatalogVersion {
  id: string; product: string; version: number; status: 'applied' | 'pending_approval' | 'approved' | 'rejected';
  added: string[]; removed: string[]; permissions: { key: string; description: string }[];
  decided_by: string | null; decided_at: string | null; created_at: string;
}

const qs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const put = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body) });

export const fetchQueue = (status?: string, check?: string) =>
  fetchJson<{ verifications: QueueItem[] }>(`/api/identity/verifications${qs({ status, check })}`).then((r) => r.verifications);
export const fetchVerification = (id: string) => fetchJson<VerificationDetail>(`/api/identity/verifications/${id}`);
export const decideVerification = (id: string, status: VStatus, reason?: string) =>
  fetchJson(`/api/identity/verifications/${id}/decision`, post({ status, ...(reason ? { reason } : {}) }));
export const documentUrl = (documentId: string) =>
  fetchJson<{ signed_url: string; expires_at: string; expires_in_seconds: number }>(`/api/identity/documents/${documentId}/url`, { method: 'POST' });

export const fetchDocumentTypes = () =>
  fetchJson<{ documents: DocumentType[] }>('/api/identity/verification-document-types').then((r) => r.documents);
export const saveDocumentType = ({ key, ...d }: DocumentType) => fetchJson(`/api/identity/verification-document-types/${key}`, put(d));

export const fetchActivityGroups = () => fetchJson<{ groups: ActivityGroup[] }>('/api/identity/activity-groups').then((r) => r.groups);
export const saveActivityGroup = ({ key, ...g }: ActivityGroup) => fetchJson(`/api/identity/activity-groups/${key}`, put(g));

export const fetchCatalogVersions = (status?: string) =>
  fetchJson<{ versions: CatalogVersion[] }>(`/api/identity/catalog/versions${qs({ status })}`).then((r) => r.versions);
export const catalogAction = (id: string, action: 'approve' | 'reject' | 'rollback') =>
  fetchJson(`/api/identity/catalog/versions/${id}/${action}`, { method: 'POST' });
