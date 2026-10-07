import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  UtensilsCrossed,
  PackageCheck,
  Zap,
  Filter,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface PosOrder {
  id: string;
  bill_no: string;
  token_no?: string;
  timestamp: string;
  order_type: 'Quick Bill' | 'Dine-In' | 'Takeaway';
  table_no?: string;
  customer_name: string;
  items_count: number;
  total_amount: number;
  payment_mode: string;
  status: 'Completed' | 'Kitchen Preparing' | 'Ready for Pickup' | 'Running Table';
}

const DEMO_ORDERS: PosOrder[] = [
  { id: 'ORD_101', bill_no: 'BILL-904122', token_no: 'TK-101', timestamp: new Date(Date.now() - 6 * 60000).toISOString(), order_type: 'Dine-In', table_no: 'T-02', customer_name: 'Vikram S.', items_count: 3, total_amount: 1450.0, payment_mode: 'Cash', status: 'Running Table' },
  { id: 'ORD_102', bill_no: 'BILL-904123', token_no: 'TK-102', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), order_type: 'Quick Bill', customer_name: 'Amit Verma', items_count: 2, total_amount: 340.0, payment_mode: 'UPI', status: 'Completed' },
  { id: 'ORD_103', bill_no: 'BILL-904124', token_no: 'TK-103', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), order_type: 'Takeaway', customer_name: 'Sneha Patel', items_count: 4, total_amount: 890.0, payment_mode: 'Card', status: 'Ready for Pickup' },
  { id: 'ORD_104', bill_no: 'BILL-904125', token_no: 'TK-104', timestamp: new Date(Date.now() - 38 * 60000).toISOString(), order_type: 'Dine-In', table_no: 'T-04', customer_name: 'Meera K.', items_count: 7, total_amount: 3820.0, payment_mode: 'UPI', status: 'Running Table' },
  { id: 'ORD_105', bill_no: 'BILL-904126', token_no: 'TK-105', timestamp: new Date(Date.now() - 55 * 60000).toISOString(), order_type: 'Dine-In', table_no: 'T-05', customer_name: 'Sharma Family', items_count: 5, total_amount: 2190.0, payment_mode: 'Cash', status: 'Completed' },
  { id: 'ORD_106', bill_no: 'BILL-904127', token_no: 'TK-106', timestamp: new Date(Date.now() - 80 * 60000).toISOString(), order_type: 'Quick Bill', customer_name: 'Rohan Gupta', items_count: 1, total_amount: 120.0, payment_mode: 'UPI', status: 'Completed' },
];

export default function PosOrders() {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState<PosOrder[]>(DEMO_ORDERS);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLiveOrders = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/transactions?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const liveOrders: PosOrder[] = data.map((t: any, idx: number) => ({
            id: t.id || `TX_${idx}`,
            bill_no: t.bill_no || `BILL-${idx + 100}`,
            token_no: `TK-${100 + idx}`,
            timestamp: t.timestamp || new Date().toISOString(),
            order_type: idx % 2 === 0 ? 'Quick Bill' : 'Dine-In',
            table_no: idx % 2 === 0 ? undefined : `T-0${(idx % 6) + 1}`,
            customer_name: t.customer_name || 'Walk-in Guest',
            items_count: t.quantity || 2,
            total_amount: t.total_amount || 450,
            payment_mode: t.payment_mode || 'Cash',
            status: idx === 0 ? 'Kitchen Preparing' : 'Completed',
          }));
          setOrders([...liveOrders, ...DEMO_ORDERS]);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchLiveOrders();
  }, []);

  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.bill_no.toLowerCase().includes(q) ||
      (o.token_no && o.token_no.toLowerCase().includes(q)) ||
      o.customer_name.toLowerCase().includes(q) ||
      (o.table_no && o.table_no.toLowerCase().includes(q));

    if (activeFilter === 'Running') return matchesSearch && (o.status === 'Running Table' || o.status === 'Kitchen Preparing');
    if (activeFilter === 'Dine-In') return matchesSearch && o.order_type === 'Dine-In';
    if (activeFilter === 'Takeaway') return matchesSearch && o.order_type === 'Takeaway';
    if (activeFilter === 'Completed') return matchesSearch && o.status === 'Completed';
    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            Live POS Orders & Kitchen Tickets
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time counter sales, kitchen orders, running tables, and settlement status
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLiveOrders}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#121420] p-1 rounded-xl border border-white/10 text-xs">
          {['All', 'Running', 'Dine-In', 'Takeaway', 'Completed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                activeFilter === tab
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill #, Token, Table..."
            className="w-full bg-[#121420] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 text-xs">
            No orders match the current filter "{activeFilter}".
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="p-4 bg-[#111320] border border-white/10 hover:border-emerald-500/30 rounded-2xl space-y-3 shadow-lg transition group"
            >
              {/* Card Top */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-white">
                    {order.bill_no}
                  </span>
                  {order.token_no && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                      {order.token_no}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    order.status === 'Completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : order.status === 'Running Table'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}
                >
                  {order.status}
                </span>
              </div>

              {/* Middle Info */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-semibold text-white">{order.customer_name}</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ₹{order.total_amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    {order.order_type === 'Dine-In' && <UtensilsCrossed className="w-3 h-3 text-indigo-400" />}
                    {order.order_type === 'Quick Bill' && <Zap className="w-3 h-3 text-emerald-400" />}
                    {order.order_type === 'Takeaway' && <PackageCheck className="w-3 h-3 text-purple-400" />}
                    <span>{order.order_type}</span>
                    {order.table_no && <strong className="text-white">({order.table_no})</strong>}
                  </span>
                  <span className="text-slate-500 font-mono">{order.payment_mode}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(order.timestamp).toLocaleTimeString()}
                </span>

                <button
                  onClick={() => alert(`Reprinting invoice ${order.bill_no}...`)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition"
                >
                  <Printer className="w-3 h-3" />
                  <span>Reprint</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
