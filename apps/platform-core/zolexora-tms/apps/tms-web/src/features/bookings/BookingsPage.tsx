import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  Plus,
  Search,
  AlertCircle,
  X,
  FileCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Truck,
  Eye,
  Download,
  Upload,
  Ban,
  ClipboardList,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useAuth } from '../auth/useAuth';
import { useApplicationRuntime } from '../../providers/ApplicationRuntimeProvider';
import { resolveServiceConfig } from '../../lib/serviceConfig';
import type {
  Booking,
  BookingBulkCreateResponse,
  BookingBulkItemError,
  BookingBulkRow,
  BookingRequest,
  BookingRequestCreate,
  BookingOperationalStatus,
  BookingType,
  BookingServiceType,
  Customer,
  OrganisationService,
} from '../../types';

// ── Bulk CSV Helpers ─────────────────────────────────────────────────────────

const BULK_TEMPLATE_HEADERS = [
  'Client Code', 'Booking Type', 'Service Type',
  'Pickup Address', 'Drop Address', 'Pickup DateTime',
  'Lead Passenger', 'Passenger Phone', 'Headcount', 'Shift Label',
  'Cargo Material', 'Cargo Weight (kg)', 'E-Way Bill No', 'Instructions',
];

const BULK_HEADER_ALIASES: Record<string, string> = {
  'client code': 'client_code',
  'client_code': 'client_code',
  'booking type': 'booking_type',
  'booking_type': 'booking_type',
  'service type': 'service_type',
  'service_type': 'service_type',
  'pickup address': 'pickup_address',
  'pickup_address': 'pickup_address',
  'pickup': 'pickup_address',
  'drop address': 'drop_address',
  'drop_address': 'drop_address',
  'drop': 'drop_address',
  'pickup datetime': 'pickup_datetime',
  'pickup_datetime': 'pickup_datetime',
  'pickup time': 'pickup_datetime',
  'lead passenger': 'passenger_name',
  'passenger name': 'passenger_name',
  'passenger_name': 'passenger_name',
  'passenger phone': 'passenger_phone',
  'passenger_phone': 'passenger_phone',
  'headcount': 'passenger_count',
  'passenger count': 'passenger_count',
  'passenger_count': 'passenger_count',
  'shift label': 'shift_label',
  'shift': 'shift_label',
  'shift_label': 'shift_label',
  'cargo material': 'cargo_material',
  'material': 'cargo_material',
  'cargo_material': 'cargo_material',
  'cargo weight (kg)': 'cargo_weight_kg',
  'weight': 'cargo_weight_kg',
  'cargo_weight_kg': 'cargo_weight_kg',
  'e-way bill no': 'eway_bill_number',
  'eway bill': 'eway_bill_number',
  'eway_bill_number': 'eway_bill_number',
  'instructions': 'operational_instructions',
  'operational_instructions': 'operational_instructions',
};

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function getBulkBookingRowError(r: BookingBulkRow): string | null {
  if (!r.client_code.trim()) return 'Client Code required';
  if (r.pickup_address.trim().length < 3) return 'Pickup address too short';
  if (r.drop_address.trim().length < 3) return 'Drop address too short';
  if (!r.pickup_datetime.trim()) return 'Pickup DateTime required';
  return null;
}

function parseBookingCsv(text: string): { rows: BookingBulkRow[]; error?: string } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  const header = splitCsvLine(lines[0]).map((h) => {
    const norm = h.toLowerCase();
    return BULK_HEADER_ALIASES[norm] ?? norm;
  });
  if (
    !header.includes('client_code') ||
    !header.includes('pickup_address') ||
    !header.includes('drop_address') ||
    !header.includes('pickup_datetime')
  ) {
    return {
      rows: [],
      error: 'CSV must include Client Code, Pickup Address, Drop Address, and Pickup DateTime columns.',
    };
  }

  const rows: BookingBulkRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (field: string) => {
      const idx = header.indexOf(field);
      return idx !== -1 ? cols[idx] || '' : '';
    };
    const countRaw = get('passenger_count');
    const weightRaw = get('cargo_weight_kg');
    rows.push({
      client_code: get('client_code').toUpperCase(),
      booking_type: (get('booking_type').toUpperCase() || 'ETS') as BookingType,
      service_type: (get('service_type').toUpperCase() || 'PASSENGER') as BookingServiceType,
      pickup_address: get('pickup_address'),
      drop_address: get('drop_address'),
      pickup_datetime: get('pickup_datetime'),
      passenger_name: get('passenger_name') || undefined,
      passenger_phone: get('passenger_phone') || undefined,
      passenger_count: countRaw ? Number(countRaw) || undefined : undefined,
      shift_label: get('shift_label') || undefined,
      cargo_material: get('cargo_material') || undefined,
      cargo_weight_kg: weightRaw ? Number(weightRaw) || undefined : undefined,
      eway_bill_number: get('eway_bill_number') || undefined,
      operational_instructions: get('operational_instructions') || undefined,
    });
  }
  return { rows };
}

