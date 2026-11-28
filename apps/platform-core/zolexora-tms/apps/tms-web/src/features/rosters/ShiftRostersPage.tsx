import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Edit3, MapPin, Play, Plus, Shield, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../lib/api';
import type { Customer, Driver, Vehicle } from '../../types';

interface RosterStop {
  seq: number;
  stop_type: 'PICKUP' | 'DROP';
  address: string;
  lat?: number | null;
  lng?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  employee_id?: string | null;
  boarding_pin?: string | null;
}

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
  stops?: RosterStop[];
  escort_required: boolean;
  active: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SAMPLE_CSV = `route_code,route_name,shift_label,shift_time,weekdays,stop_type,employee_name,employee_id,phone,address,lat,lng,drop_address
ETS-BLR-101,Electronic City Night Drop,Night Logout 22:30,22:30,"Mon,Tue,Wed,Thu,Fri",PICKUP,Ananya Rao,EMP102,+919876543210,Wipro Gate Electronic City Phase 1,12.8452,77.6602,HSR Layout Sector 2
ETS-BLR-101,Electronic City Night Drop,Night Logout 22:30,22:30,"Mon,Tue,Wed,Thu,Fri",PICKUP,Rohan Verma,EMP145,+919876543211,Silk Board Junction,12.9177,77.6238,HSR Layout Sector 2
ETS-BLR-101,Electronic City Night Drop,Night Logout 22:30,22:30,"Mon,Tue,Wed,Thu,Fri",DROP,Meera Nair,EMP188,+919876543212,HSR Layout Sector 2,12.9121,77.6446,HSR Layout Sector 2`;

const EMPTY_FORM = {
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
  stops: [] as RosterStop[],
};

