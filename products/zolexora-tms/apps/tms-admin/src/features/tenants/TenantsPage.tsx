import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Search,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  ChevronDown,
  Calendar,
  AlertCircle,
  Sliders,
  X,
  Loader2,
} from 'lucide-react';
import { apiClient } from '../../lib/api';

interface Quota {
  tier: string;
  max_members: number;
  max_vehicles: number;
  max_duties_per_month: number;
}

interface Organisation {
  id: string;
  name: string;
  organisation_type: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  member_count?: number;
  quota?: Quota;
}

function StatusBadge({ status }: { status: Organisation['status'] }) {
  const styles = {
    ACTIVE:    'bg-silver-900/60 text-silver-200 border-silver-700/40',
    SUSPENDED: 'bg-silver-900/40 text-silver-500 border-silver-800/40',
    ARCHIVED:  'bg-brand-near text-silver-700 border-silver-900/40',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    ENTERPRISE: 'bg-navy-800/80 text-silver-200 border-navy-600/50',
    PRO:        'bg-navy-900/70 text-silver-300 border-navy-700/40',
    STANDARD:   'bg-silver-900/40 text-silver-400 border-silver-800/40',
    FREE:       'bg-brand-near text-silver-600 border-silver-900/40',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${styles[tier] || styles.STANDARD}`}>
      {tier}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [confirmSuspendOrg, setConfirmSuspendOrg] = useState<Organisation | null>(null);
  const [editingQuotaOrg, setEditingQuotaOrg] = useState<Organisation | null>(null);

  // Quota form state
  const [quotaTier, setQuotaTier] = useState('STANDARD');
  const [quotaMembers, setQuotaMembers] = useState(50);
  const [quotaVehicles, setQuotaVehicles] = useState(100);
  const [quotaDuties, setQuotaDuties] = useState(1000);

  const { data: orgs = [], isLoading, error, refetch } = useQuery<Organisation[]>({
    queryKey: ['admin-orgs'],
    queryFn: () => apiClient<Organisation[]>('/api/v1/admin/organisations'),
    retry: false,
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      apiClient(`/api/v1/admin/organisations/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orgs'] });
      setConfirmSuspendOrg(null);
    },
  });

  const updateQuotaMutation = useMutation({
    mutationFn: ({ id, quota }: { id: string; quota: Quota }) =>
      apiClient(`/api/v1/admin/organisations/${id}/quota`, {
        method: 'PUT',
        body: JSON.stringify(quota),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orgs'] });
      setEditingQuotaOrg(null);
    },
  });

  const openQuotaModal = (org: Organisation) => {
    setEditingQuotaOrg(org);
    const q = org.quota || {
      tier: 'STANDARD',
      max_members: 50,
      max_vehicles: 100,
      max_duties_per_month: 1000,
    };
    setQuotaTier(q.tier);
    setQuotaMembers(q.max_members);
    setQuotaVehicles(q.max_vehicles);
    setQuotaDuties(q.max_duties_per_month);
  };

  const handleSaveQuota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuotaOrg) return;
    updateQuotaMutation.mutate({
      id: editingQuotaOrg.id,
      quota: {
        tier: quotaTier,
        max_members: Number(quotaMembers),
        max_vehicles: Number(quotaVehicles),
        max_duties_per_month: Number(quotaDuties),
      },
    });
  };

  const filtered = orgs.filter(o => {
    const matchSearch =
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.organisation_type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: orgs.length,
    active: orgs.filter(o => o.status === 'ACTIVE').length,
    suspended: orgs.filter(o => o.status === 'SUSPENDED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tenant Management</h1>
          <p className="mt-0.5 text-sm text-silver-500">
            Multi-tenant organisation directory, quotas, and lifecycle controls.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-xl border border-silver-800 bg-brand-near px-3.5 py-2 text-xs font-medium text-silver-300 hover:bg-silver-900 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Tenants', value: counts.total, icon: Building2 },
          { label: 'Active', value: counts.active, icon: ShieldCheck },
          { label: 'Suspended', value: counts.suspended, icon: ShieldOff },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-silver-900/60 bg-brand-near/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800/60 border border-navy-700/30">
                <Icon className="h-4 w-4 text-silver-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-silver-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-silver-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search organisations by name or type…"
            className="w-full rounded-xl border border-silver-800 bg-brand-near pl-9 pr-4 py-2.5 text-sm text-white placeholder-silver-700 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none rounded-xl border border-silver-800 bg-brand-near px-4 py-2.5 pr-8 text-sm text-silver-300 focus:border-navy-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-silver-600" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-silver-800 bg-silver-900/30 px-4 py-3 text-sm text-silver-300">
          <AlertCircle className="h-4 w-4 text-silver-500 flex-shrink-0" />
          {(error as Error).message}. Verify platform admin credentials.
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-silver-900/60 bg-brand-near/40">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-silver-500 text-sm">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading tenants…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-silver-600">
            <Building2 className="mb-3 h-8 w-8" />
            <p className="text-sm">
              {search || statusFilter !== 'ALL' ? 'No organisations match filters.' : 'No organisations registered yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver-900/60 bg-brand-near/80">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-600">Organisation</th>
                <th className="hidden px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-600 md:table-cell">Type</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-600">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-600">Quota Tier</th>
                <th className="hidden px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-600 lg:table-cell">Created</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-silver-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver-900/40">
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-silver-900/20 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-navy-900/60 border border-navy-800/40 text-xs font-bold text-silver-300">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{org.name}</p>
                        <p className="text-[11px] text-silver-600 font-mono">{org.id.slice(0, 8)}…</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3.5 text-silver-400 md:table-cell">
                    <span className="text-xs">{org.organisation_type}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <TierBadge tier={org.quota?.tier || 'STANDARD'} />
                      <span className="text-[11px] text-silver-500">
                        {org.quota?.max_members ?? 50} users · {org.quota?.max_vehicles ?? 100} veh
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3.5 lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-silver-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(org.created_at)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Quota Button */}
                      <button
                        onClick={() => openQuotaModal(org)}
                        className="inline-flex items-center gap-1 rounded-lg border border-silver-800 bg-brand-near px-2.5 py-1.5 text-xs font-medium text-silver-400 hover:border-silver-700 hover:text-white transition"
                        title="Edit Quotas"
                      >
                        <Sliders className="h-3 w-3" />
                        Quota
                      </button>

                      {/* Suspend / Activate Button */}
                      {org.status === 'ACTIVE' ? (
                        <button
                          onClick={() => setConfirmSuspendOrg(org)}
                          className="inline-flex items-center gap-1 rounded-lg border border-silver-800 bg-brand-near px-2.5 py-1.5 text-xs font-medium text-silver-400 hover:border-silver-700 hover:text-white transition"
                        >
                          <ShieldOff className="h-3 w-3" />
                          Suspend
                        </button>
                      ) : org.status === 'SUSPENDED' ? (
                        <button
                          onClick={() => suspendMutation.mutate({ id: org.id, action: 'activate' })}
                          disabled={suspendMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-navy-700/40 bg-navy-800/40 px-2.5 py-1.5 text-xs font-medium text-silver-300 hover:bg-navy-700/60 transition disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Activate
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quota Management Modal */}
      {editingQuotaOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-silver-900/80 bg-brand-near p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-silver-900/60">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-silver-300" />
                <h3 className="text-base font-semibold text-white">Manage Quotas</h3>
              </div>
              <button
                onClick={() => setEditingQuotaOrg(null)}
                className="text-silver-500 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-silver-400">
              Organisation: <strong className="text-white">{editingQuotaOrg.name}</strong>
            </p>

            <form onSubmit={handleSaveQuota} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-silver-400 mb-1">Service Tier</label>
                <select
                  value={quotaTier}
                  onChange={e => setQuotaTier(e.target.value)}
                  className="w-full rounded-xl border border-silver-800 bg-brand-black px-3.5 py-2.5 text-sm text-white focus:border-navy-500 focus:outline-none"
                >
                  <option value="FREE">FREE</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-silver-400 mb-1">Max Users / Members</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={quotaMembers}
                    onChange={e => setQuotaMembers(Number(e.target.value))}
                    className="w-full rounded-xl border border-silver-800 bg-brand-black px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-silver-400 mb-1">Max Fleet Vehicles</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    value={quotaVehicles}
                    onChange={e => setQuotaVehicles(Number(e.target.value))}
                    className="w-full rounded-xl border border-silver-800 bg-brand-black px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-silver-400 mb-1">Max Monthly Duties</label>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={quotaDuties}
                  onChange={e => setQuotaDuties(Number(e.target.value))}
                  className="w-full rounded-xl border border-silver-800 bg-brand-black px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingQuotaOrg(null)}
                  className="flex-1 rounded-xl border border-silver-800 px-4 py-2.5 text-sm font-medium text-silver-400 hover:bg-silver-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateQuotaMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50 transition"
                >
                  {updateQuotaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {updateQuotaMutation.isPending ? 'Saving…' : 'Save Quotas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend confirm modal */}
      {confirmSuspendOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-silver-900/60 bg-brand-near p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-silver-900/60 border border-silver-800">
              <ShieldOff className="h-5 w-5 text-silver-400" />
            </div>
            <h3 className="text-base font-semibold text-white">Suspend Tenant?</h3>
            <p className="mt-1.5 text-sm text-silver-500">
              This will suspend organisation <strong className="text-white">{confirmSuspendOrg.name}</strong>. Members will be blocked from accessing TMS services until reactivated.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmSuspendOrg(null)}
                className="flex-1 rounded-xl border border-silver-800 px-4 py-2 text-sm font-medium text-silver-400 hover:bg-silver-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => suspendMutation.mutate({ id: confirmSuspendOrg.id, action: 'suspend' })}
                disabled={suspendMutation.isPending}
                className="flex-1 rounded-xl bg-silver-700 px-4 py-2 text-sm font-semibold text-white hover:bg-silver-600 disabled:opacity-50 transition"
              >
                {suspendMutation.isPending ? 'Suspending…' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
