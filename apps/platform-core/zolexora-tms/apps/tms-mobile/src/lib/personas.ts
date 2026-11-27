import { theme } from './theme';
import type { MobileBootstrapResponse, MobilePersona } from '../types/tms';

export interface PersonaMeta {
  key: MobilePersona;
  title: string;
  shortLabel: string;
  tagline: string;
  accentColor: string;
  badgeBg: string;
  workspaceTabTitle: string;
  workspaceTabIcon: string;
  showDutiesTab: boolean;
  showWorkspaceTab: boolean;
}

export const PERSONA_META: Record<MobilePersona, PersonaMeta> = {
  driver: {
    key: 'driver',
    title: 'Driver Console',
    shortLabel: 'Driver',
    tagline: 'Trip execution, milestones & license status',
    accentColor: theme.colors.primaryLight,
    badgeBg: theme.colors.primaryMuted,
    workspaceTabTitle: 'Fleet',
    workspaceTabIcon: '🔧',
    showDutiesTab: true,
    showWorkspaceTab: false,
  },
  vendor: {
    key: 'vendor',
    title: 'Vendor Portal',
    shortLabel: 'Vendor',
    tagline: 'Attached vehicles, drivers & vendor settlements',
    accentColor: theme.colors.warning,
    badgeBg: theme.colors.warningMuted,
    workspaceTabTitle: 'Vendor Hub',
    workspaceTabIcon: '🏭',
    showDutiesTab: false,
    showWorkspaceTab: true,
  },
  driver_vendor: {
    key: 'driver_vendor',
    title: 'Driver-Cum-Vendor',
    shortLabel: 'Driver + Vendor',
    tagline: 'Execute your trips & manage your vendor fleet/payables',
    accentColor: '#C084FC',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    workspaceTabTitle: 'Vendor Hub',
    workspaceTabIcon: '🏭',
    showDutiesTab: true,
    showWorkspaceTab: true,
  },
  supervisor: {
    key: 'supervisor',
    title: 'Field Supervisor',
    shortLabel: 'Supervisor',
    tagline: 'Live dispatch lanes, driver allocation & shift control',
    accentColor: '#38BDF8',
    badgeBg: theme.colors.infoMuted,
    workspaceTabTitle: 'Dispatch',
    workspaceTabIcon: '📡',
    showDutiesTab: true,
    showWorkspaceTab: true,
  },
  owner_ops: {
    key: 'owner_ops',
    title: 'Operations Command',
    shortLabel: 'Ops Manager',
    tagline: 'Bookings, dispatch tower, fleet & business overview',
    accentColor: theme.colors.success,
    badgeBg: theme.colors.successMuted,
    workspaceTabTitle: 'Operations',
    workspaceTabIcon: '🧭',
    showDutiesTab: true,
    showWorkspaceTab: true,
  },
  fleet_manager: {
    key: 'fleet_manager',
    title: 'Fleet Manager',
    shortLabel: 'Fleet',
    tagline: 'Vehicles, drivers & road compliance readiness',
    accentColor: '#38BDF8',
    badgeBg: theme.colors.infoMuted,
    workspaceTabTitle: 'Fleet',
    workspaceTabIcon: '🚛',
    showDutiesTab: true,
    showWorkspaceTab: true,
  },
  finance_manager: {
    key: 'finance_manager',
    title: 'Finance & Billing',
    shortLabel: 'Finance',
    tagline: 'Invoices, payables, vendor settlements & expenses',
    accentColor: theme.colors.success,
    badgeBg: theme.colors.successMuted,
    workspaceTabTitle: 'Finance',
    workspaceTabIcon: '💳',
    showDutiesTab: false,
    showWorkspaceTab: true,
  },
  client: {
    key: 'client',
    title: 'Client Portal',
    shortLabel: 'Client',
    tagline: 'Book transport, track live trips & check invoices',
    accentColor: '#22D3EE',
    badgeBg: 'rgba(34, 211, 238, 0.14)',
    workspaceTabTitle: 'Portal',
    workspaceTabIcon: '📦',
    showDutiesTab: true,
    showWorkspaceTab: true,
  },
};

export function resolvePersonas(bootstrap: MobileBootstrapResponse | null): {
  primary: MobilePersona;
  available: MobilePersona[];
} {
  if (!bootstrap?.me) {
    return { primary: 'driver', available: ['driver'] };
  }

  const { me, effective_permissions, driver, vendor } = bootstrap;
  if (me.workspace_type === 'CLIENT') {
    return { primary: 'client', available: ['client'] };
  }

  const perms = new Set(effective_permissions?.permissions ?? []);
  const has = (...keys: string[]) => keys.some((k) => perms.has(k));
  const role = (me.role_code || '').toLowerCase();

  const isOpsOrOwner =
    me.is_commander ||
    role === 'owner' ||
    role === 'operations_manager' ||
    has('operations.bookings.create', 'tms:operations_bookings:create', 'org:team:manage', 'identity.users.manage');

  const isSupervisor =
    role === 'supervisor' ||
    role === 'dispatcher' ||
    has('operations.dispatch.assign', 'tms:operations_dispatch:assign', 'operations.dispatch.view', 'tms:operations_dispatch:view');

  const isFleet =
    role === 'fleet_manager' ||
    has('fleet.vehicles.create', 'tms:fleet_vehicles:create', 'fleet.drivers.create', 'tms:fleet_drivers:create');

  const isFinance =
    role === 'finance_manager' ||
    has('finance.billing.view', 'tms:finance_billing:view', 'finance.vendor_payments.view', 'tms:finance_vendor_payments:view');

  const hasDriver = !!driver || role === 'driver';
  const hasVendor = !!vendor || role === 'vendor';
  const isDriverVendor = (!!driver && !!vendor) || role === 'driver_vendor' || role === 'dco';

  const available: MobilePersona[] = [];
  const push = (m: MobilePersona) => {
    if (!available.includes(m)) available.push(m);
  };

  if (isOpsOrOwner) push('owner_ops');
  if (isSupervisor) push('supervisor');
  if (isFleet) push('fleet_manager');
  if (isFinance) push('finance_manager');
  if (isDriverVendor) push('driver_vendor');
  if (hasVendor) push('vendor');
  if (hasDriver) push('driver');

  // If no explicit permissions/linked entity resolved (e.g. generic staff member), expose supervisor/driver fallback.
  if (available.length === 0) {
    push(me.is_creator ? 'owner_ops' : 'supervisor');
  }

  let primary = available[0];
  if (!isOpsOrOwner && !isSupervisor && !isFleet && !isFinance) {
    if (isDriverVendor) primary = 'driver_vendor';
    else if (hasVendor) primary = 'vendor';
    else if (hasDriver) primary = 'driver';
  }

  return { primary, available };
}
