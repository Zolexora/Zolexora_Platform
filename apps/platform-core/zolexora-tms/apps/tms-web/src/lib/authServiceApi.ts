import {
  getBusinessAccessToken,
  loadBusinessSession,
  refreshBusinessSession,
} from '@zolexora/auth-client/business-session';
import { AUTH_SERVICE_PUBLIC_URL } from './runtime';
import { expireSession, getPersonalToken } from './session';

export interface CentralAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface CentralUserProfile {
  zolexora_id: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  avatar_url: string | null;
  addresses: CentralAddress[];
  email_verified_at: string | null;
  phone_verified_at: string | null;
  created_at: string;
}

export interface ActivityGroup {
  key: string;
  label: string;
  hidden: boolean;
  sort_order: number;
}

export interface CentralOrganisation {
  zolexora_org_id: string;
  name: string;
  status: string;
  legal_name: string | null;
  trade_name: string | null;
  business_kind: string | null;
  pan_holder_type: string | null;
  pan_last4: string | null;
  email: string | null;
  phone: string | null;
  address: Omit<CentralAddress, 'label'> | null;
  logo_url: string | null;
  activity_primary: string | null;
  activity_others: string[];
  official_activities: string[];
  mfa_policy: 'off' | 'optional' | 'required';
  created_at: string;
}

export interface CentralMemberRole {
  scope: string;
  role_id: string;
  key: string;
  name: string;
  built_in: boolean;
}

export interface CentralMemberOverride {
  permission_key: string;
  effect: 'grant' | 'block';
}

export interface CentralMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  employee_id: string | null;
  status: 'active' | 'suspended';
  kind: 'person' | 'employee';
  zolexora_id: string;
  email: string | null;
  phone_number: string | null;
  display_name: string | null;
  roles: CentralMemberRole[];
  overrides: CentralMemberOverride[];
}

export interface CentralMemberAccess {
  member_id: string;
  role: string | null;
  is_owner: boolean;
  permissions: string[];
  explain: Record<string, string[]>;
  mfa_setup_required: boolean;
}

export interface CentralRole {
  id: string;
  scope: string;
  key: string;
  name: string;
  built_in: boolean;
  disabled: boolean;
  permissions: string[];
  blocks?: string[];
  members?: number;
}

export interface CentralInvite {
  id: string;
  kind: 'person' | 'employee';
  email: string | null;
  phone_number: string | null;
  org_role_id: string;
  product_roles: Record<string, string>;
  expires_at: string;
  reset: boolean;
  created_at: string;
}

export interface CatalogPermissionItem {
  key: string;
  description: string;
}

export interface CentralCatalog {
  org: CatalogPermissionItem[];
  common: CatalogPermissionItem[];
  products: { product: string; key: string; description: string; status: string }[];
}

export interface AuthSessionItem {
  id: string;
  product: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_used_at: string;
  mfa: boolean;
  current: boolean;
}

export interface InvitePreview {
  kind: 'person' | 'employee';
  reset: boolean;
  organization: { zolexora_org_id: string; name: string };
  role: string | null;
  needs_zolexora_account: boolean;
  email: string | null;
  phone_number: string | null;
  expires_at: string;
}

type TokenMode = 'business' | 'personal' | 'none';

async function authFetch<T>(
  path: string,
  options: RequestInit & { tokenMode?: TokenMode; explicitToken?: string | null } = {},
): Promise<T> {
  const baseUrl = AUTH_SERVICE_PUBLIC_URL();
  if (!baseUrl) throw new Error('AUTH_SERVICE_PUBLIC_URL is not configured.');

  const { tokenMode = 'business', explicitToken, ...init } = options;

  const getToken = async (): Promise<string | null> => {
    if (explicitToken !== undefined) return explicitToken;
    if (tokenMode === 'none') return null;
    if (tokenMode === 'personal') return getPersonalToken();
    if (loadBusinessSession()) {
      const tok = await getBusinessAccessToken(baseUrl);
      if (tok) return tok;
    }
    return getPersonalToken();
  };

  const makeReq = async (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  };

  let res = await makeReq(await getToken());
  if (res.status === 401 && tokenMode === 'business' && !explicitToken && loadBusinessSession()) {
    const refreshed = await refreshBusinessSession(baseUrl).catch(() => null);
    if (refreshed?.access_token) {
      res = await makeReq(refreshed.access_token);
    }
  }
  if (res.status === 401 && tokenMode !== 'none' && !explicitToken) {
    expireSession(tokenMode === 'business' ? 'business' : 'all');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.error?.message || `Auth service error (${res.status})`);
  }
  return data as T;
}

// ── User Profile (Track 1) ────────────────────────────────────────────────────

