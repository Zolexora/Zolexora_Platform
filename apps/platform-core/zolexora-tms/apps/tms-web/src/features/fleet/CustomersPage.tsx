import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, AlertCircle, X, ShieldCheck, Upload, Download, CheckCircle2, Eye, Pencil } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { Customer, CustomerCreate, CustomerBulkCreateResponse, CustomerBulkItemError } from '../../types';
import { EntityComplianceManager } from '../compliance/EntityComplianceManager';
import { DownloadChoiceModal, type DownloadTarget } from '../../components/DownloadChoiceModal';

// ── CSV helpers ──────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'Customer Legal Name', 'Contact Person', 'Email', 'Phone',
  'GSTIN / Aadhaar No', 'PAN', 'Payment Terms (Days)', 'Credit Limit (INR)',
  'Billing Address', 'Notes',
];

const HEADER_ALIASES: Record<string, string> = {
  'customer legal name': 'name',
  'customer name': 'name',
  'client name': 'name',
  'name': 'name',
  'contact person': 'contact_person',
  'contact_person': 'contact_person',
  'email': 'email',
  'phone': 'phone',
  'gstin / aadhaar no': 'gstin',
  'gstin/aadhaar no': 'gstin',
  'gstin': 'gstin',
  'pan': 'pan',
  'payment terms (days)': 'payment_terms_days',
  'payment_terms_days': 'payment_terms_days',
  'credit limit (inr)': 'credit_limit',
  'credit_limit': 'credit_limit',
  'billing address': 'billing_address',
  'billing_address': 'billing_address',
  'notes': 'notes',
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

function isValidGstinOrAadhaar(val?: string): boolean {
  if (!val) return true;
  return /^\d{12}$/.test(val) || /^[A-Z0-9]{15}$/.test(val);
}

function isValidPan(val?: string): boolean {
  if (!val) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(val);
}

function getBulkRowError(r: CustomerCreate): string | null {
  if (r.name.trim().length < 2) return 'Name too short';
  if (r.gstin && !isValidGstinOrAadhaar(r.gstin)) return 'GSTIN/Aadhaar must be 12 digits or 15 chars';
  if (r.pan && !isValidPan(r.pan)) return 'PAN must be 10 chars (e.g. AAACT2727Q)';
  return null;
}

function parseCsv(text: string): { rows: CustomerCreate[]; error?: string } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  const header = splitCsvLine(lines[0]).map((h) => {
    const normalised = h.toLowerCase();
    return HEADER_ALIASES[normalised] ?? normalised;
  });
  if (!header.includes('name')) return { rows: [], error: 'CSV must have a "Customer Legal Name" or "name" column.' };

  const rows: CustomerCreate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (field: string) => {
      const idx = header.indexOf(field);
      return idx !== -1 ? cols[idx] || '' : '';
    };
    const termsRaw = get('payment_terms_days');
    const creditRaw = get('credit_limit');
    rows.push({
      name: get('name'),
      contact_person: get('contact_person') || undefined,
      email: get('email') || undefined,
      phone: get('phone') || undefined,
      gstin: get('gstin').toUpperCase() || undefined,
      pan: get('pan').toUpperCase() || undefined,
      payment_terms_days: termsRaw ? Number(termsRaw) : 30,
      credit_limit: creditRaw || '0',
      billing_address: get('billing_address') || undefined,
      notes: get('notes') || undefined,
    });
  }
  return { rows };
}

function downloadTemplate() {
  const exampleRow = [
    'Tata Consumer Products Ltd', 'Vikram Malhotra', 'vikram@tataconsumer.com', '+919876543210',
    '27AAACT2727Q1ZW', 'AAACT2727Q', '30', '500000',
    '"Kirloskar Business Park, Bengaluru"', 'Priority enterprise client',
  ].join(',');
  const csv = [TEMPLATE_HEADERS.join(','), exampleRow].join('\n');
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.href = url;
  a.download = 'client_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export client(s) as CSV ──────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Client Code', 'Customer Legal Name', 'Status',
  'Contact Person', 'Email', 'Phone',
  'GSTIN / Aadhaar No', 'PAN',
  'Payment Terms (Days)', 'Credit Limit (INR)',
  'Billing Address', 'Notes', 'Created At',
];