function downloadBookingTemplate(sampleClient = 'CLI-12345678', allowPassenger = true, allowCargo = true) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const exampleRows: string[] = [];
  if (allowPassenger) {
    exampleRows.push(`"${sampleClient}",ETS,PASSENGER,"Electronic City Phase 1, Bengaluru","Manyata Tech Park Gate 2, Bengaluru","${tomorrow} 09:00","Ananya Sharma","+919876543210",3,"Morning Login 09:00",,,,Gate pass at reception`);
  }
  if (allowCargo) {
    exampleRows.push(`"${sampleClient}",SPOT,CARGO,"Bhiwandi Logistics Park, Mumbai","JNPT Port Terminal 2, Navi Mumbai","${tomorrow} 14:30",,,,,IT Hardware,450,123456789012,Fragile cargo`);
  }
  const csv = [BULK_TEMPLATE_HEADERS.join(','), ...exampleRows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'booking_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV Export ───────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Booking #', 'Customer', 'Type', 'Service', 'Status',
  'Pickup Address', 'Drop Address', 'Pickup DateTime',
  'Boarding PIN', 'Escort Required', 'Created At',
];

function escapeCsvField(val: string | number | boolean | undefined): string {
  const s = val !== undefined && val !== null ? String(val) : '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBookingsCSV(rows: Booking[], customerMap: Record<string, string>, filename = 'bookings_export.csv') {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const b of rows) {
    lines.push([
      b.booking_number,
      customerMap[b.customer_id] || b.customer_id,
      b.booking_type,
      b.service_type,
      b.status,
      b.pickup_address,
      b.drop_address,
      new Date(b.pickup_datetime).toLocaleString('en-IN'),
      b.boarding_pin || '',
      b.escort_required ? 'Yes' : 'No',
      new Date(b.created_at).toLocaleDateString('en-IN'),
    ].map(escapeCsvField).join(','));
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge helpers ─────────────────────────────────────────────────────

function bookingStatusClass(status: BookingOperationalStatus): string {
  switch (status) {
    case 'CONFIRMED':   return 'bg-silver-900/60 text-silver-300 border border-silver-700/30';
    case 'IN_PROGRESS': return 'bg-navy-900/40 text-silver-400 border border-navy-600/20';
    case 'COMPLETED':   return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'CANCELLED':   return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    default:            return 'bg-slate-700/20 text-slate-400';
  }
}

function reqStatusClass(status: string): string {
  switch (status) {
    case 'CONFIRMED': return 'bg-silver-900/60 text-silver-300 border border-silver-700/30';
    case 'REQUESTED': return 'bg-navy-800/40 text-silver-400 border border-navy-600/20';
    case 'DRAFT':     return 'bg-slate-800 text-slate-400 border border-slate-700';
    default:          return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  }
}

// ── Empty booking request form ───────────────────────────────────────────────

const EMPTY_REQUEST: BookingRequestCreate = {
  customer_id: '',
  booking_type: '',
  service_type: 'PASSENGER',
  pickup_address: '',
  drop_address: '',
  pickup_datetime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  passenger_info: { name: '', phone: '', count: 1, shift: '' },
  cargo_info: { weight_kg: '', material: '' },
  special_instructions: '',
  estimated_pricing: '',
};

// ── Status filter tabs ───────────────────────────────────────────────────────

type BookingTab = 'bookings' | 'requests';
type StatusFilter = 'ALL' | BookingOperationalStatus;
const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

// ── Main Component ───────────────────────────────────────────────────────────

export function BookingsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { authMe } = useAuth();
  const runtime = useApplicationRuntime();
  const serviceConfig = resolveServiceConfig(runtime, authMe?.workspace_type);
  const defaultServiceType: BookingServiceType = serviceConfig.passenger ? 'PASSENGER' : 'CARGO';

  const [activeTab, setActiveTab] = useState<BookingTab>('bookings');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'duty'>('details');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  const [dutyBooking, setDutyBooking] = useState<Booking | null>(null);
  const [formError, setFormError] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState<Booking | null>(null);

  // Bulk import state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BookingBulkRow[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkResult, setBulkResult] = useState<BookingBulkCreateResponse | null>(null);

  // Booking Request form
  const [requestForm, setRequestForm] = useState<BookingRequestCreate>(EMPTY_REQUEST);
  const [dutyForm, setDutyForm] = useState({ scheduled_start_time: '', scheduled_end_time: '', notes: '' });

  // Queries
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient<Customer[]>('/api/v1/crm/clients'),
  });

  const { data: orgServices = [] } = useQuery({
    queryKey: ['organisation-services', 'active'],
    queryFn: () => apiClient<OrganisationService[]>('/api/v1/services?active_only=true'),
  });

  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiClient<Booking[]>('/api/v1/bookings?limit=200'),
    enabled: activeTab === 'bookings',
  });

  const { data: bookingRequests, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['booking-requests'],
    queryFn: () => apiClient<BookingRequest[]>('/api/v1/booking-requests?limit=200'),
    enabled: activeTab === 'requests',
  });

  // Map customer_id → name for display
  const customerMap: Record<string, string> = {};
  customers?.forEach((c) => { customerMap[c.id] = c.name; });

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: (data: BookingRequestCreate) => {
      const pax = data.passenger_info || {};
      const cargo = data.cargo_info || {};
      const cleanPax = data.service_type === 'PASSENGER'
        ? {
            ...(pax.name ? { name: String(pax.name).trim() } : {}),
            ...(pax.phone ? { phone: String(pax.phone).trim() } : {}),
            ...(pax.count ? { count: Number(pax.count) || 1 } : {}),
            ...(pax.shift ? { shift: String(pax.shift).trim() } : {}),
          }
        : {};
      const cleanCargo = data.service_type === 'CARGO'
        ? {
            ...(cargo.material ? { material: String(cargo.material).trim() } : {}),
            ...(cargo.weight_kg ? { weight_kg: Number(cargo.weight_kg) } : {}),
          }
        : {};
      return apiClient<BookingRequest>('/api/v1/booking-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          passenger_info: cleanPax,
          cargo_info: cleanCargo,
          pickup_datetime: new Date(data.pickup_datetime).toISOString(),
          estimated_pricing: data.estimated_pricing ? data.estimated_pricing : undefined,
          special_instructions: data.special_instructions?.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      setIsRequestModalOpen(false);
      setRequestForm(EMPTY_REQUEST);
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const confirmRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiClient<Booking>(`/api/v1/booking-requests/${requestId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setActiveTab('bookings');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const submitRequestMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiClient<BookingRequest>(`/api/v1/booking-requests/${requestId}/submit`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking-requests'] }),
    onError: (err: Error) => setFormError(err.message),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiClient<Booking>(`/api/v1/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by dispatcher' }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCancelConfirm(null);
      if (selectedBooking?.id === updated.id) setSelectedBooking(updated);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const createDutyMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiClient(`/api/v1/bookings/${bookingId}/create-duty`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_start_time: new Date(dutyForm.scheduled_start_time).toISOString(),
          scheduled_end_time: new Date(dutyForm.scheduled_end_time).toISOString(),
          notes: dutyForm.notes,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duties'] });
      setIsDutyModalOpen(false);
      setDutyBooking(null);
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const bulkMutation = useMutation({
    mutationFn: (rows: BookingBulkRow[]) =>
      apiClient<BookingBulkCreateResponse>('/api/v1/bookings/bulk', {
        method: 'POST',
        body: JSON.stringify({ bookings: rows }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setBulkResult(res);
    },
    onError: (err: Error) => setBulkParseError(err.message),
  });

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, error } = parseBookingCsv(text);
      setBulkParseError(error || '');
      setBulkRows(rows);
      setBulkResult(null);
    };
    reader.readAsText(file);
  };

  const closeBulk = () => {
    setIsBulkOpen(false);
    setBulkRows([]);
    setBulkParseError('');
    setBulkResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validBulkRows = bulkRows.filter((r) => !getBulkBookingRowError(r));

  const openDutyModal = (b: Booking) => {
    setDutyBooking(b);
    const start = new Date(b.pickup_datetime).toISOString().slice(0, 16);
    const end = new Date(new Date(b.pickup_datetime).getTime() + 4 * 3600000).toISOString().slice(0, 16);
    setDutyForm({ scheduled_start_time: start, scheduled_end_time: end, notes: '' });
    setFormError('');
    setIsDutyModalOpen(true);
  };

  const openProfile = (b: Booking) => {
    setSelectedBooking(b);
    setProfileTab('details');
  };

  // Filter logic
  const filteredBookings = bookings?.filter((b) => {
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (
      b.booking_number.toLowerCase().includes(q) ||
      b.pickup_address.toLowerCase().includes(q) ||
      b.drop_address.toLowerCase().includes(q) ||
      (customerMap[b.customer_id] || '').toLowerCase().includes(q)
    );
    return matchStatus && matchSearch;
  });

  const filteredRequests = bookingRequests?.filter((r) => {
    const q = search.toLowerCase();
    return !q || (
      r.request_number.toLowerCase().includes(q) ||
      r.pickup_address.toLowerCase().includes(q) ||
      r.drop_address.toLowerCase().includes(q) ||
      (customerMap[r.customer_id] || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings</h1>
          <p className="text-sm text-slate-400">Manage trip bookings, booking requests, and generate duty rosters.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!bookings || bookings.length === 0) return;
              downloadBookingsCSV(filteredBookings || bookings, customerMap);
            }}
            disabled={!bookings || bookings.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export visible bookings as CSV"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setIsBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
          <button
            onClick={() => {
              setFormError('');
              const visibleServices = orgServices.filter((s) =>
                (serviceConfig.passenger && s.service_category === 'PASSENGER') ||
                (serviceConfig.cargo && s.service_category === 'CARGO')
              );
              const firstSvc = visibleServices[0];
              setRequestForm({
                ...EMPTY_REQUEST,
                booking_type: firstSvc?.code || '',
                service_type: firstSvc?.service_category || defaultServiceType,
              });
              setIsRequestModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-800/30 hover:bg-navy-600 transition"
          >
            <Plus className="h-4 w-4" />
            New Booking Request
          </button>
        </div>
      </div>

      {/* Tabs + Status filter + Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2 p-1 rounded-xl bg-slate-900/60 border border-slate-800 w-fit">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'bookings' ? 'bg-navy-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'requests' ? 'bg-navy-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Booking Requests
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-sm w-full">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search by number, address, or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Status filter row (bookings tab only) */}
        {activeTab === 'bookings' && (
          <div className="flex items-center gap-2 flex-wrap">
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
                {f.value !== 'ALL' && bookings && (
                  <span className="ml-1.5 opacity-70">
                    ({bookings.filter((b) => b.status === f.value).length})
                  </span>
                )}
                {f.value === 'ALL' && bookings && (
                  <span className="ml-1.5 opacity-70">({bookings.length})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Table: Bookings ────────────────────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Booking # & Client</th>
                <th className="px-5 py-3.5">Type & Service</th>
                <th className="px-5 py-3.5">Route</th>
                <th className="px-5 py-3.5">Pickup Time</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isBookingsLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Loading bookings...
                  </td>
                </tr>
              ) : filteredBookings?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <CalendarCheck className="h-8 w-8 text-slate-600 mb-2" />
                      <p className="text-sm font-semibold text-slate-300">No bookings found</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {statusFilter !== 'ALL' ? 'Try a different status filter.' : 'Create a booking request and confirm it.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBookings?.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4">
                      <div className="font-mono font-semibold text-white">{booking.booking_number}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {customerMap[booking.customer_id] || <span className="text-slate-600 italic">Unknown client</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                          {booking.booking_type}
                        </span>
                        <span className="inline-block rounded-md bg-navy-900/60 border border-navy-700/40 px-2 py-0.5 text-xs font-semibold text-silver-300">
                          {booking.service_type}
                        </span>
                        {booking.boarding_pin && (
                          <span className="inline-block rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                            PIN {booking.boarding_pin}
                          </span>
                        )}
                        {booking.escort_required && (
                          <span className="inline-block rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                            🛡 Escort
                          </span>
                        )}
                      </div>
                      {booking.service_type === 'PASSENGER' && booking.passenger_info?.name && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          <span className="text-slate-300 font-medium">{booking.passenger_info.name}</span>
                          {booking.passenger_info.count ? ` · 👤 ${booking.passenger_info.count}` : ''}
                          {booking.passenger_info.shift ? ` · 🕐 ${booking.passenger_info.shift}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <div className="flex items-center gap-1.5 text-slate-200 text-xs">
                        <span className="truncate max-w-[120px]">{booking.pickup_address}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-500" />
                        <span className="truncate max-w-[120px] text-slate-400">{booking.drop_address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      {new Date(booking.pickup_datetime).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openProfile(booking)}
                          className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                          title="View booking details"
                        >
                          <Eye className="h-3.5 w-3.5 text-silver-300" />
                          View
                        </button>
                        {booking.status === 'CONFIRMED' && (
                          <button
                            onClick={() => openDutyModal(booking)}
                            className="inline-flex items-center gap-1 rounded bg-navy-600/20 border border-navy-600/30 px-2.5 py-1 text-xs font-semibold text-silver-300 hover:bg-navy-600 hover:text-white transition"
                            title="Generate duty roster"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Duty
                          </button>
                        )}
                        {(booking.status === 'CONFIRMED') && (
                          <button
                            onClick={() => setCancelConfirm(booking)}
                            className="rounded bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
                            title="Cancel booking"
                          >
                            <Ban className="h-3.5 w-3.5" />
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
      )}

      {/* ── Table: Booking Requests ────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Request # & Client</th>
                <th className="px-5 py-3.5">Type & Service</th>
                <th className="px-5 py-3.5">Route</th>
                <th className="px-5 py-3.5">Est. Price</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isRequestsLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Loading booking requests...
                  </td>
                </tr>
              ) : filteredRequests?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <FileCheck className="h-8 w-8 text-slate-600 mb-2" />
                      <p className="text-sm font-semibold text-slate-300">No booking requests</p>
                      <p className="text-xs text-slate-500 mt-0.5">Click "New Booking Request" to create one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests?.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4">
                      <div className="font-mono font-semibold text-white">{req.request_number}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {customerMap[req.customer_id] || <span className="text-slate-600 italic">Unknown client</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                          {req.booking_type}
                        </span>
                        <span className="inline-block rounded-md bg-navy-900/60 border border-navy-700/40 px-2 py-0.5 text-xs font-semibold text-silver-300">
                          {req.service_type}
                        </span>
                      </div>
                      {req.service_type === 'PASSENGER' && req.passenger_info?.name && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          <span className="text-slate-300 font-medium">{req.passenger_info.name}</span>
                          {req.passenger_info.count ? ` · 👤 ${req.passenger_info.count}` : ''}
                          {req.passenger_info.shift ? ` · 🕐 ${req.passenger_info.shift}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <div className="flex items-center gap-1.5 text-xs text-slate-200">
                        <span className="truncate max-w-[120px]">{req.pickup_address}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-500" />
                        <span className="truncate max-w-[120px] text-slate-400">{req.drop_address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300 text-xs">
                      {req.estimated_pricing ? `₹${req.estimated_pricing}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${reqStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {req.status === 'DRAFT' && (
                          <button
                            onClick={() => submitRequestMutation.mutate(req.id)}
                            disabled={submitRequestMutation.isPending}
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Submit
                          </button>
                        )}
                        {(req.status === 'DRAFT' || req.status === 'REQUESTED') && (
                          <button
                            onClick={() => confirmRequestMutation.mutate(req.id)}
                            disabled={confirmRequestMutation.isPending}
                            className="inline-flex items-center gap-1 rounded bg-silver-800/40 border border-silver-700/40 px-3 py-1.5 text-xs font-semibold text-silver-300 hover:bg-navy-600 hover:text-white transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm
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
      )}

      {/* ── Booking Detail Modal ───────────────────────────────────────────── */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white font-mono">{selectedBooking.booking_number}</h2>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusClass(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {customerMap[selectedBooking.customer_id] || selectedBooking.customer_id}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadBookingsCSV([selectedBooking], customerMap, `booking_${selectedBooking.booking_number}.csv`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
                  title="Download CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
                <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setProfileTab('details')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'details' ? 'bg-navy-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Booking Details
              </button>
              <button
                onClick={() => setProfileTab('duty')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'duty' ? 'bg-navy-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Generate Duty
              </button>
            </div>

            {profileTab === 'details' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {/* Route */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Route</h3>
                    <div>
                      <div className="text-[11px] text-slate-500">Pickup</div>
                      <div className="text-white text-xs">{selectedBooking.pickup_address}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Drop / Destination</div>
                      <div className="text-white text-xs">{selectedBooking.drop_address}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <div className="text-[11px] text-slate-500">Pickup Time</div>
                        <div className="text-white text-xs">{new Date(selectedBooking.pickup_datetime).toLocaleString('en-IN')}</div>
                      </div>
                      {selectedBooking.expected_completion_datetime && (
                        <div>
                          <div className="text-[11px] text-slate-500">Expected End</div>
                          <div className="text-white text-xs">{new Date(selectedBooking.expected_completion_datetime).toLocaleString('en-IN')}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Trip Info */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trip Details</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[11px] text-slate-500">Booking Type</div>
                        <div className="text-white text-xs font-semibold">{selectedBooking.booking_type}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Service Type</div>
                        <div className="text-white text-xs font-semibold">{selectedBooking.service_type}</div>
                      </div>
                    </div>
                    {selectedBooking.service_type === 'PASSENGER' && Object.keys(selectedBooking.passenger_info || {}).length > 0 && (
                      <div>
                        <div className="text-[11px] text-slate-500">Passenger Info</div>
                        <div className="text-white text-xs mt-0.5">
                          {selectedBooking.passenger_info.name && <span className="font-medium">{selectedBooking.passenger_info.name}</span>}
                          {selectedBooking.passenger_info.phone && <span className="text-slate-400"> · {selectedBooking.passenger_info.phone}</span>}
                          {selectedBooking.passenger_info.count && <span className="text-slate-400"> · 👤 {selectedBooking.passenger_info.count}</span>}
                          {selectedBooking.passenger_info.shift && <span className="text-slate-400"> · 🕐 {selectedBooking.passenger_info.shift}</span>}
                        </div>
                      </div>
                    )}
                    {selectedBooking.service_type === 'CARGO' && Object.keys(selectedBooking.cargo_info || {}).length > 0 && (
                      <div>
                        <div className="text-[11px] text-slate-500">Cargo Info</div>
                        <div className="text-white text-xs mt-0.5">
                          {selectedBooking.cargo_info.material && <span>{selectedBooking.cargo_info.material}</span>}
                          {selectedBooking.cargo_info.weight_kg && <span className="text-slate-400"> · {selectedBooking.cargo_info.weight_kg} kg</span>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {selectedBooking.boarding_pin && (
                        <div>
                          <div className="text-[11px] text-slate-500">Boarding PIN</div>
                          <div className="text-indigo-300 font-mono text-sm font-bold">{selectedBooking.boarding_pin}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-[11px] text-slate-500">Escort Required</div>
                        <div className={`text-xs font-semibold ${selectedBooking.escort_required ? 'text-rose-400' : 'text-slate-400'}`}>
                          {selectedBooking.escort_required ? '🛡 Yes' : 'No'}
                        </div>
                      </div>
                    </div>
                    {selectedBooking.eway_bill_number && (
                      <div>
                        <div className="text-[11px] text-slate-500">E-Way Bill</div>
                        <div className="text-white font-mono text-xs">{selectedBooking.eway_bill_number}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  {selectedBooking.status === 'CONFIRMED' && (
                    <>
                      <button
                        onClick={() => { setCancelConfirm(selectedBooking); setSelectedBooking(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        <Ban className="h-4 w-4" />
                        Cancel
                      </button>
                      <button
                        onClick={() => { openDutyModal(selectedBooking); setSelectedBooking(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                      >
                        <Truck className="h-4 w-4 text-silver-300" />
                        Generate Duty
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              /* Generate Duty Tab (inline) */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createDutyMutation.mutate(selectedBooking.id);
                }}
                className="space-y-4"
              >
                <p className="text-xs text-slate-400">
                  Generating duty roster for <span className="font-mono font-semibold text-silver-300">{selectedBooking.booking_number}</span>.
                  After creation, go to <strong className="text-white">Duties</strong> to assign Driver & Vehicle.
                </p>
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Scheduled Start *</label>
                    <input
                      type="datetime-local"
                      required
                      value={dutyForm.scheduled_start_time}
                      onChange={(e) => setDutyForm({ ...dutyForm, scheduled_start_time: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Scheduled End *</label>
                    <input
                      type="datetime-local"
                      required
                      value={dutyForm.scheduled_end_time}
                      onChange={(e) => setDutyForm({ ...dutyForm, scheduled_end_time: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Duty Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Driver reporting point, escort / passenger pickup notes, gate pass requirements..."
                    value={dutyForm.notes}
                    onChange={(e) => setDutyForm({ ...dutyForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createDutyMutation.isPending}
                    className="rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition disabled:opacity-50"
                  >
                    {createDutyMutation.isPending ? 'Generating...' : 'Confirm & Generate Duty'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Cancel Confirm Modal ───────────────────────────────────────────── */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-500/15 p-2">
                <Ban className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Cancel Booking</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cancel <span className="font-mono font-semibold text-silver-300">{cancelConfirm.booking_number}</span>?
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400">This action cannot be undone. Any associated duties must be cancelled separately.</p>
            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => { setCancelConfirm(null); setFormError(''); }}
                className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                Keep Booking
              </button>
              <button
                onClick={() => cancelBookingMutation.mutate(cancelConfirm.id)}
                disabled={cancelBookingMutation.isPending}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50"
              >
                {cancelBookingMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Booking Request Modal ──────────────────────────────────────── */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Create Booking Request</h3>
                <p className="text-xs text-slate-400">Initialize a client trip request before confirmation.</p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
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
              onSubmit={(e) => { e.preventDefault(); createRequestMutation.mutate(requestForm); }}
              className="space-y-4"
            >
              {/* Customer */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Customer / Client *</label>
                <select
                  required
                  value={requestForm.customer_id}
                  onChange={(e) => setRequestForm({ ...requestForm, customer_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                >
                  <option value="">Select a customer...</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.gstin ? ` (${c.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking Type (Our Services) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400">Booking Type (Our Services) *</label>
                  {requestForm.booking_type && (
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-silver-300">
                      {requestForm.service_type}
                    </span>
                  )}
                </div>
                <select
                  required
                  value={requestForm.booking_type}
                  onChange={(e) => {
                    const code = e.target.value;
                    const match = orgServices.find((s) => s.code === code);
                    setRequestForm({
                      ...requestForm,
                      booking_type: code as BookingType,
                      service_type: match ? match.service_category : requestForm.service_type,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                >
                  {orgServices.length === 0 ? (
                    <option value="">No services added yet</option>
                  ) : (
                    <>
                      <option value="">Select a service...</option>
                      {orgServices
                        .filter((s) =>
                          (serviceConfig.passenger && s.service_category === 'PASSENGER') ||
                          (serviceConfig.cargo && s.service_category === 'CARGO')
                        )
                        .map((s) => (
                          <option key={s.id} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                    </>
                  )}
                </select>
                {orgServices.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-300">
                    Add your services in{' '}
                    <Link to="/create-services" className="underline font-semibold">
                      Create Services
                    </Link>{' '}
                    first.
                  </p>
                )}
              </div>

              {/* Passenger / Cargo Details */}
              {requestForm.service_type === 'PASSENGER' ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                    Passenger / Shift Details
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Lead Passenger</label>
                      <input
                        type="text"
                        placeholder="e.g. Ananya Sharma (EMP-204)"
                        value={requestForm.passenger_info?.name ?? ''}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, passenger_info: { ...requestForm.passenger_info, name: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Passenger Mobile</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={requestForm.passenger_info?.phone ?? ''}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, passenger_info: { ...requestForm.passenger_info, phone: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Headcount</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={requestForm.passenger_info?.count ?? 1}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, passenger_info: { ...requestForm.passenger_info, count: Number(e.target.value) || 1 } })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Shift / Flight No</label>
                      <input
                        type="text"
                        placeholder="Night Login 22:00 / AI-502"
                        value={requestForm.passenger_info?.shift ?? ''}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, passenger_info: { ...requestForm.passenger_info, shift: e.target.value } })
                        }
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Material / Parcel Type</label>
                    <input
                      type="text"
                      placeholder="e.g. IT Hardware"
                      value={requestForm.cargo_info?.material ?? ''}
                      onChange={(e) =>
                        setRequestForm({ ...requestForm, cargo_info: { ...requestForm.cargo_info, material: e.target.value } })
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="250"
                      value={requestForm.cargo_info?.weight_kg ?? ''}
                      onChange={(e) =>
                        setRequestForm({ ...requestForm, cargo_info: { ...requestForm.cargo_info, weight_kg: e.target.value } })
                      }
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Addresses */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pickup Address *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    requestForm.service_type === 'PASSENGER'
                      ? 'e.g. Electronic City Phase 1 / Employee Pickup'
                      : 'e.g. Warehouse 3, Bhiwandi Logistics Park'
                  }
                  value={requestForm.pickup_address}
                  onChange={(e) => setRequestForm({ ...requestForm, pickup_address: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Drop / Destination *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    requestForm.service_type === 'PASSENGER'
                      ? 'e.g. Manyata Tech Park Gate 2 / Airport T1'
                      : 'e.g. JNPT Port Container Terminal 2'
                  }
                  value={requestForm.drop_address}
                  onChange={(e) => setRequestForm({ ...requestForm, drop_address: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                />
              </div>

              {/* Pickup datetime + Est. price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pickup Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={requestForm.pickup_datetime}
                    onChange={(e) => setRequestForm({ ...requestForm, pickup_datetime: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Estimated Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="18500.00"
                    value={requestForm.estimated_pricing}
                    onChange={(e) => setRequestForm({ ...requestForm, estimated_pricing: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Special instructions */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Special Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Escort required, gate pass details, fragile cargo..."
                  value={requestForm.special_instructions}
                  onChange={(e) => setRequestForm({ ...requestForm, special_instructions: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  className="rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition disabled:opacity-50"
                >
                  {createRequestMutation.isPending ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Standalone Generate Duty Modal (from table row) ────────────────── */}
      {isDutyModalOpen && dutyBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Generate Duty Roster</h3>
                <p className="text-xs text-slate-400">
                  Creating operational duty for Booking{' '}
                  <span className="font-mono text-silver-400 font-semibold">{dutyBooking.booking_number}</span>
                </p>
              </div>
              <button
                onClick={() => setIsDutyModalOpen(false)}
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
              onSubmit={(e) => { e.preventDefault(); createDutyMutation.mutate(dutyBooking.id); }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Scheduled Start *</label>
                  <input
                    type="datetime-local"
                    required
                    value={dutyForm.scheduled_start_time}
                    onChange={(e) => setDutyForm({ ...dutyForm, scheduled_start_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Scheduled End *</label>
                  <input
                    type="datetime-local"
                    required
                    value={dutyForm.scheduled_end_time}
                    onChange={(e) => setDutyForm({ ...dutyForm, scheduled_end_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Duty Notes</label>
                <textarea
                  rows={3}
                  placeholder="Driver reporting point, escort / passenger pickup notes, gate pass requirements..."
                  value={dutyForm.notes}
                  onChange={(e) => setDutyForm({ ...dutyForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-navy-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDutyModalOpen(false)}
                  className="rounded-xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDutyMutation.isPending}
                  className="rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition disabled:opacity-50"
                >
                  {createDutyMutation.isPending ? 'Generating...' : 'Confirm & Generate Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Import Bookings Modal ─────────────────────────────────────── */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Bulk Import Bookings</h2>
                <p className="text-xs text-slate-400">
                  Upload a CSV to create confirmed bookings in bulk (up to 5,000 rows).
                </p>
              </div>
              <button onClick={closeBulk} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
              <span className="text-slate-400">
                Match clients strictly by <strong className="text-slate-200">Client Code</strong> (e.g. <span className="font-mono text-silver-300">CLI-12345678</span>). Night-shift passenger bookings auto-generate a Boarding PIN &amp; Escort flag.
              </span>
              <button
                type="button"
                onClick={() =>
                  downloadBookingTemplate(
                    customers?.find((c) => c.client_code)?.client_code || 'CLI-12345678',
                    serviceConfig.passenger,
                    serviceConfig.cargo
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-silver-300 hover:bg-slate-700 hover:text-white transition shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Download Template
              </button>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFileChange}
                className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700 cursor-pointer"
              />
              {bulkParseError && (
                <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {bulkParseError}
                </p>
              )}
            </div>

            {bulkRows.length > 0 && !bulkResult && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Previewing {Math.min(5, bulkRows.length)} of{' '}
                  <span className="font-semibold text-white">{bulkRows.length}</span> rows (
                  <span className="text-silver-300">{validBulkRows.length} valid</span>)
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Client Code</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Route</th>
                        <th className="px-3 py-2">Pickup Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bulkRows.slice(0, 5).map((r, i) => {
                        const rowErr = getBulkBookingRowError(r);
                        return (
                          <tr key={i} className={rowErr ? 'bg-red-500/10' : ''}>
                            <td className="px-3 py-2 font-mono font-medium text-white">
                              {r.client_code || <span className="text-red-400 font-sans">(missing)</span>}
                              {rowErr && <div className="text-[10px] font-sans text-red-400">{rowErr}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {r.booking_type} · {r.service_type}
                            </td>
                            <td className="px-3 py-2 max-w-[220px] truncate">
                              {r.pickup_address} → {r.drop_address}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.pickup_datetime || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult && (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-silver-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    {bulkResult.created_count} bookings created
                  </span>
                  {bulkResult.failed_count > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      {bulkResult.failed_count} failed
                    </span>
                  )}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400">
                        <tr>
                          <th className="px-3 py-1.5">Row</th>
                          <th className="px-3 py-1.5">Reference</th>
                          <th className="px-3 py-1.5">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {bulkResult.errors.map((err: BookingBulkItemError, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-mono">{err.row}</td>
                            <td className="px-3 py-1.5">{err.reference || '---'}</td>
                            <td className="px-3 py-1.5 text-red-400">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={closeBulk}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                {bulkResult ? 'Close' : 'Cancel'}
              </button>
              {!bulkResult && (
                <button
                  type="button"
                  disabled={bulkRows.length === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(bulkRows)}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition"
                >
                  {bulkMutation.isPending ? 'Importing...' : `Import ${bulkRows.length} Bookings`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
