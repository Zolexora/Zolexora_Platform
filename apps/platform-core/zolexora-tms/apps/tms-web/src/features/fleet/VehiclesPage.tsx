import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Search, AlertCircle, X, Navigation, ShieldCheck, Upload, Download, CheckCircle2, Building2, Pencil, Eye } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useAuth } from '../auth/useAuth';
import { useApplicationRuntime } from '../../providers/ApplicationRuntimeProvider';
import { resolveServiceConfig } from '../../lib/serviceConfig';
import type { Vehicle, VehicleBodyType, VehicleCreate, Vendor } from '../../types';
import { EntityComplianceManager } from '../compliance/EntityComplianceManager';
import { DownloadChoiceModal, type DownloadTarget } from '../../components/DownloadChoiceModal';

// ── Vehicle Type Options (Public Transport default + Cargo + Custom) ─────────

const PUBLIC_TRANSPORT_TYPES: { value: VehicleBodyType; label: string }[] = [
  { value: 'SEDAN', label: 'Sedan / Cab (4+1)' },
  { value: 'HATCHBACK', label: 'Hatchback' },
  { value: 'SUV', label: 'SUV / MUV (6+1 / 7+1)' },
  { value: 'TEMPO_TRAVELLER', label: 'Tempo Traveller (12-26 Seater)' },
  { value: 'MINI_BUS', label: 'Mini Bus' },
  { value: 'BUS', label: 'Bus / Coach' },
  { value: 'AUTO_RICKSHAW', label: 'Auto Rickshaw / 3-Wheeler' },
  { value: 'EV_CAB', label: 'Electric Cab (EV)' },
];

const CARGO_TYPES: { value: VehicleBodyType; label: string }[] = [
  { value: 'TRUCK', label: 'Open Truck' },
  { value: 'CONTAINER', label: 'Container Body' },
  { value: 'TRAILER', label: 'Semi-Trailer' },
  { value: 'TANKER', label: 'Fuel Tanker' },
  { value: 'TIPPER', label: 'Tipper / Dumper' },
  { value: 'TEMPO', label: 'Tempo / LCV' },
  { value: 'PICKUP', label: 'Pickup' },
];

// ── CSV Helpers (aligned 1-to-1 with Single Entry) ───────────────────────────

const TEMPLATE_HEADERS = [
  'Registration Number',
  'Vehicle Type',
  'Vendor Code',
  'Make',
  'Model',
  'Year',
  'Fuel Type',
  'Capacity',
  'Odometer (KM)',
  'FASTag ID',
  'GPS Device ID',
];

const HEADER_ALIASES: Record<string, string> = {
  'registration number': 'registration_number',
  'registration_number': 'registration_number',
  'vehicle type': 'vehicle_type',
  'vehicle_type': 'vehicle_type',
  'custom vehicle type': 'custom_vehicle_type',
  'custom_vehicle_type': 'custom_vehicle_type',
  'vendor code': 'vendor_code',
  'vendor_code': 'vendor_code',
  'make': 'make',
  'model': 'model',
  'year': 'year',
  'fuel type': 'fuel_type',
  'fuel_type': 'fuel_type',
  'capacity': 'payload_capacity_kg',
  'payload_capacity_kg': 'payload_capacity_kg',
  'odometer (km)': 'odometer_km',
  'odometer_km': 'odometer_km',
  'fastag id': 'fastag_id',
  'fastag_id': 'fastag_id',
  'gps device id': 'gps_device_id',
  'gps_device_id': 'gps_device_id',
};

type BulkRow = Record<string, string>;
interface BulkResult {
  succeeded: number;
  failed: number;
  errors: { row: number; registration_number?: string; error: string }[];
}

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

function parseVehicleCSV(text: string): BulkRow[] {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const cols = splitCsvLine(lines[0]).map((c) => {
    const norm = c.toLowerCase();
    return HEADER_ALIASES[norm] ?? norm;
  });
  return lines.slice(1).map((row) => {
    const vals = splitCsvLine(row);
    const obj: BulkRow = {};
    cols.forEach((col, i) => {
      if (vals[i] !== undefined && vals[i] !== '') obj[col] = vals[i];
    });
    return obj;
  });
}

