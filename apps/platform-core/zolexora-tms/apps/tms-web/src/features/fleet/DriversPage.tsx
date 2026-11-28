import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, AlertCircle, X, ShieldCheck, Upload, Download, CheckCircle2, Eye, Pencil } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { Driver, DriverCreate, DriverBulkCreateResponse, DriverBulkItemError } from '../../types';
import { EntityComplianceManager } from '../compliance/EntityComplianceManager';
import { DownloadChoiceModal, type DownloadTarget } from '../../components/DownloadChoiceModal';

// ── CSV Helpers (aligned 1-to-1 with Single Entry) ───────────────────────────

const TEMPLATE_HEADERS = [
  'Full Name', 'Primary Phone', 'Alternate Phone', 'Email',
  'License Number', 'License Type', 'License Expiry', 'Badge Number',
  'Aadhaar Last 4', 'PAN',
];

const HEADER_ALIASES: Record<string, string> = {
  'full name': 'full_name',
  'full_name': 'full_name',
  'name': 'full_name',
  'primary phone': 'phone',
  'phone': 'phone',
  'alternate phone': 'alternate_phone',
  'alternate_phone': 'alternate_phone',
  'email': 'email',
  'license number': 'license_number',
  'driving license number': 'license_number',
  'license_number': 'license_number',
  'license type': 'license_type',
  'license_type': 'license_type',
  'license expiry': 'license_expiry',
  'license_expiry': 'license_expiry',
  'badge number': 'badge_number',
  'badge_number': 'badge_number',
  'aadhaar last 4': 'aadhaar_last4',
  'aadhaar_last4': 'aadhaar_last4',
  'pan': 'pan',
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

function isValidPan(val?: string): boolean {
  if (!val) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(val);
}

function isValidAadhaar4(val?: string): boolean {
  if (!val) return true;
  return /^\d{4}$/.test(val);
}

function getBulkRowError(r: DriverCreate): string | null {
  if (r.full_name.trim().length < 2) return 'Name too short';
  if (r.phone.trim().length < 7) return 'Invalid phone';
  if (r.license_number.trim().length < 4) return 'Invalid license no';
  if (r.aadhaar_last4 && !isValidAadhaar4(r.aadhaar_last4)) return 'Aadhaar must be 4 digits';
  if (r.pan && !isValidPan(r.pan)) return 'PAN must be 10 chars (e.g. AAAPA1234A)';
  return null;
}

function parseCsv(text: string): { rows: DriverCreate[]; error?: string } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  const header = splitCsvLine(lines[0]).map((h) => {
    const norm = h.toLowerCase();
    return HEADER_ALIASES[norm] ?? norm;
  });
  if (!header.includes('full_name') || !header.includes('phone') || !header.includes('license_number')) {
    return { rows: [], error: 'CSV must include Full Name, Primary Phone, and License Number columns.' };
  }

  const rows: DriverCreate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (field: string) => {
      const idx = header.indexOf(field);
      return idx !== -1 ? cols[idx] || '' : '';
    };
    rows.push({
      full_name: get('full_name'),
      phone: get('phone'),
      alternate_phone: get('alternate_phone') || undefined,
      email: get('email') || undefined,
      license_number: get('license_number').toUpperCase().replace(/\s+/g, ''),
      license_type: get('license_type').toUpperCase() || 'HMV',
      license_expiry: get('license_expiry') || undefined,
      badge_number: get('badge_number').toUpperCase() || undefined,
      aadhaar_last4: get('aadhaar_last4') || undefined,
      pan: get('pan').toUpperCase() || undefined,
    });
  }
  return { rows };
}

