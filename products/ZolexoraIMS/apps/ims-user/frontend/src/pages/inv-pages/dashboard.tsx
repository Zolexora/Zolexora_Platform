import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Boxes,
  Building2,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Truck,
  FileSpreadsheet,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

export default function Dashboard() {
  const { authFetch } = useAuth();
  const [metrics, setMetrics] = useState<any>({
    totalSKUs: 12,
    totalStockValuation: 2435000.0,
    lowStockAlerts: 3,
    totalTodaySales: 78500.0,
    totalTodayPurchases: 142000.0,
    activeStores: 2,
    activeSellingPoints: 2,
    currency: '₹',
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/dashboard/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {}

    try {
      const res = await authFetch('/api/v1/items');
      if (res.ok) {
        const data = await res.json();
        const low = data.filter((item: any) => item.total_stock <= item.min_stock);
        setLowStockItems(low);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Operations Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stock valuation, multi-store balances, material requisitions, and D1 edge telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/inv/forms/sku-addition"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add SKU</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[#12141f] border border-white/10 rounded-2xl space-y-2 hover:border-indigo-500/30 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Stock Valuation</span>
            <span className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {metrics.currency}{Number(metrics.totalStockValuation || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>Across all warehouses & branches</span>
          </div>
        </div>

        <div className="p-5 bg-[#12141f] border border-white/10 rounded-2xl space-y-2 hover:border-indigo-500/30 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Catalogued SKUs</span>
            <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{metrics.totalSKUs}</div>
          <div className="text-[11px] text-slate-400">Products in active catalog</div>
        </div>

        <div className="p-5 bg-[#12141f] border border-white/10 rounded-2xl space-y-2 hover:border-indigo-500/30 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Critical Low Stock Alerts</span>
            <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {metrics.lowStockAlerts}
          </div>
          <div className="text-[11px] text-amber-400/80">Below reorder threshold</div>
        </div>

        <div className="p-5 bg-[#12141f] border border-white/10 rounded-2xl space-y-2 hover:border-indigo-500/30 transition shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Warehouses & Sites</span>
            <span className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {metrics.activeStores} Sites / {metrics.activeSellingPoints} POS
          </div>
          <div className="text-[11px] text-slate-400">Connected D1 nodes</div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/inv/forms/sku-addition"
          className="p-4 bg-gradient-to-br from-indigo-950/30 to-[#12141f] border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl flex items-center justify-between group transition shadow-md"
        >
          <div className="space-y-1">
            <div className="font-bold text-xs text-white group-hover:text-indigo-300 transition">
              + New SKU Addition
            </div>
            <div className="text-[11px] text-slate-400">Add new product to master catalog</div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
        </Link>

        <Link
          to="/inv/forms/purchase-entry"
          className="p-4 bg-gradient-to-br from-emerald-950/30 to-[#12141f] border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl flex items-center justify-between group transition shadow-md"
        >
          <div className="space-y-1">
            <div className="font-bold text-xs text-white group-hover:text-emerald-300 transition">
              + Goods Receipt (GRN)
            </div>
            <div className="text-[11px] text-slate-400">Receive supplier purchase shipment</div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
        </Link>

        <Link
          to="/inv/forms/issuance-entry"
          className="p-4 bg-gradient-to-br from-purple-950/30 to-[#12141f] border border-purple-500/20 hover:border-purple-500/50 rounded-2xl flex items-center justify-between group transition shadow-md"
        >
          <div className="space-y-1">
            <div className="font-bold text-xs text-white group-hover:text-purple-300 transition">
              + Material Issuance
            </div>
            <div className="text-[11px] text-slate-400">Issue stock to selling point / site</div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400" />
        </Link>
      </div>

      {/* Critical Stock Alerts Table */}
      <div className="bg-[#12141f] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Critical Low-Stock Replenishment Triggers</h3>
          </div>
          <Link
            to="/inv/products"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            <span>View All Products</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-white/10">
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-center">Store 1</th>
                <th className="pb-2 font-medium text-center">Store 2</th>
                <th className="pb-2 font-medium text-center">Total Stock</th>
                <th className="pb-2 font-medium text-center">Min Threshold</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    All inventory stock balances currently exceed min thresholds!
                  </td>
                </tr>
              ) : (
                lowStockItems.map((item) => (
                  <tr key={item.item_code} className="hover:bg-white/5 transition">
                    <td className="py-3 font-mono text-indigo-400 font-semibold">{item.item_code}</td>
                    <td className="py-3 font-medium text-slate-200 max-w-[220px] truncate">
                      {item.description}
                    </td>
                    <td className="py-3 text-center">{item.stock_s_001}</td>
                    <td className="py-3 text-center">{item.stock_s_002}</td>
                    <td className="py-3 text-center font-bold text-amber-400 font-mono">
                      {item.total_stock} {item.uom}
                    </td>
                    <td className="py-3 text-center font-mono text-slate-400">{item.min_stock}</td>
                    <td className="py-3 text-right">
                      <Link
                        to="/inv/forms/purchase-entry"
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                      >
                        Reorder Now
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
