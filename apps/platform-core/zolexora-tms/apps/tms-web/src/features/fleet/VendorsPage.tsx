import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, AlertCircle, X, ShieldCheck, Upload, Download, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { Vendor, VendorCreate, VendorBulkCreateResponse, VendorBulkItemError } from '../../types';
import { EntityComplianceManager } from '../compliance/EntityComplianceManager';

// ── CSV helpers ──────────────────────────────────────────────────────────────

// Display headers used in the downloaded CSV template
const TEMPLATE_HEADERS = [
  'Vendor / Supplier Name', 'Vendor Type', 'Contact Person', 'Email', 'Phone',
  'Address', 'GSTIN / Aadhaar No', 'PAN', 'Bank Account Name', 'Bank Account Number',
  'Bank IFSC', 'Bank Name',
];

// Map friendly display headers → internal field keys (case-insensitive)
const HEADER_ALIASES: Record<string, string> = {
  'vendor / supplier name': 'name',
  'vendor/supplier name': 'name',
  'vendor type': 'vendor_type',
  'contact person': 'contact_person',
  'email': 'email',
  'phone': 'phone',
  'address': 'address',
  'gstin / aadhaar no': 'gstin',
  'gstin/aadhaar no': 'gstin',
  'pan': 'pan',
  'bank account name': 'bank_account_name',
  'bank account number': 'bank_account_number',
  'bank ifsc': 'bank_ifsc',
  'bank name': 'bank_name',
};

const VENDOR_TYPES = ['FLEET_SUPPLIER', 'DCO', 'EMI_DRIVER', 'WORKSHOP', 'FUEL_PARTNER', 'BROKER', 'OTHER'] as const;

function parseCsv(text: string): { rows: VendorCreate[]; error?: string } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };

  // Normalise header: lowercase, resolve friendly display names → field keys
  const header = lines[0].split(',').map((h) => {
    const normalised = h.trim().toLowerCase();
    return HEADER_ALIASES[normalised] ?? normalised;
  });
  const nameIdx = header.indexOf('name');
  if (nameIdx === -1) return { rows: [], error: 'CSV must have a "name" column.' };

  const rows: VendorCreate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const get = (field: string) => {
      const idx = header.indexOf(field);
      return idx !== -1 ? cols[idx] || '' : '';
    };
    const rawType = get('vendor_type').toUpperCase();
    const vendor_type = (VENDOR_TYPES as readonly string[]).includes(rawType)
      ? (rawType as VendorCreate['vendor_type'])
      : 'FLEET_SUPPLIER';
    rows.push({
      name: get('name'),
      vendor_type,
      contact_person: get('contact_person') || undefined,
      email: get('email') || undefined,
      phone: get('phone') || undefined,
      address: get('address') || undefined,
      gstin: get('gstin').toUpperCase() || undefined,
      pan: get('pan').toUpperCase() || undefined,
      bank_account_name: get('bank_account_name') || undefined,
      bank_account_number: get('bank_account_number') || undefined,
      bank_ifsc: get('bank_ifsc').toUpperCase() || undefined,
      bank_name: get('bank_name') || undefined,
    });
  }
  return { rows };
}

function downloadTemplate() {
  const exampleRow = [
    'Western Fleet Logistics', 'FLEET_SUPPLIER', 'Rajesh Sharma',
    'rajesh@wfl.in', '+919811223344', 'Mumbai',
    '07AAAAA0000A1Z5', 'AAAPA1234A', 'Western Fleet Logistics',
    '918273645019', 'HDFC0001234', 'HDFC Bank',
  ].join(',');
  const csv = [TEMPLATE_HEADERS.join(','), exampleRow].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'vendor_bulk_template.csv';
  a.click();
}

// ── Main component ───────────────────────────────────────────────────────────