export function ShiftRostersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRosterId, setEditingRosterId] = useState<string | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvCustomerId, setCsvCustomerId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });

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

  const saveMutation = useMutation({
    mutationFn: () => {
      const normalizedStops = form.stops
        .filter((s) => s.address.trim().length >= 3)
        .map((s, idx) => ({
          ...s,
          seq: idx + 1,
          address: s.address.trim(),
          contact_name: s.contact_name?.trim() || null,
          employee_id: s.employee_id?.trim() || null,
          contact_phone: s.contact_phone?.trim() || null,
        }));

      if (editingRosterId) {
        return apiClient<ShiftRosterItem>(`/api/v1/rosters/${editingRosterId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            route_name: form.route_name,
            shift_label: form.shift_label,
            shift_time: form.shift_time,
            weekdays: form.weekdays,
            default_driver_id: form.default_driver_id || null,
            default_vehicle_id: form.default_vehicle_id || null,
            escort_required: form.escort_required,
            stops: normalizedStops,
          }),
        });
      }

      return apiClient<ShiftRosterItem>('/api/v1/rosters', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id || clients[0]?.id,
          default_driver_id: form.default_driver_id || null,
          default_vehicle_id: form.default_vehicle_id || null,
          stops: normalizedStops,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
      toast.success(editingRosterId ? 'Shift roster updated' : 'Shift roster template created');
      setModalOpen(false);
      setEditingRosterId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const csvImportMutation = useMutation({
    mutationFn: () =>
      apiClient<{ created_rosters: number; updated_rosters: number; total_stops: number }>(
        '/api/v1/rosters/import-csv',
        {
          method: 'POST',
          body: JSON.stringify({
            customer_id: csvCustomerId || clients[0]?.id,
            csv_text: csvText,
            update_existing: true,
          }),
        },
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rosters'] });
      toast.success(
        `Imported ${res.total_stops} stops across ${res.created_rosters} new + ${res.updated_rosters} updated rosters`,
      );
      setCsvModalOpen(false);
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

  const openCreateModal = () => {
    setEditingRosterId(null);
    setForm({ ...EMPTY_FORM, customer_id: clients[0]?.id || '' });
    setModalOpen(true);
  };

  const openEditModal = (r: ShiftRosterItem) => {
    setEditingRosterId(r.id);
    setForm({
      customer_id: r.customer_id,
      route_code: r.route_code,
      route_name: r.route_name,
      booking_type: r.booking_type,
      shift_label: r.shift_label,
      shift_time: r.shift_time,
      duration_minutes: r.duration_minutes,
      weekdays: r.weekdays || [0, 1, 2, 3, 4],
      pickup_address: r.pickup_address,
      drop_address: r.drop_address,
      default_driver_id: r.default_driver_id || '',
      default_vehicle_id: r.default_vehicle_id || '',
      escort_required: r.escort_required,
      stops: (r.stops || []).map((s, idx) => ({ ...s, seq: s.seq || idx + 1 })),
    });
    setModalOpen(true);
  };

  const toggleDay = (d: number) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(d)
        ? prev.weekdays.filter((x) => x !== d)
        : [...prev.weekdays, d].sort(),
    }));
  };

  const addStopRow = () => {
    setForm((prev) => ({
      ...prev,
      stops: [
        ...prev.stops,
        {
          seq: prev.stops.length + 1,
          stop_type: 'PICKUP',
          address: '',
          contact_name: '',
          employee_id: '',
          contact_phone: '',
        },
      ],
    }));
  };

  const updateStopRow = (index: number, patch: Partial<RosterStop>) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.map((st, idx) => (idx === index ? { ...st, ...patch } : st)),
    }));
  };

  const removeStopRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.filter((_, idx) => idx !== index).map((st, idx) => ({ ...st, seq: idx + 1 })),
    }));
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ETS &amp; Fixed Shift Rosters</h1>
          <p className="text-sm text-slate-400">
            Configure recurring employee pickup/drop shifts, multi-stop passenger manifests, and bulk CSV imports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!csvCustomerId && clients[0]) setCsvCustomerId(clients[0].id);
              setCsvModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <Upload className="h-4 w-4 text-cyan-400" />
            Bulk Import CSV
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            <Plus className="h-4 w-4" />
            New Shift Roster
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-sm text-slate-400">
          Loading shift rosters...
        </div>
      ) : rosters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-2">
          <CalendarClock className="h-9 w-9 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No shift rosters configured yet</p>
          <p className="text-xs text-slate-500">Create a fixed/ETS route template or bulk-import employee stops from CSV.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rosters.map((r) => {
            const stops = r.stops || [];
            return (
              <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-indigo-400 uppercase">{r.route_code} · {r.booking_type}</span>
                      <h2 className="text-base font-bold text-white mt-0.5">{r.route_name}</h2>
                      <p className="text-xs text-slate-400">{r.shift_label} · {r.shift_time}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.escort_required && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                          <Shield className="h-3 w-3" /> Escort
                        </span>
                      )}
                      {stops.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                          <MapPin className="h-3 w-3" /> {stops.length} stops
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="truncate"><span className="text-slate-500">From:</span> {r.pickup_address}</div>
                    <div className="truncate"><span className="text-slate-500">To:</span> {r.drop_address}</div>
                  </div>

                  {stops.length > 0 && (
                    <div className="space-y-1 rounded-xl border border-slate-800/70 bg-slate-950/30 p-2.5 text-[11px]">
                      {stops.slice(0, 3).map((st) => (
                        <div key={st.seq} className="flex items-center justify-between gap-2 text-slate-300 truncate">
                          <span className="truncate">
                            <span className="font-mono text-slate-500">#{st.seq}</span>{' '}
                            <span className={st.stop_type === 'PICKUP' ? 'text-emerald-400 font-semibold' : 'text-blue-400 font-semibold'}>
                              {st.stop_type}
                            </span>{' '}
                            {st.contact_name ? `${st.contact_name} · ` : ''}{st.address}
                          </span>
                          {st.employee_id && (
                            <span className="shrink-0 font-mono text-[10px] text-slate-500">{st.employee_id}</span>
                          )}
                        </div>
                      ))}
                      {stops.length > 3 && (
                        <div className="text-[10px] text-slate-500">+{stops.length - 3} more employee stops</div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {r.weekdays.map((w) => (
                      <span key={w} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {WEEKDAY_LABELS[w] ?? w}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={generateMutation.isPending || !r.active}
                    onClick={() => generateMutation.mutate(r.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Generate 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(r)}
                    title="Edit roster & employee stops"
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Stops
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Shift Roster & Employee Stops */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingRosterId ? `Edit Roster ${form.route_code}` : 'Create ETS / Fixed Shift Roster'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Corporate Client</label>
                <select
                  value={form.customer_id}
                  disabled={Boolean(editingRosterId)}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
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
                  disabled={Boolean(editingRosterId)}
                  onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                  placeholder="ETS-BLR-01"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
                <label className="text-xs text-slate-400">Shift Label</label>
                <input
                  value={form.shift_label}
                  onChange={(e) => setForm({ ...form, shift_label: e.target.value })}
                  placeholder="Morning Login 09:00"
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

            {!editingRosterId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Origin / Hub Pickup Address</label>
                  <input
                    value={form.pickup_address}
                    onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Destination / Office Hub Address</label>
                  <input
                    value={form.drop_address}
                    onChange={(e) => setForm({ ...form, drop_address: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    required
                  />
                </div>
              </div>
            )}

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

            {/* Ordered Employee Stops Builder */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300">
                  Ordered Employee Pickup / Drop Stops ({form.stops.length})
                </span>
                <button
                  type="button"
                  onClick={addStopRow}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20"
                >
                  <Plus className="h-3 w-3" /> Add Stop
                </button>
              </div>

              {form.stops.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Optional: add sequential employee pickup/drop stops. Each PICKUP stop gets an auto-generated 4-digit boarding PIN per daily trip.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.stops.map((st, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                      <select
                        value={st.stop_type}
                        onChange={(e) => updateStopRow(idx, { stop_type: e.target.value as 'PICKUP' | 'DROP' })}
                        className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value="PICKUP">PICKUP</option>
                        <option value="DROP">DROP</option>
                      </select>
                      <input
                        placeholder="Employee Name"
                        value={st.contact_name || ''}
                        onChange={(e) => updateStopRow(idx, { contact_name: e.target.value })}
                        className="col-span-3 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                      />
                      <input
                        placeholder="Emp ID"
                        value={st.employee_id || ''}
                        onChange={(e) => updateStopRow(idx, { employee_id: e.target.value })}
                        className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                      />
                      <input
                        placeholder="Mobile"
                        value={st.contact_phone || ''}
                        onChange={(e) => updateStopRow(idx, { contact_phone: e.target.value })}
                        className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                      />
                      <input
                        placeholder="Pickup/Drop Address *"
                        value={st.address}
                        onChange={(e) => updateStopRow(idx, { address: e.target.value })}
                        className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeStopRow(idx)}
                        className="col-span-1 flex justify-center text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.escort_required}
                onChange={(e) => setForm({ ...form, escort_required: e.target.checked })}
              />
              Require night-shift escort guard &amp; safe-drop confirmation
            </label>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {saveMutation.isPending ? 'Saving...' : editingRosterId ? 'Update Roster & Stops' : 'Save Roster Template'}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Bulk CSV Employee Roster Import */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              csvImportMutation.mutate();
            }}
            className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Bulk Import ETS Rosters &amp; Stops (CSV)</h2>
                <p className="text-xs text-slate-400">Rows are grouped by <span className="font-mono text-cyan-300">route_code</span> into multi-stop rosters.</p>
              </div>
              <button type="button" onClick={() => setCsvModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-400">Corporate Client</label>
                <select
                  value={csvCustomerId}
                  onChange={(e) => setCsvCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer text-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                  Choose .CSV File
                  <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV)}
                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                >
                  Load Sample
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">
                CSV Content (required columns: <span className="font-mono text-slate-300">route_code, address</span>)
              </label>
              <textarea
                rows={9}
                required
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV header & employee rows here..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={csvImportMutation.isPending}
              className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
            >
              {csvImportMutation.isPending ? 'Importing Rosters...' : 'Import Rosters & Employee Stops'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
