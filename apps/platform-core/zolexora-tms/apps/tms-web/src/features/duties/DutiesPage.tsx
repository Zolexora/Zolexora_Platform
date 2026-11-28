import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  AlertCircle,
  X,
  UserCheck,
  Truck,
  Send,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Download,
  ArrowRight,
  UserCog,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { listCentralMembers, type CentralMember } from '../../lib/authServiceApi';
import { useAuth } from '../auth/useAuth';
import type {
  Duty,
  DutyAssignRequest,
  DutyLifecycleStatus,
  Driver,
  Vehicle,
} from '../../types';

// ── CSV Export ───────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Duty #', 'Booking #', 'Client', 'Status',
  'Driver', 'Driver Phone', 'Vehicle',
  'Supervisor', 'Supervisor Phone',
  'Scheduled Start', 'Scheduled End', 'Notes',
];

function escapeCsvField(val: string | number | undefined): string {
  const s = val !== undefined && val !== null ? String(val) : '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadDutiesCSV(rows: Duty[], filename = 'duties_export.csv') {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const d of rows) {
    lines.push([
      d.duty_number,
      d.booking?.booking_number || d.booking_id,
      d.booking?.customer_name || '',
      d.status,
      d.driver?.full_name || '',
      d.driver?.phone || '',
      d.vehicle?.registration_number || '',
      d.supervisor_name || '',
      d.supervisor_phone || '',
      new Date(d.scheduled_start_time).toLocaleString('en-IN'),
      new Date(d.scheduled_end_time).toLocaleString('en-IN'),
      d.notes || '',
    ].map(escapeCsvField).join(','));
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dutyStatusClass(status: DutyLifecycleStatus): string {
  switch (status) {
    case 'UNASSIGNED':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    case 'ASSIGNED':
    case 'ALLOCATED':
    case 'DRIVER_ACCEPTANCE_PENDING':
      return 'bg-silver-900/30 text-silver-400 border border-silver-700/20';
    case 'ACCEPTED':
    case 'DISPATCHED':
      return 'bg-navy-800/40 text-silver-300 border border-navy-600/30';
    case 'ARRIVED_PICKUP':
    case 'IN_TRANSIT':
    case 'ARRIVED_DROP':
      return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30';
    case 'DUTY_COMPLETED':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    default:
      return 'bg-slate-700/20 text-slate-400';
  }
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Unassigned', value: 'UNASSIGNED' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Dispatched', value: 'DISPATCHED' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Completed', value: 'DUTY_COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const ASSIGNABLE_STATUSES = new Set<DutyLifecycleStatus>([
  'UNASSIGNED',
  'ASSIGNED',
  'ALLOCATED',
  'DRIVER_ACCEPTANCE_PENDING',
]);

// ── Main Component ───────────────────────────────────────────────────────────

export function DutiesPage() {
  const queryClient = useQueryClient();
  const { zolexoraOrgId } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDuty, setSelectedDuty] = useState<Duty | null>(null);
  const [viewDuty, setViewDuty] = useState<Duty | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [assignmentForm, setAssignmentForm] = useState<DutyAssignRequest>({
    driver_id: '',
    vehicle_id: '',
    supervisor_id: '',
    supervisor_name: '',
    supervisor_phone: '',
  });
  const [supervisorMode, setSupervisorMode] = useState<'member' | 'custom'>('member');

  // Fetch Duties
  const { data: duties, isLoading: isDutiesLoading } = useQuery({
    queryKey: ['duties'],
    queryFn: () => apiClient<Duty[]>('/api/v1/duties?limit=200'),
  });

  // Fetch Drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiClient<Driver[]>('/api/v1/drivers'),
  });

  // Fetch Vehicles
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiClient<Vehicle[]>('/api/v1/vehicles'),
  });

  // Fetch Organisation Members (for Supervisor selection)
  const { data: members = [] } = useQuery({
    queryKey: ['central-members', zolexoraOrgId],
    queryFn: () => listCentralMembers(zolexoraOrgId!),
    enabled: !!zolexoraOrgId,
  });

  const activeMembers = members.filter((m) => m.status === 'active');

  // Assign Driver, Vehicle & Supervisor Mutation
  const assignMutation = useMutation({
    mutationFn: ({ dutyId, data }: { dutyId: string; data: DutyAssignRequest }) =>
      apiClient<Duty>(`/api/v1/duties/${dutyId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          driver_id: data.driver_id,
          vehicle_id: data.vehicle_id,
          supervisor_id: data.supervisor_id || undefined,
          supervisor_name: data.supervisor_name?.trim() || undefined,
          supervisor_phone: data.supervisor_phone?.trim() || undefined,
        }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['duties'] });
      setIsAssignModalOpen(false);
      setSelectedDuty(null);
      setFormError('');
      if (viewDuty?.id === updated.id) setViewDuty(updated);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // Dispatch Duty Mutation
  const dispatchMutation = useMutation({
    mutationFn: (dutyId: string) =>
      apiClient<Duty>(`/api/v1/duties/${dutyId}/dispatch`, { method: 'POST' }),
    onSuccess: (updated) => {
      setActionError('');
      queryClient.invalidateQueries({ queryKey: ['duties'] });
      if (viewDuty?.id === updated.id) setViewDuty(updated);
    },
    onError: (err: Error) => setActionError(`Failed to dispatch duty: ${err.message}`),
  });

  // Driver Accept Mutation
  const acceptMutation = useMutation({
    mutationFn: (dutyId: string) =>
      apiClient<Duty>(`/api/v1/duties/${dutyId}/accept`, { method: 'POST' }),
    onSuccess: (updated) => {
      setActionError('');
      queryClient.invalidateQueries({ queryKey: ['duties'] });
      if (viewDuty?.id === updated.id) setViewDuty(updated);
    },
    onError: (err: Error) => setActionError(`Error accepting duty: ${err.message}`),
  });

  const openAssignModal = (d: Duty) => {
    setSelectedDuty(d);
    const matchedMember = d.supervisor_id
      ? activeMembers.find((m) => m.id === d.supervisor_id || m.user_id === d.supervisor_id)
      : undefined;
    const useCustom = Boolean(!matchedMember && (d.supervisor_name || activeMembers.length === 0));
    setSupervisorMode(useCustom ? 'custom' : 'member');
    setAssignmentForm({
      driver_id: d.driver_id || '',
      vehicle_id: d.vehicle_id || '',
      supervisor_id: matchedMember ? (matchedMember.user_id || matchedMember.id) : (d.supervisor_id || ''),
      supervisor_name: d.supervisor_name || '',
      supervisor_phone: d.supervisor_phone || '',
    });
    setFormError('');
    setIsAssignModalOpen(true);
  };

  const handleMemberSelect = (memberIdOrUserId: string) => {
    if (!memberIdOrUserId) {
      setAssignmentForm((prev) => ({ ...prev, supervisor_id: '', supervisor_name: '', supervisor_phone: '' }));
      return;
    }
    const m: CentralMember | undefined = activeMembers.find(
      (mem) => (mem.user_id || mem.id) === memberIdOrUserId || mem.id === memberIdOrUserId
    );
    if (m) {
      setAssignmentForm((prev) => ({
        ...prev,
        supervisor_id: m.user_id || m.id,
        supervisor_name: m.display_name || m.email || m.phone_number || 'Supervisor',
        supervisor_phone: m.phone_number || '',
      }));
    }
  };

  const getDriverLabel = (d: Duty) => {
    if (d.driver) return `${d.driver.full_name} (${d.driver.phone})`;
    if (!d.driver_id) return 'Unassigned';
    const drv = drivers?.find((x) => x.id === d.driver_id);
    return drv ? `${drv.full_name} (${drv.phone})` : d.driver_id.slice(0, 8);
  };

  const getVehicleLabel = (d: Duty) => {
    if (d.vehicle) return d.vehicle.registration_number;
    if (!d.vehicle_id) return 'Unassigned';
    const veh = vehicles?.find((x) => x.id === d.vehicle_id);
    return veh ? `${veh.registration_number} (${veh.vehicle_type})` : d.vehicle_id.slice(0, 8);
  };

  const filteredDuties = duties?.filter((duty) => {
    const matchStatus = statusFilter === 'ALL' || duty.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (
      duty.duty_number.toLowerCase().includes(q) ||
      (duty.booking?.booking_number || '').toLowerCase().includes(q) ||
      (duty.booking?.customer_name || '').toLowerCase().includes(q) ||
      (duty.driver?.full_name || '').toLowerCase().includes(q) ||
      (duty.vehicle?.registration_number || '').toLowerCase().includes(q) ||
      (duty.supervisor_name || '').toLowerCase().includes(q)
    );
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Duty Management &amp; Allocation</h1>
          <p className="text-sm text-slate-400">
            Assign drivers, vehicles, and trip supervisors, then dispatch duties.
          </p>
        </div>
        <button
          onClick={() => {
            if (!duties || duties.length === 0) return;
            downloadDutiesCSV(filteredDuties || duties);
          }}
          disabled={!duties || duties.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed self-start"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Inline action error */}
      {actionError && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                statusFilter === f.value
                  ? 'bg-navy-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.label}
              {duties && (
                <span className="ml-1.5 opacity-70">
                  ({f.value === 'ALL' ? duties.length : duties.filter((d) => d.status === f.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-xs w-full">
          <Search className="h-4 w-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search duty, booking, driver, supervisor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Duties Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Duty &amp; Booking</th>
              <th className="px-5 py-3.5">Driver &amp; Vehicle</th>
              <th className="px-5 py-3.5">Supervisor</th>
              <th className="px-5 py-3.5">Scheduled Window</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isDutiesLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  Loading transport duties...
                </td>
              </tr>
            ) : filteredDuties?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  <ClipboardList className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                  No duty rosters matching filter.
                </td>
              </tr>
            ) : (
              filteredDuties?.map((duty) => (
                <tr key={duty.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-mono font-semibold text-white">{duty.duty_number}</div>
                    {duty.booking && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        <span className="font-mono text-silver-400">{duty.booking.booking_number}</span>
                        {duty.booking.customer_name && ` · ${duty.booking.customer_name}`}
                      </div>
                    )}
                    {duty.notes && (
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">{duty.notes}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-200">
                      <UserCheck className={`h-3.5 w-3.5 shrink-0 ${duty.driver_id ? 'text-silver-300' : 'text-slate-600'}`} />
                      <span className={duty.driver_id ? '' : 'text-slate-500 italic'}>{getDriverLabel(duty)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                      <Truck className={`h-3.5 w-3.5 shrink-0 ${duty.vehicle_id ? 'text-silver-400' : 'text-slate-600'}`} />
                      <span className={duty.vehicle_id ? '' : 'text-slate-500 italic font-sans'}>{getVehicleLabel(duty)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    {duty.supervisor_name ? (
                      <div className="flex items-start gap-1.5">
                        <UserCog className="h-3.5 w-3.5 text-indigo-300 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-slate-200 font-medium">{duty.supervisor_name}</div>
                          {duty.supervisor_phone && (
                            <div className="text-slate-500 font-mono text-[11px]">{duty.supervisor_phone}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Not assigned</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    <div>{new Date(duty.scheduled_start_time).toLocaleString('en-IN')}</div>
                    <div className="text-slate-500">to {new Date(duty.scheduled_end_time).toLocaleTimeString('en-IN')}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${dutyStatusClass(duty.status)}`}>
                      {duty.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewDuty(duty)}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                        title="View duty details"
                      >
                        <Eye className="h-3.5 w-3.5 text-silver-300" />
                        View
                      </button>
                      {ASSIGNABLE_STATUSES.has(duty.status) && (
                        <>
                          <button
                            onClick={() => openAssignModal(duty)}
                            className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
                          >
                            {duty.driver_id && duty.vehicle_id ? 'Reallocate' : 'Allocate'}
                          </button>
                          {duty.driver_id && duty.vehicle_id && (
                            <button
                              onClick={() => dispatchMutation.mutate(duty.id)}
                              disabled={dispatchMutation.isPending}
                              className="inline-flex items-center gap-1 rounded bg-navy-600/20 border border-navy-600/30 px-2.5 py-1 text-xs font-semibold text-silver-300 hover:bg-navy-600 hover:text-white transition"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Dispatch
                            </button>
                          )}
                        </>
                      )}
                      {duty.status === 'DISPATCHED' && (
                        <button
                          onClick={() => acceptMutation.mutate(duty.id)}
                          disabled={acceptMutation.isPending}
                          className="inline-flex items-center gap-1 rounded bg-silver-800/40 border border-silver-700/40 px-2.5 py-1 text-xs font-semibold text-silver-300 hover:bg-navy-600 hover:text-white transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── View Duty Detail Modal ─────────────────────────────────────────── */}
      {viewDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white font-mono">{viewDuty.duty_number}</h2>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${dutyStatusClass(viewDuty.status)}`}>
                    {viewDuty.status}
                  </span>
                </div>
                {viewDuty.booking && (
                  <p className="text-xs text-slate-400 mt-1">
                    Booking <span className="font-mono text-silver-300">{viewDuty.booking.booking_number}</span>
                    {viewDuty.booking.customer_name && ` · ${viewDuty.booking.customer_name}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadDutiesCSV([viewDuty], `duty_${viewDuty.duty_number}.csv`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
                <button onClick={() => setViewDuty(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {/* Allocation Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Crew &amp; Fleet</h3>
                <div>
                  <div className="text-[11px] text-slate-500">Driver</div>
                  <div className="text-white text-xs font-medium">{getDriverLabel(viewDuty)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Vehicle</div>
                  <div className="text-white font-mono text-xs">{getVehicleLabel(viewDuty)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Supervisor</div>
                  {viewDuty.supervisor_name ? (
                    <div className="text-indigo-300 text-xs font-medium">
                      {viewDuty.supervisor_name}
                      {viewDuty.supervisor_phone && <span className="text-slate-400 font-mono"> · {viewDuty.supervisor_phone}</span>}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">Not assigned</div>
                  )}
                </div>
              </div>

              {/* Schedule & Route Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Schedule &amp; Route</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500">Start</div>
                    <div className="text-white text-xs">{new Date(viewDuty.scheduled_start_time).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">End</div>
                    <div className="text-white text-xs">{new Date(viewDuty.scheduled_end_time).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {viewDuty.booking && (
                  <div>
                    <div className="text-[11px] text-slate-500">Route</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-200 mt-0.5">
                      <span>{viewDuty.booking.pickup_address}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" />
                      <span className="text-slate-400">{viewDuty.booking.drop_address}</span>
                    </div>
                  </div>
                )}
                {viewDuty.notes && (
                  <div>
                    <div className="text-[11px] text-slate-500">Notes</div>
                    <div className="text-xs text-slate-300">{viewDuty.notes}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              {ASSIGNABLE_STATUSES.has(viewDuty.status) && (
                <button
                  onClick={() => openAssignModal(viewDuty)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                >
                  <ShieldCheck className="h-4 w-4 text-silver-300" />
                  {viewDuty.driver_id && viewDuty.vehicle_id ? 'Reallocate Crew' : 'Allocate Crew'}
                </button>
              )}
              <button
                onClick={() => setViewDuty(null)}
                className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocation Modal (Driver, Vehicle & Supervisor) ────────────────── */}
      {isAssignModalOpen && selectedDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Allocate Driver, Vehicle &amp; Supervisor</h3>
                <p className="text-xs text-slate-400">
                  Duty <span className="font-mono text-silver-400 font-semibold">{selectedDuty.duty_number}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignMutation.mutate({
                  dutyId: selectedDuty.id,
                  data: assignmentForm,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Driver *</label>
                <select
                  required
                  value={assignmentForm.driver_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, driver_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                >
                  <option value="">Select an enrolled driver...</option>
                  {drivers?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} — {d.license_number} ({d.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Vehicle *</label>
                <select
                  required
                  value={assignmentForm.vehicle_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, vehicle_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                >
                  <option value="">Select a fleet vehicle...</option>
                  {vehicles?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_number} — {v.vehicle_type} ({v.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Supervisor Section */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                    <UserCog className="h-3.5 w-3.5" />
                    Supervisor (Optional)
                  </span>
                  {activeMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = supervisorMode === 'member' ? 'custom' : 'member';
                        setSupervisorMode(nextMode);
                        if (nextMode === 'custom') {
                          setAssignmentForm((prev) => ({ ...prev, supervisor_id: '' }));
                        }
                      }}
                      className="text-[11px] font-medium text-slate-400 hover:text-white underline"
                    >
                      {supervisorMode === 'member' ? 'Enter manually' : 'Pick from team'}
                    </button>
                  )}
                </div>

                {supervisorMode === 'member' && activeMembers.length > 0 ? (
                  <div>
                    <select
                      value={assignmentForm.supervisor_id || ''}
                      onChange={(e) => handleMemberSelect(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                    >
                      <option value="">No supervisor assigned</option>
                      {activeMembers.map((m) => {
                        const val = m.user_id || m.id;
                        const label = m.display_name || m.email || m.phone_number || m.zolexora_id;
                        const roleTag = m.roles?.[0]?.name ? ` · ${m.roles[0].name}` : '';
                        return (
                          <option key={m.id} value={val}>
                            {label}{roleTag}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Supervisor Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Verma"
                        value={assignmentForm.supervisor_name || ''}
                        onChange={(e) =>
                          setAssignmentForm({ ...assignmentForm, supervisor_id: '', supervisor_name: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Supervisor Phone</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={assignmentForm.supervisor_phone || ''}
                        onChange={(e) =>
                          setAssignmentForm({ ...assignmentForm, supervisor_phone: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-silver-500" />
                  Compliance &amp; Conflict Prevention
                </div>
                Checks driver commercial license validity and rejects overlapping duty assignments for drivers and vehicles.
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignMutation.isPending}
                  className="rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Verifying & Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