function escapeCsvField(val: string | number | undefined): string {
  const s = val !== undefined && val !== null ? String(val) : '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function clientsToCSV(rows: Customer[]): string {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const c of rows) {
    lines.push([
      c.client_code, c.name, c.status,
      c.contact_person, c.email, c.phone,
      c.gstin, c.pan,
      c.payment_terms_days, c.credit_limit,
      c.billing_address, c.notes,
      new Date(c.created_at).toLocaleDateString('en-IN'),
    ].map(escapeCsvField).join(','));
  }
  return lines.join('\n');
}

function downloadClientCSV(rows: Customer[], filename = 'clients_export.csv') {
  const url = URL.createObjectURL(new Blob([clientsToCSV(rows)], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Shared Form Fields ───────────────────────────────────────────────────────

const EMPTY_CUSTOMER_FORM: CustomerCreate = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  billing_address: '',
  gstin: '',
  pan: '',
  credit_limit: '0',
  payment_terms_days: 30,
  notes: '',
};

function CustomerFormFields({
  value,
  onChange,
}: {
  value: CustomerCreate;
  onChange: (next: CustomerCreate) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-300">Customer Legal Name *</label>
        <input
          type="text"
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Tata Consumer Products Ltd"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Contact Person</label>
          <input
            type="text"
            value={value.contact_person || ''}
            onChange={(e) => onChange({ ...value, contact_person: e.target.value })}
            placeholder="e.g. Vikram Malhotra"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">Email</label>
          <input
            type="email"
            value={value.email || ''}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="vikram@tataconsumer.com"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">Phone</label>
          <input
            type="text"
            value={value.phone || ''}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="+919876543210"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">Payment Terms (Days)</label>
          <input
            type="number"
            value={value.payment_terms_days ?? 30}
            onChange={(e) => onChange({ ...value, payment_terms_days: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300">GSTIN / Aadhaar No</label>
          <input
            type="text"
            value={value.gstin || ''}
            onChange={(e) => onChange({ ...value, gstin: e.target.value.toUpperCase() })}
            placeholder="27AAACT2727Q1ZW"
            maxLength={15}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300">PAN</label>
          <input
            type="text"
            value={value.pan || ''}
            onChange={(e) => onChange({ ...value, pan: e.target.value.toUpperCase() })}
            placeholder="AAACT2727Q"
            maxLength={10}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300">Credit Limit (INR)</label>
        <input
          type="number"
          value={value.credit_limit || '0'}
          onChange={(e) => onChange({ ...value, credit_limit: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300">Billing Address</label>
        <textarea
          rows={2}
          value={value.billing_address || ''}
          onChange={(e) => onChange({ ...value, billing_address: e.target.value })}
          placeholder="Official registered address for invoices..."
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-300">Notes</label>
        <input
          type="text"
          value={value.notes || ''}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Optional billing or contract notes"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
        />
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CustomersPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'docs'>('details');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState<CustomerCreate & { status: Customer['status'] }>({
    ...EMPTY_CUSTOMER_FORM,
    status: 'ACTIVE',
  });
  const [editError, setEditError] = useState('');
  const [formError, setFormError] = useState('');
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget | null>(null);

  // Bulk state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<CustomerCreate[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkResult, setBulkResult] = useState<CustomerBulkCreateResponse | null>(null);

  const [formData, setFormData] = useState<CustomerCreate>(EMPTY_CUSTOMER_FORM);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiClient<Customer[]>(`/api/v1/crm/clients${q}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerCreate) =>
      apiClient<Customer>('/api/v1/crm/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      setFormData(EMPTY_CUSTOMER_FORM);
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerCreate> & { status?: Customer['status'] } }) =>
      apiClient<Customer>(`/api/v1/crm/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setProfileCustomer(updated);
      setIsEditingProfile(false);
      setEditError('');
    },
    onError: (err: any) => {
      setEditError(err.message || 'Failed to update customer');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (clients: CustomerCreate[]) =>
      apiClient<CustomerBulkCreateResponse>('/api/v1/crm/clients/bulk', {
        method: 'POST',
        body: JSON.stringify({ clients }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setBulkResult(res);
    },
  });

  const openProfile = (c: Customer) => {
    setProfileCustomer(c);
    setProfileTab('details');
    setIsEditingProfile(false);
    setEditError('');
  };

  const startEditProfile = (c: Customer) => {
    setEditFormData({
      name: c.name,
      contact_person: c.contact_person || '',
      email: c.email || '',
      phone: c.phone || '',
      billing_address: c.billing_address || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      payment_terms_days: c.payment_terms_days,
      credit_limit: c.credit_limit,
      notes: c.notes || '',
      status: c.status,
    });
    setEditError('');
    setIsEditingProfile(true);
  };

  const validateTaxFields = (gstin?: string, pan?: string): string | null => {
    const cleanGstin = gstin?.trim().toUpperCase();
    const cleanPan = pan?.trim().toUpperCase();
    if (cleanGstin && !isValidGstinOrAadhaar(cleanGstin)) {
      return 'GSTIN / Aadhaar No must be a 12-digit Aadhaar number or a 15-character GSTIN.';
    }
    if (cleanPan && !isValidPan(cleanPan)) {
      return 'PAN must be 10 characters (e.g. AAACT2727Q).';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    const taxErr = validateTaxFields(formData.gstin, formData.pan);
    if (taxErr) {
      setFormError(taxErr);
      return;
    }
    createMutation.mutate({
      ...formData,
      gstin: formData.gstin?.trim().toUpperCase() || undefined,
      pan: formData.pan?.trim().toUpperCase() || undefined,
      credit_limit: formData.credit_limit || '0',
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileCustomer) return;
    if (!editFormData.name.trim()) {
      setEditError('Customer name is required.');
      return;
    }
    const taxErr = validateTaxFields(editFormData.gstin, editFormData.pan);
    if (taxErr) {
      setEditError(taxErr);
      return;
    }
    updateMutation.mutate({
      id: profileCustomer.id,
      data: {
        name: editFormData.name.trim(),
        contact_person: editFormData.contact_person?.trim() || undefined,
        email: editFormData.email?.trim() || undefined,
        phone: editFormData.phone?.trim() || undefined,
        billing_address: editFormData.billing_address?.trim() || undefined,
        gstin: editFormData.gstin?.trim().toUpperCase() || undefined,
        pan: editFormData.pan?.trim().toUpperCase() || undefined,
        payment_terms_days: editFormData.payment_terms_days ?? 30,
        credit_limit: editFormData.credit_limit || '0',
        notes: editFormData.notes?.trim() || undefined,
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
          <h1 className="text-2xl font-bold text-white">Customers &amp; Clients</h1>
          <p className="text-sm text-slate-400">Manage client billing, credit limits, and contact information.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              customers &&
              customers.length > 0 &&
              setDownloadTarget({
                title: 'All Clients',
                entityType: 'CUSTOMER',
                onDownloadDetails: () => downloadClientCSV(customers),
                fallbackZipName: 'customer_all_docs.zip',
              })
            }
            disabled={!customers || customers.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export client details or compliance docs"
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
            Add Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by name, client code, GSTIN, PAN, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Customer Name</th>
              <th className="px-5 py-4 font-semibold">Contact</th>
              <th className="px-5 py-4 font-semibold">GSTIN / PAN</th>
              <th className="px-5 py-4 font-semibold">Payment Terms</th>
              <th className="px-5 py-4 font-semibold">Credit Limit</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-500">
                  Loading customers...
                </td>
              </tr>
            ) : customers && customers.length > 0 ? (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{c.name}</div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      {c.client_code && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-silver-300">
                          {c.client_code}
                        </span>
                      )}
                      <span>{c.phone || c.email || 'No direct contact'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs">{c.contact_person || '---'}</td>
                  <td className="px-5 py-4 font-mono text-xs">
                    <div>{c.gstin || '---'}</div>
                    <div className="text-[11px] text-slate-500">{c.pan || ''}</div>
                  </td>
                  <td className="px-5 py-4 text-xs">{c.payment_terms_days} days</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-200">₹{Number(c.credit_limit).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        c.status === 'ACTIVE'
                          ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                          : 'bg-slate-700/20 text-slate-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openProfile(c)}
                        className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                        title="View Profile & Compliance Docs"
                      >
                        <Eye className="h-3.5 w-3.5 text-silver-300" />
                        View
                      </button>
                      <button
                        onClick={() =>
                          setDownloadTarget({
                            title: c.name,
                            entityType: 'CUSTOMER',
                            entityId: c.id,
                            onDownloadDetails: () => downloadClientCSV([c], `client_${c.client_code || c.id}.csv`),
                            fallbackZipName: `${c.name}_docs.zip`,
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
                    <Building2 className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No customers registered</p>
                    <p className="text-xs text-slate-500 mt-0.5">Click 'Add Customer' to create a new client account.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Merged Customer Profile & Compliance Modal */}
      {profileCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white">{profileCustomer.name}</h2>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      profileCustomer.status === 'ACTIVE'
                        ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                        : 'bg-slate-700/20 text-slate-400'
                    }`}
                  >
                    {profileCustomer.status}
                  </span>
                </div>
                {profileCustomer.client_code && (
                  <div className="mt-1">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-silver-300">
                      {profileCustomer.client_code}
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => setProfileCustomer(null)} className="text-slate-400 hover:text-white">
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
                  <CustomerFormFields
                    value={editFormData}
                    onChange={(next) => setEditFormData({ ...next, status: editFormData.status })}
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-300">Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as Customer['status'] })}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ONBOARDING">ONBOARDING</option>
                      <option value="SUSPENDED">SUSPENDED</option>
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
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact &amp; Tax</h3>
                      <div>
                        <div className="text-[11px] text-slate-500">Contact Person</div>
                        <div className="text-white">{profileCustomer.contact_person || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Email</div>
                        <div className="text-white">{profileCustomer.email || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Phone</div>
                        <div className="text-white font-mono">{profileCustomer.phone || '—'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <div className="text-[11px] text-slate-500">GSTIN / Aadhaar No</div>
                          <div className="text-white font-mono text-xs">{profileCustomer.gstin || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">PAN</div>
                          <div className="text-white font-mono text-xs">{profileCustomer.pan || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Billing &amp; Credit</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500">Payment Terms</div>
                          <div className="text-white">{profileCustomer.payment_terms_days} days</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Credit Limit</div>
                          <div className="text-white font-mono">₹{Number(profileCustomer.credit_limit).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Billing Address</div>
                        <div className="text-white">{profileCustomer.billing_address || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Notes</div>
                        <div className="text-slate-300 text-xs">{profileCustomer.notes || '—'}</div>
                      </div>
                      <div className="pt-1">
                        <div className="text-[11px] text-slate-500">Created</div>
                        <div className="text-xs text-slate-300">
                          {new Date(profileCustomer.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setDownloadTarget({
                          title: profileCustomer.name,
                          entityType: 'CUSTOMER',
                          entityId: profileCustomer.id,
                          onDownloadDetails: () =>
                            downloadClientCSV([profileCustomer], `client_${profileCustomer.client_code || profileCustomer.id}.csv`),
                          fallbackZipName: `${profileCustomer.name}_docs.zip`,
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
                      onClick={() => startEditProfile(profileCustomer)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                    >
                      <Pencil className="h-4 w-4 text-silver-300" />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileCustomer(null)}
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
                  <EntityComplianceManager entityType="CUSTOMER" entityId={profileCustomer.id} />
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setProfileCustomer(null)}
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

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Add New Customer</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <CustomerFormFields value={formData} onChange={setFormData} />

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
                  {createMutation.isPending ? 'Saving...' : 'Save Customer'}
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
              <h2 className="text-lg font-bold text-white">Bulk Import Customers</h2>
              <button onClick={closeBulk} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs">
              <span className="text-slate-400">
                Upload a CSV file aligned with single entry (up to 5,000 rows). Client Code is auto-generated; GSTIN &amp; PAN must be unique.
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
                        <th className="px-3 py-2">Customer Legal Name</th>
                        <th className="px-3 py-2">GSTIN / PAN</th>
                        <th className="px-3 py-2">Terms / Limit</th>
                        <th className="px-3 py-2">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bulkRows.slice(0, 5).map((r, i) => {
                        const rowErr = getBulkRowError(r);
                        return (
                          <tr key={i} className={rowErr ? 'bg-red-500/10' : ''}>
                            <td className="px-3 py-2 font-medium text-white">
                              {r.name || <span className="text-red-400">(missing)</span>}
                              {rowErr && <div className="text-[10px] text-red-400">{rowErr}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              <div>{r.gstin || '---'}</div>
                              <div className="text-[10px] text-slate-500">{r.pan || ''}</div>
                            </td>
                            <td className="px-3 py-2">
                              {r.payment_terms_days ?? 30}d / ₹{r.credit_limit || '0'}
                            </td>
                            <td className="px-3 py-2">{r.contact_person || r.phone || '---'}</td>
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
                        {bulkResult.errors.map((err: CustomerBulkItemError, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 font-mono">{err.row}</td>
                            <td className="px-3 py-1.5">{err.name || '---'}</td>
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
                  {bulkMutation.isPending ? 'Importing...' : `Import ${bulkRows.length} Customers`}
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