export async function getMyProfile(): Promise<CentralUserProfile> {
  const res = await authFetch<{ profile: CentralUserProfile }>('/api/v1/me/profile', { tokenMode: 'personal' });
  return res.profile;
}

export async function updateMyProfile(patch: {
  display_name?: string;
  avatar_url?: string | null;
  addresses?: CentralAddress[];
}): Promise<CentralUserProfile> {
  const res = await authFetch<{ profile: CentralUserProfile }>('/api/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    tokenMode: 'personal',
  });
  return res.profile;
}

// ── Sessions & MFA ────────────────────────────────────────────────────────────

export async function listMySessions(): Promise<AuthSessionItem[]> {
  const res = await authFetch<{ sessions: AuthSessionItem[] }>('/api/v1/auth/sessions', { tokenMode: 'business' });
  return res.sessions;
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await authFetch(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE', tokenMode: 'business' });
}

export async function revokeOtherSessions(): Promise<number> {
  const res = await authFetch<{ revoked: number }>('/api/v1/auth/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({}),
    tokenMode: 'business',
  });
  return res.revoked;
}

export async function listLoginHistory(): Promise<Record<string, unknown>[]> {
  const res = await authFetch<{ attempts: Record<string, unknown>[] }>('/api/v1/auth/login-history', { tokenMode: 'business' });
  return res.attempts;
}

export async function setupMfa(): Promise<{ secret: string; otpauth_url: string }> {
  return authFetch('/api/v1/auth/mfa/setup', { method: 'POST', body: JSON.stringify({}), tokenMode: 'business' });
}

export async function confirmMfa(code: string): Promise<void> {
  await authFetch('/api/v1/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }), tokenMode: 'business' });
}

export async function disableMfa(code: string): Promise<void> {
  await authFetch('/api/v1/auth/mfa', { method: 'DELETE', body: JSON.stringify({ code }), tokenMode: 'business' });
}

// ── Organisation Profile & Security ───────────────────────────────────────────

export async function listActivityGroups(): Promise<ActivityGroup[]> {
  const res = await authFetch<{ groups: ActivityGroup[] }>('/api/v1/activity-groups', { tokenMode: 'none' });
  return res.groups;
}

export async function getCentralOrganisation(orgId: string): Promise<{ organization: CentralOrganisation; role: string | null }> {
  return authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}`, { tokenMode: 'business' });
}

export async function updateCentralOrganisation(
  orgId: string,
  patch: Partial<{
    legal_name: string;
    trade_name: string | null;
    email: string | null;
    phone: string | null;
    address: Omit<CentralAddress, 'label'> | null;
    logo_url: string | null;
    activity_primary: string | null;
    activity_others: string[];
  }>,
): Promise<{ organization: CentralOrganisation; changed: string[] }> {
  return authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    tokenMode: 'business',
  });
}

export async function updateOrgSecurity(orgId: string, mfaPolicy: 'off' | 'optional' | 'required'): Promise<CentralOrganisation> {
  const res = await authFetch<{ organization: CentralOrganisation }>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/security`,
    { method: 'PUT', body: JSON.stringify({ mfa_policy: mfaPolicy }), tokenMode: 'business' },
  );
  return res.organization;
}

export async function transferOrgOwnership(orgId: string, memberId: string, mfaCode?: string): Promise<void> {
  await authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ member_id: memberId, ...(mfaCode ? { mfa_code: mfaCode } : {}) }),
    tokenMode: 'business',
  });
}

export async function closeCentralOrganisation(orgId: string, confirm: string): Promise<void> {
  await authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/close`, {
    method: 'POST',
    body: JSON.stringify({ confirm }),
    tokenMode: 'business',
  });
}

// ── Team, Members, Roles & Invites ────────────────────────────────────────────

export async function listCentralMembers(orgId: string): Promise<CentralMember[]> {
  const res = await authFetch<{ members: CentralMember[] }>(`/api/v1/organizations/${encodeURIComponent(orgId)}/members`, {
    tokenMode: 'business',
  });
  return res.members;
}

export async function getMemberAccess(orgId: string, memberId: string): Promise<CentralMemberAccess> {
  return authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}/access`, {
    tokenMode: 'business',
  });
}

export async function updateCentralMember(
  orgId: string,
  memberId: string,
  patch: { org_role_id?: string; status?: 'active' | 'suspended' },
): Promise<CentralMember> {
  const res = await authFetch<{ member: CentralMember }>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'PATCH', body: JSON.stringify(patch), tokenMode: 'business' },
  );
  return res.member;
}

export async function removeCentralMember(orgId: string, memberId: string): Promise<void> {
  await authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    tokenMode: 'business',
  });
}

