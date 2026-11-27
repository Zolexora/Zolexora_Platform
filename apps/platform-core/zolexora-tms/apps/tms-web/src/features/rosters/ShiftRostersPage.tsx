import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Play, Plus, Shield, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../lib/api';
import type { Customer, Driver, Vehicle } from '../../types';

interface ShiftRosterItem {
  id: string;
  customer_id: string;
  route_code: string;
  route_name: string;
  booking_type: string;
  shift_label: string;
  shift_time: string;
  duration_minutes: number;
  weekdays: number[];
  pickup_address: string;
  drop_address: string;
  default_driver_id?: string | null;
  default_vehicle_id?: string | null;
  escort_required: boolean;
  active: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ShiftRostersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    route_code: '',
    route_name: '',
    booking_type: 'ETS',
    shift_label: 'Morning Login 09:00',
    shift_time: '09:00',
    duration_minutes: 120,
    weekdays: [0, 1, 2, 3, 4] as number[],
    pickup_address: '',
    drop_address: '',
    default_driver_id: '',
    default_vehicle_id: '',
    escort_required: false,
  });

  const { data: rosters = [], isLoading } = useQuery({
    queryKey: ['rosters'],
    queryFn: () => apiClient<ShiftRosterItem[]>('/api/v1/rosters?active_only=false'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiClient<Customer[]>('/api/v1/crm/clients'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiClient<Driver[]>('/api/v1/drivers'),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiClient<Vehicle[]>('/api/v1/vehicles'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<ShiftRosterItem>('/api/v1/rosters', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id || clients[0]?.id,
          default_driver_id: form.default_driver_id || null,
          default_vehicle_id: form.default_vehicle_id || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
      toast.success('Shift roster template created');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateMutation = useMutation({
    mutationFn: (rosterId: string) =>
      apiClient<{ created_count: number; skipped_count: number }>(
        `/api/v1/rosters/${rosterId}/generate-duties`,
        { method: 'POST', body: JSON.stringify({ days_ahead: 7 }) },
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['duties'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-board'] });
      toast.success(`Generated ${res.created_count} duties (${res.skipped_count} already scheduled)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleDay = (d: number) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(d)
        ? prev.weekdays.filter((x) => x !== d)
        : [...prev.weekdays, d].sort(),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ETS & Fixed Shift Rosters</h1>
          <p className="text-sm text-slate-400">
            Configure recurring employee pickup/drop shifts and auto-generate daily duties.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!form.customer_id && clients[0]) {
              setForm((f) => ({ ...f, customer_id: clients[0].id }));
            }
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
        >
          <Plus className="h-4 w-4" />
          New Shift Roster
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
          Loading shift rosters...
        </div>
      ) : rosters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-2">
          <CalendarClock className="h-9 w-9 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No shift rosters configured yet</p>
          <p className="text-xs text-slate-500">Create a fixed or ETS route template to generate recurring cab duties.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rosters.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono font-bold text-indigo-400 uppercase">{r.route_code} · {r.booking_type}</span>
                  <h2 className="text-base font-bold text-white mt-0.5">{r.route_name}</h2>
                  <p className="text-xs text-slate-400">{r.shift_label} · {r.shift_time}</p>
                </div>
                {r.escort_required && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Shield className="h-3 w-3" /> Escort
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-300 space-y-1 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="truncate"><span className="text-slate-500">From:</span> {r.pickup_address}</div>
                <div className="truncate"><span className="text-slate-500">To:</span> {r.drop_address}</div>
              </div>

              <div className="flex flex-wrap gap-1">
                {r.weekdays.map((w) => (
                  <span key={w} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    {WEEKDAY_LABELS[w] ?? w}
                  </span>
                ))}
              </div>

              <button
                type="button"
                disabled={generateMutation.isPending || !r.active}
                onClick={() => generateMutation.mutate(r.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition"
              >
                <Play className="h-3.5 w-3.5" />
                Generate Next 7 Days
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Create ETS / Fixed Shift Roster</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Corporate Client</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Route Code</label>
                <input
                  value={form.route_code}
                  onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                  placeholder="ETS-BLR-01"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Route Name</label>
                <input
                  value={form.route_name}
                  onChange={(e) => setForm({ ...form, route_name: e.target.value })}
                  placeholder="Whitefield Morning Login"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Shift Time (24h)</label>
                <input
                  value={form.shift_time}
                  onChange={(e) => setForm({ ...form, shift_time: e.target.value })}
                  placeholder="22:00"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">Pickup Address</label>
              <input
                value={form.pickup_address}
                onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Drop Address</label>
              <input
                value={form.drop_address}
                onChange={(e) => setForm({ ...form, drop_address: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Default Driver</label>
                <select
                  value={form.default_driver_id}
                  onChange={(e) => setForm({ ...form, default_driver_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Default Cab / Vehicle</label>
                <select
                  value={form.default_vehicle_id}
                  onChange={(e) => setForm({ ...form, default_vehicle_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">Unassigned</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registration_number}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Operating Days</label>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((lbl, idx) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                      form.weekdays.includes(idx)
                        ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.escort_required}
                onChange={(e) => setForm({ ...form, escort_required: e.target.checked })}
              />
              Require night-shift escort guard & safe-drop confirmation
            </label>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {createMutation.isPending ? 'Creating...' : 'Save Roster Template'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
