import type { VehicleDetails } from '../types/tms';

export type ExpiryColor = 'success' | 'warning' | 'danger' | 'muted';

export function getExpiryInfo(
  expiry?: string | null,
  daysWarn = 30,
): { color: ExpiryColor; text: string; daysLeft: number | null } {
  if (!expiry) return { color: 'muted', text: 'Not Set', daysLeft: null };
  const exp = new Date(expiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) return { color: 'danger', text: 'Expired', daysLeft };
  if (daysLeft <= 7) return { color: 'danger', text: `${daysLeft}d left`, daysLeft };
  if (daysLeft <= daysWarn) return { color: 'warning', text: `${daysLeft}d left`, daysLeft };
  return {
    color: 'success',
    text: exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }),
    daysLeft,
  };
}

export function getVehicleComplianceIssues(v: VehicleDetails): { expired: string[]; expiringSoon: string[] } {
  const checks: Array<[string, string | null | undefined, number]> = [
    ['RC', v.rc_expiry, 30],
    ['PUC', v.puc_expiry, 15],
    ['Insurance', v.insurance_expiry, 30],
    ['Permit', v.permit_expiry, 30],
    ['Fitness', v.fitness_expiry, 30],
  ];
  const expired: string[] = [];
  const expiringSoon: string[] = [];
  for (const [label, dateStr, warnDays] of checks) {
    if (!dateStr) continue;
    const { color, daysLeft } = getExpiryInfo(dateStr, warnDays);
    if (daysLeft !== null && daysLeft < 0) expired.push(label);
    else if (color === 'danger' || color === 'warning') expiringSoon.push(label);
  }
  return { expired, expiringSoon };
}