export function VendorsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [complianceModalId, setComplianceModalId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // Bulk state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<VendorCreate[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkResult, setBulkResult] = useState<VendorBulkCreateResponse | null>(null);

  const [formData, setFormData] = useState<VendorCreate>({
    name: '',
    vendor_type: 'FLEET_SUPPLIER',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    pan: '',
  });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', search],
    queryFn: () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return apiClient<Vendor[]>(`/api/v1/vendors${q}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VendorCreate) =>
      apiClient<Vendor>('/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsModalOpen(false);
      setFormData({
        name: '',
        vendor_type: 'FLEET_SUPPLIER',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        pan: '',
      });
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create vendor');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (vendors: VendorCreate[]) =>
      apiClient<VendorBulkCreateResponse>('/api/v1/vendors/bulk', {
        method: 'POST',
        body: JSON.stringify({ vendors }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setBulkResult(res);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Vendor name is required.');
      return;
    }
    createMutation.mutate({
      ...formData,
      gstin: formData.gstin?.toUpperCase() || '',
      pan: formData.pan?.toUpperCase() || '',
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

  const validBulkRows = bulkRows.filter((r) => r.name.trim().length >= 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors &amp; Partners</h1>
          <p className="text-sm text-slate-400">Market suppliers, agencies, and maintenance partners.</p>
        </div>
        <div className="flex items-center gap-2">
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
            Add Vendor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search vendors by name or GSTIN..."
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
              <th className="px-5 py-4 font-semibold">Vendor Name</th>
              <th className="px-5 py-4 font-semibold">Type</th>
              <th className="px-5 py-4 font-semibold">Contact</th>
              <th className="px-5 py-4 font-semibold">Bank Settlement</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500">
                  Loading vendors...
                </td>
              </tr>
            ) : vendors && vendors.length > 0 ? (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{v.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{v.gstin || 'No GSTIN'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-md bg-navy-800/40 px-2 py-0.5 text-xs font-medium text-silver-300 border border-navy-600/20">
                      {v.vendor_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <div>{v.contact_person || '---'}</div>
                    <div className="text-slate-500 font-mono">{v.phone || '---'}</div>
                  </td>
                  <td className="px-5 py-4 text-xs">
                    <div className="text-slate-400">NEFT / RTGS</div>
                    <div className="text-slate-500 font-mono text-[10px] mt-0.5">Pending setup</div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        v.status === 'ACTIVE'
                          ? 'bg-silver-900/60 text-silver-300 border border-silver-700/30'
                          : 'bg-slate-700/20 text-slate-400'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setComplianceModalId(v.id)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                      title="Manage Compliance"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-silver-300" />
                      Docs
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Building2 className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No vendors registered</p>
                    <p className="text-xs text-slate-500 mt-0.5">Click 'Add Vendor' to onboard a new supplier.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Compliance Modal */}
      {complianceModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-silver-300" />
                Vendor Compliance
              </h2>
              <button onClick={() => setComplianceModalId(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="dark">
              <EntityComplianceManager entityType="VENDOR" entityId={complianceModalId} />
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Add New Vendor</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300">Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Western Fleet Logistics"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Vendor Type</label>
                <select
                  value={formData.vendor_type}
                  onChange={(e) => setFormData({ ...formData, vendor_type: e.target.value as VendorCreate['vendor_type'] })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                >
                  <option value="FLEET_SUPPLIER">Fleet Supplier (Market Vehicles)</option>
                  <option value="DCO">DCO</option>
                  <option value="EMI_DRIVER">EMI Driver</option>
                  <option value="WORKSHOP">Maintenance Workshop</option>
                  <option value="FUEL_PARTNER">Fuel Partner</option>
                  <option value="BROKER">Logistics Broker</option>
                  <option value="OTHER">Other Service Provider</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+919811223344"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">GSTIN / Aadhaar No</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="07AAAAA0000A1Z5"
                    maxLength={15}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Bank IFSC</label>
                  <input
                    type="text"
                    value={formData.bank_ifsc}
                    onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Bank Account Number</label>
                  <input
                    type="text"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    placeholder="918273645019"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono text-xs focus:border-navy-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="HDFC Bank"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-navy-500 focus:outline-none"
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
                  {createMutation.isPending ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-silver-300" />
                Bulk Import Vendors
              </h2>
              <button onClick={closeBulk} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Template download */}
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">Download CSV Template</p>
                <p className="text-xs text-slate-400 mt-0.5">Fill in the template and re-upload. <span className="font-mono">vendor_type</span> must be one of: FLEET_SUPPLIER, DCO, EMI_DRIVER, WORKSHOP, FUEL_PARTNER, BROKER, OTHER.</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Template
              </button>
            </div>

            {/* File input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Upload CSV File</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-300 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            {/* Parse error */}
            {bulkParseError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {bulkParseError}
              </div>
            )}

            {/* Preview table */}
            {bulkRows.length > 0 && !bulkResult && (
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-white">{bulkRows.length}</span> row(s) parsed —{' '}
                  <span className="font-semibold text-green-400">{validBulkRows.length}</span> valid,{' '}
                  <span className="font-semibold text-red-400">{bulkRows.length - validBulkRows.length}</span> invalid (name too short).
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-48">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Contact</th>
                        <th className="px-3 py-2">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bulkRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className={r.name.trim().length < 2 ? 'bg-red-950/20' : ''}>
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-white">{r.name || <span className="text-red-400 italic">missing</span>}</td>
                          <td className="px-3 py-2 font-mono">{r.vendor_type}</td>
                          <td className="px-3 py-2">{r.contact_person || '—'}</td>
                          <td className="px-3 py-2 font-mono">{r.gstin || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkRows.length > 10 && (
                    <p className="px-3 py-2 text-xs text-slate-500 italic">…and {bulkRows.length - 10} more rows</p>
                  )}
                </div>
              </div>
            )}

            {/* API error */}
            {bulkMutation.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {(bulkMutation.error as any)?.message || 'Import failed. Please try again.'}
              </div>
            )}

            {/* Result summary */}
            {bulkResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-green-950/40 border border-green-800/40 px-3 py-2 text-xs font-semibold text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {bulkResult.created_count} Created
                  </div>
                  {bulkResult.failed_count > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-red-950/40 border border-red-800/40 px-3 py-2 text-xs font-semibold text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      {bulkResult.failed_count} Failed
                    </div>
                  )}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-40">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {bulkResult.errors.map((e: VendorBulkItemError) => (
                          <tr key={e.row} className="bg-red-950/10">
                            <td className="px-3 py-2 text-slate-500">{e.row}</td>
                            <td className="px-3 py-2 text-white">{e.name || '—'}</td>
                            <td className="px-3 py-2 text-red-400">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
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
                  disabled={validBulkRows.length === 0 || bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(validBulkRows)}
                  className="inline-flex items-center gap-2 rounded-lg bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50 transition"
                >
                  {bulkMutation.isPending
                    ? 'Importing…'
                    : `Import ${validBulkRows.length} Vendor${validBulkRows.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