function downloadCSVTemplate(sampleVendorCode?: string) {
  const vcode = sampleVendorCode || '';
  const sampleRows = [
    `MH12AB1234,SEDAN,${vcode},Maruti Suzuki,Dzire Tour S,2023,CNG,4,12000,,`,
    `DL01CD5678,BUS,${vcode},Tata Motors,Starbus 32,2022,DIESEL,32,45000,,`,
  ].join('\n');
  const content = TEMPLATE_HEADERS.join(',') + '\n' + sampleRows;
  const blob = new Blob([content], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vehicles_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const EXPORT_HEADERS = [
  'Registration Number', 'Vehicle Type', 'Custom Type', 'Ownership', 'Status',
  'Vendor Code', 'Vendor Name', 'Vendor PAN',
  'Make', 'Model', 'Year', 'Fuel Type', 'Capacity', 'Odometer (KM)',
  'FASTag ID', 'GPS Device ID', 'Created At',
];

function escapeCsvField(val: string | number | undefined): string {
  const s = val !== undefined && val !== null ? String(val) : '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadVehicleCSV(rows: Vehicle[], filename = 'vehicles_export.csv') {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const v of rows) {
    lines.push([
      v.registration_number, v.vehicle_type, v.custom_vehicle_type, v.ownership_type, v.status,
      v.vendor_code, v.vendor_name, v.vendor_pan,
      v.make, v.model, v.year, v.fuel_type, v.payload_capacity_kg, v.odometer_km,
      v.fastag_id, v.gps_device_id,
      new Date(v.created_at).toLocaleDateString('en-IN'),
    ].map(escapeCsvField).join(','));
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM: VehicleCreate = {
  registration_number: '',
  vehicle_type: 'SEDAN',
  custom_vehicle_type: '',
  vendor_id: undefined,
  vendor_code: '',
  ownership_type: 'OWNED',
  make: '',
  model: '',
  year: undefined,
  fuel_type: 'DIESEL',
  payload_capacity_kg: '',
  odometer_km: '0.00',
  fastag_id: '',
  gps_device_id: '',
};

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget | null>(null);

  // ── View modal (merged Details + Docs) ──────────────────────────────────────
  const [profileVehicle, setProfileVehicle] = useState<Vehicle | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'docs'>('details');
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editFormData, setEditFormData] = useState<VehicleCreate & { status?: Vehicle['status'] }>(EMPTY_FORM);
  const [editError, setEditError] = useState('');

  const openProfile = (v: Vehicle) => {
    setProfileVehicle(v);
    setProfileTab('details');
    setIsEditingVehicle(false);
    setEditError('');
  };

  const startEdit = (v: Vehicle) => {
    setEditFormData({
      registration_number: v.registration_number,
      vehicle_type: v.vehicle_type,
      custom_vehicle_type: v.custom_vehicle_type || '',
      vendor_code: v.vendor_code || '',
      vendor_id: v.vendor_id,
      ownership_type: v.ownership_type,
      make: v.make || '',
      model: v.model || '',
      year: v.year,
      fuel_type: v.fuel_type,
      payload_capacity_kg: v.payload_capacity_kg || '',
      odometer_km: v.odometer_km,
      fastag_id: v.fastag_id || '',
      gps_device_id: v.gps_device_id || '',
      status: v.status,
    });
    setEditError('');
    setIsEditingVehicle(true);
  };

  // Bulk import state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkError, setBulkError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { authMe } = useAuth();
  const runtime = useApplicationRuntime();
  const serviceConfig = resolveServiceConfig(runtime, authMe?.workspace_type);

  const [formData, setFormData] = useState<VehicleCreate>(EMPTY_FORM);

  // Real-time list of added vendors for Vendor Code dropdown & bulk preview lookup
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', 'dropdown'],
    queryFn: () => apiClient<Vendor[]>('/api/v1/vendors?limit=200'),
  });

  const vendorByCode = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => {
      if (v.vendor_code) map.set(v.vendor_code.toUpperCase(), v);
    });
    return map;
  }, [vendors]);

  const selectedVendor = useMemo(
    () => (formData.vendor_code ? vendorByCode.get(formData.vendor_code.toUpperCase()) : undefined),
    [formData.vendor_code, vendorByCode]
  );

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles', search],
    queryFn: () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiClient<Vehicle[]>(`/api/v1/vehicles${q}`);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBulkResult(null);
    setBulkError('');
    setBulkRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseVehicleCSV(ev.target?.result as string);
        if (rows.length === 0) { setBulkError('No data rows found in CSV.'); return; }
        if (rows.length > 5000) { setBulkError('Max 5000 rows per import.'); return; }
        setBulkRows(rows);
      } catch {
        setBulkError('Failed to parse CSV. Ensure it matches the template format.');
      }
    };
    reader.readAsText(file);
  }

  const bulkMutation = useMutation({
    mutationFn: (vehiclesPayload: BulkRow[]) =>
      apiClient<BulkResult>('/api/v1/vehicles/bulk', {
        method: 'POST',
        body: JSON.stringify({ vehicles: vehiclesPayload }),
      }),
    onSuccess: (res) => {
      setBulkResult(res);
      if (res.succeeded > 0) queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: any) => setBulkError(err.message || 'Bulk import failed'),
  });

  function closeBulkModal() {
    setIsBulkOpen(false);
    setBulkRows([]);
    setBulkResult(null);
    setBulkError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const createMutation = useMutation({
    mutationFn: (data: VehicleCreate) =>
      apiClient<Vehicle>('/api/v1/vehicles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create vehicle');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VehicleCreate> & { status?: Vehicle['status'] } }) =>
      apiClient<Vehicle>(`/api/v1/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setProfileVehicle(updated);
      setIsEditingVehicle(false);
      setEditError('');
    },
    onError: (err: any) => setEditError(err.message || 'Failed to update vehicle'),
  });

  const handleEditVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileVehicle) return;
    if (editFormData.vehicle_type === 'OTHER' && !editFormData.custom_vehicle_type?.trim()) {
      setEditError('Please specify the custom vehicle type.');
      return;
    }
    const resolvedVendor = editFormData.vendor_code
      ? vendorByCode.get(editFormData.vendor_code.toUpperCase())
      : undefined;
    updateMutation.mutate({
      id: profileVehicle.id,
      data: {
        vehicle_type: editFormData.vehicle_type,
        custom_vehicle_type: editFormData.vehicle_type === 'OTHER' ? editFormData.custom_vehicle_type?.trim() : undefined,
        vendor_code: editFormData.vendor_code || undefined,
        vendor_id: resolvedVendor?.id,
        ownership_type: resolvedVendor ? 'ATTACHED' : (editFormData.ownership_type || 'OWNED'),
        make: editFormData.make || undefined,
        model: editFormData.model || undefined,
        year: editFormData.year ? Number(editFormData.year) : undefined,
        fuel_type: editFormData.fuel_type,
        payload_capacity_kg: editFormData.payload_capacity_kg || undefined,
        odometer_km: editFormData.odometer_km,
        fastag_id: editFormData.fastag_id || undefined,
        gps_device_id: editFormData.gps_device_id || undefined,
        status: editFormData.status,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.registration_number.trim()) {
      setFormError('Registration number is required.');
      return;
    }
    if (formData.vehicle_type === 'OTHER' && !formData.custom_vehicle_type?.trim()) {
      setFormError('Please specify the custom vehicle type.');
      return;
    }

    const cleanedPlate = formData.registration_number.toUpperCase().replace(/\s+/g, '');

    createMutation.mutate({
      ...formData,
      registration_number: cleanedPlate,
      custom_vehicle_type: formData.vehicle_type === 'OTHER' ? formData.custom_vehicle_type?.trim() : undefined,
      vendor_id: selectedVendor?.id,
      vendor_code: formData.vendor_code || undefined,
      ownership_type: selectedVendor ? 'ATTACHED' : 'OWNED',
      year: formData.year ? Number(formData.year) : undefined,
      payload_capacity_kg: formData.payload_capacity_kg ? formData.payload_capacity_kg.toString() : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet Vehicles</h1>
          <p className="text-sm text-slate-400">Manage public transport &amp; commercial vehicles, vendor linking, and tracking devices.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              vehicles &&
              vehicles.length > 0 &&
              setDownloadTarget({
                title: 'All Vehicles',
                entityType: 'VEHICLE',
                onDownloadDetails: () => downloadVehicleCSV(vehicles),
                fallbackZipName: 'vehicle_all_docs.zip',
              })
            }
            disabled={!vehicles || vehicles.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export vehicle details or compliance docs"
          >
            <Download className="h-4 w-4" />
            Export All
          </button>
          <button
            onClick={() => setIsBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-800/30 hover:bg-navy-600 transition"
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by registration number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Registration</th>
              <th className="px-5 py-4 font-semibold">Type &amp; Vendor</th>
              <th className="px-5 py-4 font-semibold">Specs</th>
              <th className="px-5 py-4 font-semibold">Telematics</th>
              <th className="px-5 py-4 font-semibold">Odometer</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-500">
                  Loading vehicles...
                </td>
              </tr>
            ) : vehicles && vehicles.length > 0 ? (
              vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-mono font-bold text-white text-base">{v.registration_number}</div>
                    <div className="text-xs text-slate-400">{v.make || ''} {v.model || ''} {v.year ? `(${v.year})` : ''}</div>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <div className="font-medium text-slate-200">
                      {v.custom_vehicle_type || v.vehicle_type.replace(/_/g, ' ')}
                    </div>
                    {v.vendor_code ? (
                      <div className="text-silver-300 text-[11px] font-mono mt-0.5">
                        {v.vendor_code} {v.vendor_name ? `· ${v.vendor_name}` : ''}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-[11px] mt-0.5">Self Owned</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <div>{v.payload_capacity_kg ? `${v.payload_capacity_kg}` : 'Standard'}</div>
                    <div className="text-slate-500">{v.fuel_type}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Navigation className="h-3 w-3 text-navy-300" />
                      {v.gps_device_id || 'No GPS'}
                    </div>
                    <div className="text-[11px] text-slate-500">{v.fastag_id ? `FASTag: ${v.fastag_id.slice(-6)}` : ''}</div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-300">
                    {Number(v.odometer_km).toLocaleString('en-IN')} KM
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        v.status === 'AVAILABLE'
                          ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                          : v.status === 'ON_DUTY'
                          ? 'bg-silver-900/30 text-silver-500 border border-silver-700/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openProfile(v)}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                        title="View Details & Compliance"
                      >
                        <Eye className="h-3.5 w-3.5 text-silver-300" />
                        View
                      </button>
                      <button
                        onClick={() =>
                          setDownloadTarget({
                            title: v.registration_number,
                            entityType: 'VEHICLE',
                            entityId: v.id,
                            onDownloadDetails: () => downloadVehicleCSV([v], `vehicle_${v.registration_number}.csv`),
                            fallbackZipName: `${v.registration_number}_docs.zip`,
                          })
                        }
                        className="rounded bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                        title="Download details or compliance docs"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Truck className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No vehicles registered</p>
                    <p className="text-xs text-slate-500 mt-0.5">Click 'Add Vehicle' to register public transport or commercial vehicles.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-navy-400" />
                Bulk Import Vehicles
              </h2>
              <button onClick={closeBulkModal} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!bulkResult ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-400 space-y-1">
                  <p>Upload a CSV file aligned with single vehicle entry (up to <span className="text-white font-semibold">5000 vehicles</span>).</p>
                  <p>Public Transport types (default <span className="font-mono text-slate-200">SEDAN</span>): SEDAN, HATCHBACK, SUV, TEMPO_TRAVELLER, MINI_BUS, BUS, AUTO_RICKSHAW, EV_CAB — or enter any custom type name.</p>
                  <p><span className="font-mono text-slate-200">Vendor Code</span>: e.g. <span className="font-mono text-slate-300">{vendors[0]?.vendor_code || 'VND-XXXXXXXX'}</span> (leave blank for Self Owned).</p>
                </div>

                <button
                  onClick={() => downloadCSVTemplate(vendors[0]?.vendor_code)}
                  className="inline-flex items-center gap-2 text-xs text-navy-400 hover:text-navy-300 underline underline-offset-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV Template
                </button>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Select CSV File</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-xs file:text-slate-200 file:cursor-pointer hover:file:bg-slate-600"
                  />
                </div>

                {bulkError && (
                  <p className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" /> {bulkError}
                  </p>
                )}

                {bulkRows.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      Preview — <span className="text-white font-semibold">{bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''}</span> detected
                      {bulkRows.length > 5 ? ` (showing first 5)` : ''}
                    </p>
                    <div className="overflow-x-auto rounded border border-slate-700">
                      <table className="w-full text-xs text-slate-300">
                        <thead className="bg-slate-800 text-slate-400">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Registration</th>
                            <th className="px-3 py-2 text-left font-medium">Vehicle Type</th>
                            <th className="px-3 py-2 text-left font-medium">Vendor Code (Name / PAN)</th>
                            <th className="px-3 py-2 text-left font-medium">Make / Model</th>
                            <th className="px-3 py-2 text-left font-medium">Fuel</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {bulkRows.slice(0, 5).map((row, i) => {
                            const vcode = row.vendor_code?.toUpperCase();
                            const matchedVendor = vcode ? vendorByCode.get(vcode) : undefined;
                            return (
                              <tr key={i}>
                                <td className="px-3 py-2 font-mono">{row.registration_number || '—'}</td>
                                <td className="px-3 py-2 font-mono">{row.vehicle_type || 'SEDAN'}</td>
                                <td className="px-3 py-2">
                                  {vcode ? (
                                    matchedVendor ? (
                                      <div>
                                        <span className="font-mono text-white">{vcode}</span>
                                        <div className="text-[10px] text-silver-400">
                                          {matchedVendor.name} · PAN: {matchedVendor.pan || '—'}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-red-400">{vcode} (not found)</span>
                                    )
                                  ) : (
                                    <span className="text-slate-500">Self Owned</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">{[row.make, row.model, row.year].filter(Boolean).join(' ') || '—'}</td>
                                <td className="px-3 py-2 font-mono">{row.fuel_type || 'DIESEL'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button type="button" onClick={closeBulkModal} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  <button
                    disabled={bulkRows.length === 0 || bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate(bulkRows)}
                    className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition"
                  >
                    {bulkMutation.isPending ? 'Importing...' : `Import ${bulkRows.length || ''} Vehicles`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Import Complete</p>
                    <p className="text-xs text-slate-400">
                      <span className="text-green-400 font-bold">{bulkResult.succeeded} succeeded</span>
                      {bulkResult.failed > 0 && <span>, <span className="text-red-400 font-bold">{bulkResult.failed} failed</span></span>}
                    </p>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="overflow-x-auto rounded border border-slate-700">
                    <table className="w-full text-xs text-slate-300">
                      <thead className="bg-slate-800 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Registration</th>
                          <th className="px-3 py-2 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {bulkResult.errors.map((e, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono">{e.row}</td>
                            <td className="px-3 py-2 font-mono">{e.registration_number || '—'}</td>
                            <td className="px-3 py-2 text-red-400">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button onClick={closeBulkModal} className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition">
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Merged Vehicle Profile & Compliance Modal ─────────────────────── */}
      {profileVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white font-mono">{profileVehicle.registration_number}</h2>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      profileVehicle.status === 'AVAILABLE'
                        ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                        : profileVehicle.status === 'ON_DUTY'
                        ? 'bg-silver-900/30 text-silver-500 border border-silver-700/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {profileVehicle.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {profileVehicle.custom_vehicle_type || profileVehicle.vehicle_type.replace(/_/g, ' ')}
                  {profileVehicle.make && ` · ${profileVehicle.make} ${profileVehicle.model || ''} ${profileVehicle.year ? `(${profileVehicle.year})` : ''}`}
                </div>
              </div>
              <button onClick={() => setProfileVehicle(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setProfileTab('details')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'details' ? 'bg-navy-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Vehicle Details
              </button>
              <button
                type="button"
                onClick={() => { setProfileTab('docs'); setIsEditingVehicle(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'docs' ? 'bg-navy-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Compliance Docs
              </button>
            </div>

            {profileTab === 'details' ? (
              isEditingVehicle ? (
                <form onSubmit={handleEditVehicleSubmit} className="space-y-4 text-sm">
                  {/* Vehicle Type + Vendor */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Vehicle Type</label>
                      <select
                        value={editFormData.vehicle_type}
                        onChange={(e) => setEditFormData({ ...editFormData, vehicle_type: e.target.value as VehicleBodyType })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                      >
                        {serviceConfig.passenger && (
                          <optgroup label="Public Transport Vehicles">
                            {PUBLIC_TRANSPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </optgroup>
                        )}
                        {serviceConfig.cargo && (
                          <optgroup label="Commercial / Cargo">
                            {CARGO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </optgroup>
                        )}
                        <option value="OTHER">Other (Add Custom Type)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Vendor Code</label>
                      <select
                        value={editFormData.vendor_code || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, vendor_code: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                      >
                        <option value="">Self Owned (No Vendor)</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.vendor_code || ''}>{v.vendor_code ? `${v.vendor_code} — ${v.name}` : v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {editFormData.vehicle_type === 'OTHER' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Custom Vehicle Type *</label>
                      <input
                        type="text"
                        required
                        value={editFormData.custom_vehicle_type || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, custom_vehicle_type: e.target.value })}
                        placeholder="e.g. Sleeper Coach, Electric Van"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Make</label>
                      <input type="text" value={editFormData.make} onChange={(e) => setEditFormData({ ...editFormData, make: e.target.value })} placeholder="Maruti Suzuki" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Model</label>
                      <input type="text" value={editFormData.model} onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })} placeholder="Dzire Tour S" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Year</label>
                      <input type="number" min={1970} max={2050} value={editFormData.year || ''} onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value ? Number(e.target.value) : undefined })} placeholder="2023" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Fuel Type</label>
                      <select value={editFormData.fuel_type} onChange={(e) => setEditFormData({ ...editFormData, fuel_type: e.target.value as any })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none">
                        <option value="DIESEL">Diesel</option>
                        <option value="CNG">CNG</option>
                        <option value="ELECTRIC">Electric</option>
                        <option value="PETROL">Petrol</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Capacity (Seats / KG)</label>
                      <input type="number" value={editFormData.payload_capacity_kg} onChange={(e) => setEditFormData({ ...editFormData, payload_capacity_kg: e.target.value })} placeholder="4" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">Odometer (KM)</label>
                      <input type="number" value={editFormData.odometer_km} onChange={(e) => setEditFormData({ ...editFormData, odometer_km: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">FASTag ID</label>
                      <input type="text" value={editFormData.fastag_id} onChange={(e) => setEditFormData({ ...editFormData, fastag_id: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300">GPS Device IMEI / ID</label>
                      <input type="text" value={editFormData.gps_device_id} onChange={(e) => setEditFormData({ ...editFormData, gps_device_id: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Status</label>
                    <select value={editFormData.status || profileVehicle.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as Vehicle['status'] })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none">
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="ON_DUTY">ON_DUTY</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                      <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                    </select>
                  </div>
                  {editError && (
                    <p className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" /> {editError}
                    </p>
                  )}
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button type="button" onClick={() => { setIsEditingVehicle(false); setEditError(''); }} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                    <button type="submit" disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition">
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {/* Left card: Vehicle Info */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle Info</h3>
                      <div>
                        <div className="text-[11px] text-slate-500">Type</div>
                        <div className="text-white">{profileVehicle.custom_vehicle_type || profileVehicle.vehicle_type.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">Make</div>
                          <div className="text-white">{profileVehicle.make || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Model</div>
                          <div className="text-white">{profileVehicle.model || '—'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">Year</div>
                          <div className="text-white">{profileVehicle.year || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Fuel</div>
                          <div className="text-white">{profileVehicle.fuel_type}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">Capacity</div>
                          <div className="text-white font-mono">{profileVehicle.payload_capacity_kg || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Odometer</div>
                          <div className="text-white font-mono">{Number(profileVehicle.odometer_km).toLocaleString('en-IN')} KM</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Ownership</div>
                        <div className="text-white">{profileVehicle.ownership_type}</div>
                      </div>
                    </div>

                    {/* Right card: Vendor & Telematics */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor & Telematics</h3>
                      {profileVehicle.vendor_code ? (
                        <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-silver-300 shrink-0" />
                          <div>
                            <div className="text-[10px] text-slate-500 font-mono">{profileVehicle.vendor_code}</div>
                            <div className="font-semibold text-white text-sm">{profileVehicle.vendor_name || '—'}</div>
                            <div className="text-[11px] text-slate-400">PAN: {profileVehicle.vendor_pan || 'Not provided'}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">Self Owned (No Vendor)</div>
                      )}
                      <div>
                        <div className="text-[11px] text-slate-500">GPS Device ID</div>
                        <div className="text-white font-mono flex items-center gap-1.5">
                          <Navigation className="h-3 w-3 text-navy-300" />
                          {profileVehicle.gps_device_id || 'Not fitted'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">FASTag ID</div>
                        <div className="text-white font-mono">{profileVehicle.fastag_id || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Added On</div>
                        <div className="text-xs text-slate-300">{new Date(profileVehicle.created_at).toLocaleDateString('en-IN')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setDownloadTarget({
                          title: profileVehicle.registration_number,
                          entityType: 'VEHICLE',
                          entityId: profileVehicle.id,
                          onDownloadDetails: () =>
                            downloadVehicleCSV([profileVehicle], `vehicle_${profileVehicle.registration_number}.csv`),
                          fallbackZipName: `${profileVehicle.registration_number}_docs.zip`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                      title="Download details or compliance docs"
                    >
                      <Download className="h-4 w-4 text-silver-300" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(profileVehicle)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                    >
                      <Pencil className="h-4 w-4 text-silver-300" />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileVehicle(null)}
                      className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition"
                    >
                      Close
                    </button>
                  </div>
                </>
              )
            ) : (
              <div className="space-y-4">
                <div className="dark">
                  <EntityComplianceManager entityType="VEHICLE" entityId={profileVehicle.id} />
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button type="button" onClick={() => setProfileVehicle(null)} className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Register Vehicle</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300">Registration Number (Number Plate) *</label>
                <input
                  type="text"
                  required
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  placeholder="e.g. MH12AB1234"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono font-bold text-sm tracking-wider focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Vehicle Type</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as VehicleBodyType })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  >
                    {serviceConfig.passenger && (
                      <optgroup label="Public Transport Vehicles">
                        {PUBLIC_TRANSPORT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </optgroup>
                    )}
                    {serviceConfig.cargo && (
                      <optgroup label="Commercial / Cargo">
                        {CARGO_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="OTHER">Other (Add Custom Type)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Vendor Code</label>
                  <select
                    value={formData.vendor_code || ''}
                    onChange={(e) => setFormData({ ...formData, vendor_code: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  >
                    <option value="">Self Owned (No Vendor)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.vendor_code || ''}>
                        {v.vendor_code ? `${v.vendor_code} — ${v.name}` : v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.vehicle_type === 'OTHER' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300">Custom Vehicle Type *</label>
                  <input
                    type="text"
                    required
                    value={formData.custom_vehicle_type || ''}
                    onChange={(e) => setFormData({ ...formData, custom_vehicle_type: e.target.value })}
                    placeholder="e.g. Sleeper Coach, Electric Van, Shuttle"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              )}

              {selectedVendor && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-silver-300 shrink-0" />
                    <div>
                      <div className="text-slate-400 text-[10px]">Selected Vendor</div>
                      <div className="font-semibold text-white">{selectedVendor.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 text-[10px]">PAN</div>
                    <div className="font-mono text-silver-300">{selectedVendor.pan || 'Not provided'}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Make</label>
                  <input
                    type="text"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="Maruti Suzuki"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Dzire Tour S"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Year</label>
                  <input
                    type="number"
                    min={1970}
                    max={2050}
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="2023"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Fuel Type</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value as any })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="PETROL">Petrol</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Capacity (Seats / KG)</label>
                  <input
                    type="number"
                    value={formData.payload_capacity_kg}
                    onChange={(e) => setFormData({ ...formData, payload_capacity_kg: e.target.value })}
                    placeholder="4"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Odometer (KM)</label>
                  <input
                    type="number"
                    value={formData.odometer_km}
                    onChange={(e) => setFormData({ ...formData, odometer_km: e.target.value })}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">FASTag ID / Barcode</label>
                  <input
                    type="text"
                    value={formData.fastag_id}
                    onChange={(e) => setFormData({ ...formData, fastag_id: e.target.value.toUpperCase() })}
                    placeholder="34161FA123456"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">GPS Device IMEI / ID</label>
                  <input
                    type="text"
                    value={formData.gps_device_id}
                    onChange={(e) => setFormData({ ...formData, gps_device_id: e.target.value.toUpperCase() })}
                    placeholder="GPS-TRACK-9988"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              {formError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition"
                >
                  {createMutation.isPending ? 'Registering...' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DownloadChoiceModal target={downloadTarget} onClose={() => setDownloadTarget(null)} />
    </div>
  );
}
