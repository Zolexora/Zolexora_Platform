import React, { useState, useEffect } from 'react';
import {
  Truck,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Plus,
  Search,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

interface Supplier {
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  payment_terms?: string;
  status: string;
}

const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    code: 'SUP_001',
    name: 'TechLogix Distribution Pvt Ltd',
    contact_person: 'Rajesh Sharma',
    phone: '+91 98234 11223',
    email: 'orders@techlogix.example.com',
    address: 'Electronics Zone, Sector 62, Noida',
    category: 'Electronics & Audio',
    payment_terms: 'Net 30',
    status: 'Active',
  },
  {
    code: 'SUP_002',
    name: 'Apex Peripherals & Storage Ltd',
    contact_person: 'Anita Verma',
    phone: '+91 98112 33445',
    email: 'sales@apexperipherals.example.com',
    address: 'Nehru Place Hub, New Delhi',
    category: 'Computer Peripherals & SSDs',
    payment_terms: 'Net 15',
    status: 'Active',
  },
  {
    code: 'SUP_003',
    name: 'ErgoTech Workstation Solutions',
    contact_person: 'David Dsouza',
    phone: '+91 98334 55667',
    email: 'b2b@ergotech.example.com',
    address: 'MIDC Industrial Estate, Andheri East, Mumbai',
    category: 'Office Ergonomics & Mounts',
    payment_terms: 'Net 45',
    status: 'Active',
  },
];

export default function Suppliers() {
  const { authFetch } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEFAULT_SUPPLIERS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Supplier Form
  const [newSupplier, setNewSupplier] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    category: 'Electronics',
    payment_terms: 'Net 30',
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/suppliers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setSuppliers(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    const code = newSupplier.code.trim().toUpperCase() || `SUP_${String(suppliers.length + 1).padStart(3, '0')}`;
    const created: Supplier = {
      ...newSupplier,
      code,
      status: 'Active',
    };

    setSuppliers([created, ...suppliers]);
    setIsAddModalOpen(false);
    setNewSupplier({
      code: '',
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      category: 'Electronics',
      payment_terms: 'Net 30',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-purple-400" />
            Suppliers & Vendor Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Procurement partners, authorized distributor channels, and credit payment terms
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSuppliers}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor name, supplier code, or product category..."
            className="w-full bg-[#181a28] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((sup) => (
          <div
            key={sup.code}
            className="p-5 bg-[#12141f] border border-white/10 rounded-2xl space-y-4 hover:border-purple-500/30 transition shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{sup.name}</h3>
                    <div className="text-[11px] font-mono text-purple-400">{sup.code} • {sup.category || 'General'}</div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  {sup.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span>Contact:</span>
                  <span className="text-slate-200 font-medium">{sup.contact_person || 'Accounts'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Terms:</span>
                  <span className="text-slate-200 font-mono font-medium">{sup.payment_terms || 'Net 30'}</span>
                </div>
                {sup.phone && (
                  <div className="flex items-center gap-2 pt-0.5 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{sup.phone}</span>
                  </div>
                )}
                {sup.email && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{sup.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <Link
                to="/forms/purchase-entry"
                className="w-full text-center py-2 bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                + Book Purchase (GRN)
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Supplier */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-400" />
              Register New Supplier Partner
            </h2>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={newSupplier.code}
                    onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SUP_004"
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="e.g. Apex Industrial Solutions"
                  className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Terms</label>
                  <select
                    value={newSupplier.payment_terms}
                    onChange={(e) => setNewSupplier({ ...newSupplier, payment_terms: e.target.value })}
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Immediate">Immediate Payment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="+91 98..."
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="vendor@company.com"
                    className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-white outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl shadow-md transition"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