function downloadTemplate() {
  const exampleRows = [
    'Ramesh Kumar Yadav,+919988776655,+919876543210,ramesh@example.com,DL1420110012345,HMV,2029-12-31,BDG-101,5678,AAAPA1234A',
    'Suresh Singh,+919811223344,,suresh@example.com,MH1220150099887,TRANS,2028-06-30,,4321,BBBPB5678B',
  ].join('\n');
  const csv = [TEMPLATE_HEADERS.join(','), exampleRows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'driver_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export driver(s) as CSV ──────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Driver Code', 'Full Name', 'Status',
  'Primary Phone', 'Alternate Phone', 'Email',
  'License Number', 'License Type', 'License Expiry', 'Badge Number',
  'Aadhaar Last 4', 'PAN', 'Created At',
];

function escapeCsvField(val: string | number | undefined): string {
  const s = val !== undefined && val !== null ? String(val) : '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadDriverCSV(rows: Driver[], filename = 'drivers_export.csv') {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const d of rows) {
    lines.push([
      d.driver_code, d.full_name, d.status,
      d.phone, d.alternate_phone, d.email,
      d.license_number, d.license_type, d.license_expiry, d.badge_number,
      d.aadhaar_last4, d.pan,
      new Date(d.created_at).toLocaleDateString('en-IN'),
    ].map(escapeCsvField).join(','));
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared Form Fields ───────────────────────────────────────────────────────

const EMPTY_DRIVER_FORM: DriverCreate = {
  full_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  license_number: '',
  license_type: 'HMV',
  license_expiry: '',
  badge_number: '',
  aadhaar_last4: '',
  pan: '',
};

function DriverFormFields({
  value,
  onChange,
}: {
  value: DriverCreate;
  onChange: (next: DriverCreate) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Full Name *</label>
          <input
            type="text"
            required
            value={value.full_name}
            onChange={(e) => onChange({ ...value, full_name: e.target.value })}
            placeholder="e.g. Ramesh Kumar Yadav"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">Email</label>
          <input
            type="email"
            value={value.email || ''}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="driver@example.com"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Primary Phone *</label>
          <input
            type="text"
            required
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="+919988776655"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">Alternate Phone</label>
          <input
            type="text"
            value={value.alternate_phone || ''}
            onChange={(e) => onChange({ ...value, alternate_phone: e.target.value })}
            placeholder="+919876543210"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Driving License No *</label>
          <input
            type="text"
            required
            value={value.license_number}
            onChange={(e) => onChange({ ...value, license_number: e.target.value.toUpperCase().replace(/\s+/g, '') })}
            placeholder="DL1420110012345"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">License Type</label>
          <select
            value={value.license_type || 'HMV'}
            onChange={(e) => onChange({ ...value, license_type: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          >
            <option value="HMV">Heavy Motor Vehicle (HMV)</option>
            <option value="TRANS">Transport Vehicle (TRANS)</option>
            <option value="LMV">Light Motor Vehicle (LMV)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">License Expiry</label>
          <input
            type="date"
            value={value.license_expiry || ''}
            onChange={(e) => onChange({ ...value, license_expiry: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Badge Number</label>
          <input
            type="text"
            value={value.badge_number || ''}
            onChange={(e) => onChange({ ...value, badge_number: e.target.value.toUpperCase() })}
            placeholder="BDG-101"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">Aadhaar (Last 4)</label>
          <input
            type="text"
            maxLength={4}
            value={value.aadhaar_last4 || ''}
            onChange={(e) => onChange({ ...value, aadhaar_last4: e.target.value })}
            placeholder="5678"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">PAN</label>
          <input
            type="text"
            maxLength={10}
            value={value.pan || ''}
            onChange={(e) => onChange({ ...value, pan: e.target.value.toUpperCase() })}
            placeholder="AAAPA1234A"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DriversPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileDriver, setProfileDriver] = useState<Driver | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'docs'>('details');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState<DriverCreate & { status: Driver['status'] }>({
    ...EMPTY_DRIVER_FORM,
    status: 'AVAILABLE',
  });
  const [editError, setEditError] = useState('');
  const [formError, setFormError] = useState('');
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget | null>(null);

  // Bulk state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<DriverCreate[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkResult, setBulkResult] = useState<DriverBulkCreateResponse | null>(null);

  const [formData, setFormData] = useState<DriverCreate>(EMPTY_DRIVER_FORM);

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers', search],
    queryFn: () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiClient<Driver[]>(`/api/v1/drivers${q}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DriverCreate) =>
      apiClient<Driver>('/api/v1/drivers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setIsModalOpen(false);
      setFormData(EMPTY_DRIVER_FORM);
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to enroll driver');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DriverCreate> & { status?: Driver['status'] } }) =>
      apiClient<Driver>(`/api/v1/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setProfileDriver(updated);
      setIsEditingProfile(false);
      setEditError('');
    },
    onError: (err: any) => {
      setEditError(err.message || 'Failed to update driver');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (driversPayload: DriverCreate[]) =>
      apiClient<DriverBulkCreateResponse>('/api/v1/drivers/bulk', {
        method: 'POST',
        body: JSON.stringify({ drivers: driversPayload }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setBulkResult(res);
    },
  });

  const openProfile = (d: Driver) => {
    setProfileDriver(d);
    setProfileTab('details');
    setIsEditingProfile(false);
    setEditError('');
  };

  const startEditProfile = (d: Driver) => {
    setEditFormData({
      full_name: d.full_name,
      phone: d.phone,
      alternate_phone: d.alternate_phone || '',
      email: d.email || '',
      license_number: d.license_number,
      license_type: d.license_type,
      license_expiry: d.license_expiry || '',
      badge_number: d.badge_number || '',
      aadhaar_last4: d.aadhaar_last4 || '',
      pan: d.pan || '',
      status: d.status,
    });
    setEditError('');
    setIsEditingProfile(true);
  };

  const validateDriverFields = (d: DriverCreate): string | null => {
    if (!d.full_name.trim() || !d.phone.trim() || !d.license_number.trim()) {
      return 'Name, Primary Phone, and Driving License Number are required.';
    }
    if (d.aadhaar_last4 && !isValidAadhaar4(d.aadhaar_last4.trim())) {
      return 'Aadhaar Last 4 must be 4 digits.';
    }
    if (d.pan && !isValidPan(d.pan.trim().toUpperCase())) {
      return 'PAN must be 10 characters (e.g. AAAPA1234A).';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateDriverFields(formData);
    if (err) {
      setFormError(err);
      return;
    }
    createMutation.mutate({
      ...formData,
      license_number: formData.license_number.toUpperCase().replace(/\s+/g, ''),
      license_expiry: formData.license_expiry || undefined,
      alternate_phone: formData.alternate_phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      badge_number: formData.badge_number?.trim().toUpperCase() || undefined,
      aadhaar_last4: formData.aadhaar_last4?.trim() || undefined,
      pan: formData.pan?.trim().toUpperCase() || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileDriver) return;
    const err = validateDriverFields(editFormData);
    if (err) {
      setEditError(err);
      return;
    }
    updateMutation.mutate({
      id: profileDriver.id,
      data: {
        full_name: editFormData.full_name.trim(),
        phone: editFormData.phone.trim(),
        alternate_phone: editFormData.alternate_phone?.trim() || undefined,
        email: editFormData.email?.trim() || undefined,
        license_number: editFormData.license_number.toUpperCase().replace(/\s+/g, ''),
        license_type: editFormData.license_type,
        license_expiry: editFormData.license_expiry || undefined,
        badge_number: editFormData.badge_number?.trim().toUpperCase() || undefined,
        aadhaar_last4: editFormData.aadhaar_last4?.trim() || undefined,
        pan: editFormData.pan?.trim().toUpperCase() || undefined,
        status: editFormData.status,
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, error } = parseCsv(text);
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

  const validBulkRows = bulkRows.filter((r) => !getBulkRowError(r));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Drivers Roster</h1>
          <p className="text-sm text-slate-400">Driver roster, commercial license verification, and compliance tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              drivers &&
              drivers.length > 0 &&
              setDownloadTarget({
                title: 'All Drivers',
                entityType: 'DRIVER',
                onDownloadDetails: () => downloadDriverCSV(drivers),
                fallbackZipName: 'driver_all_docs.zip',
              })
            }
            disabled={!drivers || drivers.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export driver details or compliance docs"
          >
            <Download className="h-4 w-4" />
            Export All
          </button>
          <button
            onClick={() => setIsBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <Upload className="h-4 w-4" />
            Bulk Import
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-800/30 hover:bg-navy-600 transition"
          >
            <Plus className="h-4 w-4" />
            Enroll Driver
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, driver code, phone, license, or PAN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Driver Name &amp; Phone</th>
              <th className="px-5 py-4 font-semibold">License &amp; KYC</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-500">
                  Loading drivers...
                </td>
              </tr>
            ) : drivers && drivers.length > 0 ? (
              drivers.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{d.full_name}</div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      {d.driver_code && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-silver-300">
                          {d.driver_code}
                        </span>
                      )}
                      <span>{d.phone}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono">
                    <div className="text-silver-400">{d.license_number} ({d.license_type})</div>
                    <div className="text-slate-500 text-[11px]">
                      {[d.aadhaar_last4 ? `Aadhaar: ••••${d.aadhaar_last4}` : '', d.pan ? `PAN: ${d.pan}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        d.status === 'AVAILABLE'
                          ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                          : d.status === 'ON_DUTY'
                          ? 'bg-silver-900/30 text-silver-500 border border-silver-700/20'
                          : 'bg-slate-700/20 text-slate-400'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openProfile(d)}
                        className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                        title="View Profile & Compliance Docs"
                      >
                        <Eye className="h-3.5 w-3.5 text-silver-300" />
                        View
                      </button>
                      <button
                        onClick={() =>
                          setDownloadTarget({
                            title: d.full_name,
                            entityType: 'DRIVER',
                            entityId: d.id,
                            onDownloadDetails: () => downloadDriverCSV([d], `driver_${d.driver_code || d.id}.csv`),
                            fallbackZipName: `${d.full_name}_docs.zip`,
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
                <td colSpan={4} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Users className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No drivers registered</p>
                    <p className="text-xs text-slate-500 mt-0.5">Click 'Enroll Driver' to add transport drivers with commercial licenses.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Merged Driver Profile & Compliance Modal */}
      {profileDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white">{profileDriver.full_name}</h2>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      profileDriver.status === 'AVAILABLE'
                        ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                        : profileDriver.status === 'ON_DUTY'
                        ? 'bg-silver-900/30 text-silver-500 border border-silver-700/20'
                        : 'bg-slate-700/20 text-slate-400'
                    }`}
                  >
                    {profileDriver.status}
                  </span>
                </div>
                {profileDriver.driver_code && (
                  <div className="mt-1">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-silver-300">
                      {profileDriver.driver_code}
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => setProfileDriver(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setProfileTab('details')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'details'
                    ? 'bg-navy-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Profile Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileTab('docs');
                  setIsEditingProfile(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  profileTab === 'docs'
                    ? 'bg-navy-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Compliance Docs
              </button>
            </div>

            {profileTab === 'details' ? (
              isEditingProfile ? (
                <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
                  <DriverFormFields
                    value={editFormData}
                    onChange={(next) => setEditFormData({ ...next, status: editFormData.status })}
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-300">Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as Driver['status'] })}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="ON_DUTY">ON_DUTY</option>
                      <option value="ON_LEAVE">ON_LEAVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>

                  {editError && (
                    <p className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {editError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setEditError('');
                      }}
                      className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition"
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact &amp; KYC</h3>
                      <div>
                        <div className="text-[11px] text-slate-500">Primary Phone</div>
                        <div className="text-white font-mono">{profileDriver.phone}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Alternate Phone</div>
                        <div className="text-white font-mono">{profileDriver.alternate_phone || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Email</div>
                        <div className="text-white">{profileDriver.email || '—'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <div className="text-[11px] text-slate-500">Aadhaar Last 4</div>
                          <div className="text-white font-mono text-xs">
                            {profileDriver.aadhaar_last4 ? `••••${profileDriver.aadhaar_last4}` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">PAN</div>
                          <div className="text-white font-mono text-xs">{profileDriver.pan || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">License Details</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">License Number</div>
                          <div className="text-white font-mono text-xs">{profileDriver.license_number}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">License Type</div>
                          <div className="text-white">{profileDriver.license_type}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">License Expiry</div>
                          <div className="text-white text-xs">{profileDriver.license_expiry || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Badge Number</div>
                          <div className="text-white font-mono text-xs">{profileDriver.badge_number || '—'}</div>
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="text-[11px] text-slate-500">Enrolled On</div>
                        <div className="text-xs text-slate-300">
                          {new Date(profileDriver.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setDownloadTarget({
                          title: profileDriver.full_name,
                          entityType: 'DRIVER',
                          entityId: profileDriver.id,
                          onDownloadDetails: () =>
                            downloadDriverCSV([profileDriver], `driver_${profileDriver.driver_code || profileDriver.id}.csv`),
                          fallbackZipName: `${profileDriver.full_name}_docs.zip`,
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
                      onClick={() => startEditProfile(profileDriver)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                    >
                      <Pencil className="h-4 w-4 text-silver-300" />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileDriver(null)}
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
                  <EntityComplianceManager entityType="DRIVER" entityId={profileDriver.id} />
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setProfileDriver(null)}
                    className="rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enroll Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Enroll New Driver</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <DriverFormFields value={formData} onChange={setFormData} />

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
                  {createMutation.isPending ? 'Enrolling...' : 'Enroll Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Bulk Import Drivers</h2>
              <button onClick={closeBulk} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
              <span className="text-slate-400">
                Upload a CSV aligned with single entry (up to 5,000 rows). Phone, License Number &amp; PAN must be unique; Driver Code is auto-generated.
              </span>
              <button
                type="button"
                onClick={downloadTemplate}
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
                onChange={handleFileChange}
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
                        <th className="px-3 py-2">Full Name</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">License</th>
                        <th className="px-3 py-2">PAN / Aadhaar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bulkRows.slice(0, 5).map((r, i) => {
                        const rowErr = getBulkRowError(r);
                        return (
                          <tr key={i} className={rowErr ? 'bg-red-500/10' : ''}>
                            <td className="px-3 py-2 font-medium text-white">
                              {r.full_name || <span className="text-red-400">(missing)</span>}
                              {rowErr && <div className="text-[10px] text-red-400">{rowErr}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.phone || '—'}</td>
                            <td className="px-3 py-2 font-mono">{r.license_number || '—'}</td>
                            <td className="px-3 py-2 font-mono">
                              {[r.pan, r.aadhaar_last4 ? `••••${r.aadhaar_last4}` : ''].filter(Boolean).join(' · ') || '—'}
                            </td>
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
                    {bulkResult.created_count} imported
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
                          <th className="px-3 py-1.5">Name</th>
                          <th className="px-3 py-1.5">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {bulkResult.errors.map((err: DriverBulkItemError, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-mono">{err.row}</td>
                            <td className="px-3 py-1.5">{err.full_name || '---'}</td>
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
                  {bulkMutation.isPending ? 'Importing...' : `Import ${bulkRows.length} Drivers`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <DownloadChoiceModal target={downloadTarget} onClose={() => setDownloadTarget(null)} />
    </div>
  );
}
