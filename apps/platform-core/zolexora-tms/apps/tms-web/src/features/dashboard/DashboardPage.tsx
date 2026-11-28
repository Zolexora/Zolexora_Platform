import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  CalendarCheck,
  ClipboardList,
  Radio,
  Users,
  Building2,
  ArrowRight,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { useAuth } from '../auth/useAuth';
import type {
  Booking,
  BookingRequest,
  Customer,
  Driver,
  Duty,
  DutyLifecycleStatus,
  Vehicle,
} from '../../types';

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

export function DashboardPage() {
  const { organisation, authMe, isCommander } = useAuth();

  const { data: duties = [], isLoading: dutiesLoading } = useQuery({
    queryKey: ['duties'],
    queryFn: () => apiClient<Duty[]>('/api/v1/duties?limit=200'),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiClient<Booking[]>('/api/v1/bookings?limit=200'),
  });

  const { data: bookingRequests = [] } = useQuery({
    queryKey: ['booking-requests'],
    queryFn: () => apiClient<BookingRequest[]>('/api/v1/booking-requests?limit=200'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiClient<Vehicle[]>('/api/v1/vehicles'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiClient<Driver[]>('/api/v1/drivers'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient<Customer[]>('/api/v1/crm/clients'),
  });

  // Live operational counts
  const activeDuties = duties.filter(
    (d) => d.status !== 'DUTY_COMPLETED' && d.status !== 'CANCELLED'
  );
  const unassignedDuties = activeDuties.filter((d) => d.status === 'UNASSIGNED');
  const liveOnRoadDuties = duties.filter((d) =>
    ['ARRIVED_PICKUP', 'IN_TRANSIT', 'ARRIVED_DROP'].includes(d.status)
  );
  const completedDutiesCount = duties.filter((d) => d.status === 'DUTY_COMPLETED').length;

  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'ACTIVE').length;
  const availableDrivers = drivers.filter((d) => d.status === 'AVAILABLE').length;
  const onDutyDrivers = drivers.filter((d) => d.status === 'ON_DUTY').length;

  const pendingRequests = bookingRequests.filter(
    (r) => r.status === 'DRAFT' || r.status === 'REQUESTED'
  );
  const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED').length;

  const recentActiveDuties = activeDuties.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-navy-600/20 bg-gradient-to-r from-navy-950/60 via-slate-900/60 to-slate-900/60 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-navy-600/20 px-3 py-1 text-xs font-semibold text-silver-400 border border-navy-600/30">
                Operations Control
              </span>
              {isCommander && (
                <span className="rounded-full bg-silver-900/40 px-3 py-1 text-xs font-semibold text-silver-400 border border-silver-700/30">
                  Commander Clearance
                </span>
              )}
              {unassignedDuties.length > 0 && (
                <Link
                  to="/sp/duties"
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition"
                >
                  <Clock className="h-3 w-3" />
                  {unassignedDuties.length} {unassignedDuties.length === 1 ? 'duty needs' : 'duties need'} crew
                </Link>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {organisation?.name || 'Transport Operations Control'}
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Live overview of bookings, duty crew allocation, fleet readiness, and active road dispatches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/sp/bookings"
              className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-800/30 hover:bg-navy-500 transition"
            >
              <Plus className="h-4 w-4" />
              New Booking
            </Link>
            <Link
              to="/sp/dispatch"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <Radio className="h-4 w-4 text-emerald-400" />
              Dispatch Tower
            </Link>
          </div>
        </div>
      </div>

      {/* Live KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/sp/duties"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Duties</span>
            <div className="rounded-lg bg-navy-800/40 p-2 text-silver-400">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{activeDuties.length}</span>
            <span className="text-xs text-slate-500">in pipeline</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={unassignedDuties.length > 0 ? 'text-amber-300' : 'text-slate-400'}>
              {unassignedDuties.length} awaiting crew
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-white transition" />
          </div>
        </Link>

        <Link
          to="/sp/dispatch"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Live On Road</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Radio className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{liveOnRoadDuties.length}</span>
            <span className="text-xs text-slate-500">active trips</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{completedDutiesCount} completed total</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-white transition" />
          </div>
        </Link>

        <Link
          to="/sp/compliance/vehicles"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Fleet Vehicles</span>
            <div className="rounded-lg bg-navy-800/60 p-2 text-navy-300">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{vehicles.length}</span>
            <span className="text-xs text-slate-500">registered</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{availableVehicles} ready / available</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-white transition" />
          </div>
        </Link>

        <Link
          to="/sp/compliance/drivers"
          className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Drivers</span>
            <div className="rounded-lg bg-navy-800/40 p-2 text-silver-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{drivers.length}</span>
            <span className="text-xs text-slate-500">enrolled</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{availableDrivers} available · {onDutyDrivers} on duty</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-white transition" />
          </div>
        </Link>
      </div>

      {/* Main Operational Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Duty Queue */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Active Duty Queue</h2>
              <p className="text-xs text-slate-400">
                Upcoming and in-progress duties across your fleet.
              </p>
            </div>
            <Link
              to="/sp/duties"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Manage Duties
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {pendingRequests.length > 0 && (
            <Link
              to="/sp/bookings"
              className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 hover:bg-amber-500/15 transition"
            >
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-amber-300 shrink-0" />
                <span>
                  <strong>{pendingRequests.length}</strong> pending booking{' '}
                  {pendingRequests.length === 1 ? 'request' : 'requests'} awaiting confirmation
                </span>
              </div>
              <span className="font-semibold underline">Review</span>
            </Link>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Duty / Client</th>
                  <th className="px-4 py-3">Crew &amp; Vehicle</th>
                  <th className="px-4 py-3">Pickup</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dutiesLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Loading active duties...
                    </td>
                  </tr>
                ) : recentActiveDuties.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-slate-600 mb-2" />
                      No active duties right now. Create a booking to schedule a duty.
                    </td>
                  </tr>
                ) : (
                  recentActiveDuties.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-white">{d.duty_number}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {d.booking?.customer_name || d.booking?.booking_number || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className={`h-3 w-3 ${d.driver ? 'text-silver-300' : 'text-amber-400'}`} />
                          <span className={d.driver ? 'text-slate-200' : 'text-amber-300 italic'}>
                            {d.driver?.full_name || 'Unassigned'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                          <Truck className="h-3 w-3 text-slate-500" />
                          <span>{d.vehicle?.registration_number || 'No vehicle'}</span>
                          {d.supervisor_name && (
                            <span className="inline-flex items-center gap-1 text-indigo-300 font-sans">
                              · <UserCog className="h-3 w-3" /> {d.supervisor_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(d.scheduled_start_time).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${dutyStatusClass(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Summary & Quick Access */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Operations Snapshot</h2>
            <div className="space-y-3 text-sm">
              <Link
                to="/sp/compliance/customers"
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5 hover:border-slate-700 transition"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Clients
                </span>
                <span className="font-mono font-semibold text-white">{customers.length}</span>
              </Link>
              <Link
                to="/sp/bookings"
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5 hover:border-slate-700 transition"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <CalendarCheck className="h-4 w-4 text-slate-400" />
                  Confirmed Bookings
                </span>
                <span className="font-mono font-semibold text-white">{confirmedBookings}</span>
              </Link>
              <Link
                to="/sp/bookings"
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5 hover:border-slate-700 transition"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Pending Requests
                </span>
                <span className="font-mono font-semibold text-white">{pendingRequests.length}</span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <AlertCircle className="h-4 w-4 text-silver-400" />
              Workspace Isolation
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[11px] text-slate-500">Status</div>
                <div className="font-semibold text-silver-300">{organisation?.status || 'ACTIVE'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Role</div>
                <div className="font-semibold text-slate-200">{authMe?.role_code || 'MEMBER'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Permissions</div>
                <div className="font-mono text-slate-300">{authMe?.permissions?.length || 0} granted</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Tenant ID</div>
                <div className="font-mono text-slate-400">
                  {organisation?.id ? organisation.id.substring(0, 8) : '...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