export async function setMemberProductRole(orgId: string, memberId: string, product: string, roleId: string | null): Promise<void> {
  await authFetch(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(product)}`,
    { method: 'PUT', body: JSON.stringify({ role_id: roleId }), tokenMode: 'business' },
  );
}

export async function setMemberPermissionOverride(
  orgId: string,
  memberId: string,
  permission: string,
  effect: 'grant' | 'block' | null,
): Promise<void> {
  await authFetch(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}/overrides`,
    { method: 'PUT', body: JSON.stringify({ permission, effect }), tokenMode: 'business' },
  );
}

export async function resetEmployeePassword(orgId: string, memberId: string): Promise<{ invite: CentralInvite; link?: string }> {
  return authFetch(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}/reset-password`,
    { method: 'POST', body: JSON.stringify({}), tokenMode: 'business' },
  );
}

export async function createEmployeeDirect(body: {
  org_id: string;
  email?: string;
  phone_number?: string;
  password: string;
  org_role_id?: string;
  product_roles?: Record<string, string>;
}): Promise<{ employee: { zolexora_id: string; email: string | null; phone_number: string | null; org_id: string }; member_id: string }> {
  return authFetch('/api/v1/auth/employee/create', {
    method: 'POST',
    body: JSON.stringify(body),
    tokenMode: 'business',
  });
}

export async function listCentralInvites(orgId: string): Promise<CentralInvite[]> {
  const res = await authFetch<{ invites: CentralInvite[] }>(`/api/v1/organizations/${encodeURIComponent(orgId)}/invites`, {
    tokenMode: 'business',
  });
  return res.invites;
}

export async function createCentralInvite(
  orgId: string,
  body: {
    kind: 'person' | 'employee';
    email?: string;
    phone_number?: string;
    org_role_id?: string;
    product_roles?: Record<string, string>;
  },
): Promise<{ invite: CentralInvite; link?: string }> {
  return authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/invites`, {
    method: 'POST',
    body: JSON.stringify(body),
    tokenMode: 'business',
  });
}

export async function revokeCentralInvite(orgId: string, inviteId: string): Promise<void> {
  await authFetch(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/invites/${encodeURIComponent(inviteId)}`,
    { method: 'DELETE', tokenMode: 'business' },
  );
}

export async function listCentralRoles(orgId: string): Promise<CentralRole[]> {
  const res = await authFetch<{ roles: CentralRole[] }>(`/api/v1/organizations/${encodeURIComponent(orgId)}/roles`, {
    tokenMode: 'business',
  });
  return res.roles;
}

export async function createCentralRole(
  orgId: string,
  body: { scope: string; name: string; permissions: string[] },
): Promise<CentralRole> {
  const res = await authFetch<{ role: CentralRole }>(`/api/v1/organizations/${encodeURIComponent(orgId)}/roles`, {
    method: 'POST',
    body: JSON.stringify(body),
    tokenMode: 'business',
  });
  return res.role;
}

export async function updateCentralRole(
  orgId: string,
  roleId: string,
  body: { name?: string; permissions?: string[]; blocks?: string[]; disabled?: boolean; move_to?: string | null },
): Promise<CentralRole> {
  const res = await authFetch<{ role: CentralRole }>(
    `/api/v1/organizations/${encodeURIComponent(orgId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'PATCH', body: JSON.stringify(body), tokenMode: 'business' },
  );
  return res.role;
}

export async function deleteCentralRole(orgId: string, roleId: string, moveTo?: string): Promise<void> {
  const qs = moveTo ? `?move_to=${encodeURIComponent(moveTo)}` : '';
  await authFetch(`/api/v1/organizations/${encodeURIComponent(orgId)}/roles/${encodeURIComponent(roleId)}${qs}`, {
    method: 'DELETE',
    tokenMode: 'business',
  });
}

export async function getPermissionCatalog(product = 'tms'): Promise<CentralCatalog> {
  return authFetch(`/api/v1/catalog?product=${encodeURIComponent(product)}`, { tokenMode: 'business' });
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const res = await authFetch<{ invite: InvitePreview }>(`/api/v1/invites/${encodeURIComponent(token)}`, {
    tokenMode: 'none',
  });
  return res.invite;
}

export async function acceptInvite(
  token: string,
  opts: { password?: string; turnstileToken?: string; personalToken?: string | null },
): Promise<{ zolexora_id?: string; org_id?: string; member_id: string }> {
  return authFetch(`/api/v1/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: opts.password ? JSON.stringify({ password: opts.password, turnstile_token: opts.turnstileToken }) : undefined,
    headers: opts.turnstileToken ? { 'CF-Turnstile-Token': opts.turnstileToken } : undefined,
    tokenMode: opts.personalToken ? 'personal' : 'none',
    explicitToken: opts.personalToken ?? null,
  });
}
