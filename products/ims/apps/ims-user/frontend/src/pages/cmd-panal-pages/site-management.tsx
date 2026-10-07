import React, { useState, useEffect } from 'react';
import {
  Building2,
  Store,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Layers,
  CheckCircle2,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export interface Site {
  code: string;
  name: string;
  type: string;
  address?: string;
  phone?: string;
  status: string;
}

export interface SellingPoint {
  code: string;
  name: string;
  assigned_store_code: string;
  status: string;
}

const DEFAULT_SITES: Site[] = [
  {
    code: 'S_001',
    name: 'Store 1 — Central Hub & Warehouse',
    type: 'Main Fulfillment Hub',
    address: 'Plot 42, Industrial Area, Phase 1',
    phone: '+91 98765 43210',
    status: 'Active',
  },
  {
    code: 'S_002',
    name: 'Store 2 — Downtown Commercial Branch',
    type: 'Retail Store & Stockroom',
    address: 'Shop 14, City Center Mall',
    phone: '+91 98765 43211',
    status: 'Active',
  },
  {
    code: 'CENTRAL',
    name: 'Central Regional Distribution Center',
    type: 'Primary Buffer Warehouse',
    address: 'Logistics Park, National Highway 8',
    phone: '+91 98765 43299',
    status: 'Active',
  },
];

const DEFAULT_POINTS: SellingPoint[] = [
  { code: 'SP_001', name: 'Main Retail Counter 1 (POS Desk A)', assigned_store_code: 'S_001', status: 'Active' },
  { code: 'SP_002', name: 'Mall Express Counter 2 (POS Desk B)', assigned_store_code: 'S_002', status: 'Active' },
];

export default function OrgSiteManagement() {
  const { authFetch } = useAuth();
  const [sites, setSites] = useState<Site[]>(DEFAULT_SITES);
  const [sellingPoints, setSellingPoints] = useState<SellingPoint[]>(DEFAULT_POINTS);
  const [loading, setLoading] = useState(false);
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false);
  const [isAddPointModalOpen, setIsAddPointModalOpen] = useState(false);

  const [newSite, setNewSite] = useState({
    code: '',
    name: '',
    type: 'Warehouse',
    address: '',
    phone: '',
  });

  const [newPoint, setNewPoint] = useState({
    code: '',
    name: '',
    assigned_store_code: 'S_001',
  });

  const fetchSites = async () => {
    setLoading(true);
    try {
      const sRes = await authFetch('/api/v1/stores');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) setSites(sData);
      }
      const pRes = await authFetch('/api/v1/selling-points');
      if (pRes.ok) {
        const pData = await pRes.json();
        if (Array.isArray(pData) && pData.length > 0) setSellingPoints(pData);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.name.trim()) return;

    const code = newSite.code.trim().toUpperCase() || `S_00${sites.length + 1}`;
    setSites([
      ...sites,
      {
        ...newSite,
        code,
        status: 'Active',
      },
    ]);
    setIsAddSiteModalOpen(false);
    setNewSite({ code: '', name: '', type: 'Warehouse', address: '', phone: '' });
  };

  const handleAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoint.name.trim()) return;

    const code = newPoint.code.trim().toUpperCase() || `SP_00${sellingPoints.length + 1}`;
    setSellingPoints([
      ...sellingPoints,
      {
        code,
        name: newPoint.name,
        assigned_store_code: newPoint.assigned_store_code,
        status: 'Active',
      },
    ]);
    setIsAddPointModalOpen(false);
    setNewPoint({ code: '', name: '', assigned_store_code: 'S_001' });
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Sites & POS Registers</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
              INFRASTRUCTURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provision warehouses, fulfillment centers, retail stockrooms, and front-desk checkout terminals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddPointModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>+ POS Terminal</span>
          </button>

          <button
            onClick={() => setIsAddSiteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-900/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Site</span>
          </button>
        </div>
      </div>

      {/* Section 1: Sites & Warehouses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>Operating Warehouses & Fulfillment Hubs</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">{sites.length} Active Locations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div
              key={site.code}
              className="p-4 bg-slate-900/40 border border-white/10 rounded-2xl space-y-3 hover:border-purple-500/40 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                    {site.code}
                  </span>
                  <h3 className="font-bold text-sm text-white mt-1.5 leading-snug">{site.name}</h3>
                  <div className="text-[11px] text-purple-300/80">{site.type}</div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {site.status}
                </span>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-slate-400">
                {site.address && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{site.address}</span>
                  </div>
                )}
                {site.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{site.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: POS Selling Points */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span>Assigned POS Register Desks & Billing Counters</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">{sellingPoints.length} Front Registers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sellingPoints.map((point) => (
            <div
              key={point.code}
              className="p-4 bg-slate-900/40 border border-white/10 rounded-2xl flex items-center justify-between hover:border-emerald-500/40 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {point.code}
                  </span>
                  <h4 className="font-bold text-xs text-white">{point.name}</h4>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assigned Stockroom: {point.assigned_store_code}</span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ONLINE
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Site Modal */}
      {isAddSiteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121422] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Add Enterprise Location / Site</span>
              </h2>
              <button
                onClick={() => setIsAddSiteModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSite} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Location Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S_003 or WAREHOUSE_NORTH"
                  value={newSite.code}
                  onChange={(e) => setNewSite({ ...newSite, code: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Store 3 — Airport Terminal Branch"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Location Type</label>
                <select
                  value={newSite.type}
                  onChange={(e) => setNewSite({ ...newSite, type: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                >
                  <option value="Main Fulfillment Hub">Main Fulfillment Hub</option>
                  <option value="Retail Store & Stockroom">Retail Store & Stockroom</option>
                  <option value="Primary Buffer Warehouse">Primary Buffer Warehouse</option>
                  <option value="Cloud Kitchen Facility">Cloud Kitchen Facility</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Physical Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop 2, Terminal 2 Arrivals, Mumbai Airport"
                  value={newSite.address}
                  onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Contact Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43212"
                  value={newSite.phone}
                  onChange={(e) => setNewSite({ ...newSite, phone: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddSiteModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Save Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Point Modal */}
      {isAddPointModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#121422] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                <span>Provision POS Terminal Counter</span>
              </h2>
              <button
                onClick={() => setIsAddPointModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPoint} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Terminal Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SP_003"
                  value={newPoint.code}
                  onChange={(e) => setNewPoint({ ...newPoint, code: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Desk / Register Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Drive-thru Express Register"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Assigned Warehouse / Store *</label>
                <select
                  value={newPoint.assigned_store_code}
                  onChange={(e) => setNewPoint({ ...newPoint, assigned_store_code: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs cursor-pointer"
                >
                  {sites.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddPointModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Provision Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
