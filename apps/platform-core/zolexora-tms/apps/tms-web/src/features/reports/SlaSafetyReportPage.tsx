import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { Customer } from '../../types';

interface SlaSafetyAuditRow {
  duty_id: string;
  duty_number: string;
  booking_number?: string | null;
  booking_type?: string | null;
  customer_name?: string | null;
  driver_name?: string | null;
  vehicle_registration?: string | null;
  scheduled_start_time: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  delay_minutes?: number | null;
  on_time?: boolean | null;
  escort_required: boolean;
  escort_guard_name?: string | null;
  safe_drop_confirmed_at?: string | null;
  boarded_count: number;
  dropped_count: number;
  no_show_count: number;
  status: string;
}

interface SlaSafetyReportResponse {
  total_duties: number;
  completed_duties: number;
  started_duties: number;
  on_time_start_count: number;
  on_time_start_pct: number;
  escort_required_count: number;
  escort_verified_count: number;
  safe_drop_confirmed_count: number;
  safety_compliance_pct: number;
  total_stops: number;
  boarded_stops: number;
  dropped_stops: number;
  no_show_stops: number;
  rows: SlaSafetyAuditRow[];
}

export function SlaSafetyReportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [bookingType, setBookingType] = useState('ALL');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient<Customer[]>('/api/v1/crm/clients'),
  });

  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', new Date(`${dateFrom}T00:00:00`).toISOString());
  if (dateTo) params.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString());
  if (customerId) params.set('customer_id', customerId);
  if (bookingType !== 'ALL') params.set('booking_type', bookingType);

  const { data: report, isLoading } = useQuery({
    queryKey: ['sla-safety-report', dateFrom, dateTo, customerId, bookingType],
    queryFn: () => apiClient<SlaSafetyReportResponse>(`/api/v1/duties/reports/sla-safety?${params.toString()}`),
  });

  const exportCsv = () => {
    if (!report?.rows.length) return;
    const header = [
      'Duty #', 'Booking #', 'Type', 'Client', 'Driver', 'Cab',
      'Scheduled Start', 'Actual Start', 'Delay (min)', 'On Time (<=15m)',
      'Escort Required', 'Guard Name', 'Safe Drop Confirmed',
      'Boarded', 'Dropped', 'No Show', 'Status',
    ];
    const lines = report.rows.map((r) => [
      r.duty_number,
      r.booking_number || '',
      r.booking_type || '',
      r.customer_name || '',
      r.driver_name || '',
      r.vehicle_registration || '',
      r.scheduled_start_time,
      r.actual_start_time || '',
      r.delay_minutes ?? '',
      r.on_time == null ? '' : r.on_time ? 'YES' : 'NO',
      r.escort_required ? 'YES' : 'NO',
      r.escort_guard_name || '',
      r.safe_drop_confirmed_at || '',
      r.boarded_count,
      r.dropped_count,
      r.no_show_count,
      r.status,
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));

    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zolexora-sla-safety-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Corporate SLA &amp; Night-Shift Safety Audit</h1>
          <p className="text-sm text-slate-400">
            Track on-time cab starts (15m SLA), passenger boarding/no-shows, escort check-ins, and safe-drop confirmations.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!report?.rows.length}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition"
        >
          <Download className="h-4 w-4 text-emerald-400" />
          Export Audit CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400">Corporate Client</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400">Trip Type</label>
          <select
            value={bookingType}
            onChange={(e) => setBookingType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            <option value="ALL">All Types</option>
            <option value="ETS">ETS Shuttle</option>
            <option value="FIXED">Fixed Route</option>
            <option value="CORPORATE">Corporate Cab</option>
            <option value="AIRPORT">Airport Transfer</option>
            <option value="SPOT">Spot</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
          Computing SLA &amp; safety audit metrics...
        </div>
      ) : report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-cyan-300 mb-2">
                <Clock className="h-4 w-4" /> On-Time Start SLA (≤15m)
              </div>
              <div className="text-3xl font-bold text-white">{report.on_time_start_pct}%</div>
              <p className="text-xs text-slate-400 mt-1">
                {report.on_time_start_count} / {report.started_duties} started trips on time
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 mb-2">
                <ShieldCheck className="h-4 w-4" /> Night-Shift Safe-Drop Compliance
              </div>
              <div className="text-3xl font-bold text-white">{report.safety_compliance_pct}%</div>
              <p className="text-xs text-slate-400 mt-1">
                {report.safe_drop_confirmed_count} / {report.escort_required_count} safe drops · {report.escort_verified_count} guards verified
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-300 mb-2">
                <Users className="h-4 w-4" /> Employee Boarding Adherence
              </div>
              <div className="text-3xl font-bold text-white">{report.boarded_stops}</div>
              <p className="text-xs text-slate-400 mt-1">
                {report.dropped_stops} dropped · {report.no_show_stops} no-shows ({report.total_stops} stops)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
                <CheckCircle2 className="h-4 w-4" /> Trip Completion Volume
              </div>
              <div className="text-3xl font-bold text-white">{report.completed_duties}</div>
              <p className="text-xs text-slate-400 mt-1">
                Out of {report.total_duties} active/scheduled duties
              </p>
            </div>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Duty / Type</th>
                  <th className="px-4 py-3">Client / Driver / Cab</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">SLA Variance</th>
                  <th className="px-4 py-3">Night Escort &amp; Safe Drop</th>
                  <th className="px-4 py-3">Stops (B/D/NS)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No duties match the selected filters.
                    </td>
                  </tr>
                ) : report.rows.map((row) => (
                  <tr key={row.duty_id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-white">{row.duty_number}</div>
                      <div className="text-[11px] text-indigo-300">{row.booking_type || '—'} · {row.booking_number || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{row.customer_name || '—'}</div>
                      <div className="text-[11px] text-slate-400">
                        {row.driver_name || 'Unassigned'} {row.vehicle_registration ? `· ${row.vehicle_registration}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(row.scheduled_start_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {row.delay_minutes == null ? (
                        <span className="text-slate-500">Not started</span>
                      ) : row.on_time ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          On Time ({row.delay_minutes >= 0 ? `+${row.delay_minutes}` : row.delay_minutes}m)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                          Delayed +{row.delay_minutes}m
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!row.escort_required ? (
                        <span className="text-slate-500">Day Shift</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-slate-200">
                            Guard: {row.escort_guard_name || <span className="text-rose-400">Pending</span>}
                          </div>
                          {row.safe_drop_confirmed_at ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                              <ShieldCheck className="h-3 w-3" /> Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                              <ShieldAlert className="h-3 w-3" /> Safe-Drop Pending
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {row.boarded_count}/{row.dropped_count}/{row.no_show_count}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
