import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  CreditCard,
  CircleDollarSign,
  TrendingUp,
  Percent,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  IndianRupee,
  Utensils,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface SalesMetric {
  title: string;
  value: string;
  sub: string;
  trend: string;
  isPositive: boolean;
}

export default function PosReports() {
  const { authFetch } = useAuth();
  const [timeRange, setTimeRange] = useState<'Today' | 'Yesterday' | 'This Week' | 'This Month'>('Today');
  const [loading, setLoading] = useState<boolean>(true);

  // Live database analytics queried directly from selling_point_sales
  const [salesData, setSalesData] = useState<any>({
    grossSales: 0,
    netSales: 0,
    discounts: 0,
    taxes: 0,
    orderCount: 0,
    avgTicket: 0,
    tenders: [],
    categories: [],
    topItems: [],
    hourly: [],
  });

  useEffect(() => {
    setLoading(true);
    authFetch(`/api/v1/reports/sales?range=${encodeURIComponent(timeRange)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSalesData(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange]);

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Item,Category,Quantity,Revenue\n' +
      (salesData.topItems || []).map((i: any) => `"${i.name}","${i.category}",${i.qty},${i.revenue}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `POS_Sales_Report_${timeRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>POS Sales Analytics & Shift Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gross revenue, payment tender distribution, top seller velocity & hourly rush breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframe pill */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5 text-xs">
            {(['Today', 'Yesterday', 'This Week', 'This Month'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  timeRange === t ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Gross Sales</div>
          <div className="text-xl font-black text-emerald-300 mt-1 font-mono">
            ₹{salesData.grossSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> +14.2% vs prev
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Sales</div>
          <div className="text-xl font-black text-white mt-1 font-mono">
            ₹{salesData.netSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Excluding discounts</div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Total Orders</div>
          <div className="text-xl font-black text-indigo-300 mt-1 font-mono">{salesData.orderCount}</div>
          <div className="text-[10px] text-indigo-400/80 mt-0.5">Closed transactions</div>
        </div>

        <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Avg Ticket Size</div>
          <div className="text-xl font-black text-cyan-300 mt-1 font-mono">₹{salesData.avgTicket}</div>
          <div className="text-[10px] text-cyan-400/80 mt-0.5">Per receipt bill</div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Discounts Given</div>
          <div className="text-xl font-black text-amber-300 mt-1 font-mono">₹{salesData.discounts}</div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">Promos & loyalty</div>
        </div>

        <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">GST Collected</div>
          <div className="text-xl font-black text-purple-300 mt-1 font-mono">₹{salesData.taxes}</div>
          <div className="text-[10px] text-purple-400/80 mt-0.5">Output tax liability</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tender breakdown & Top Selling */}
        <div className="lg:col-span-2 space-y-5">
          {/* Payment Method Distribution */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Payment Tender Distribution</span>
              </div>
              <span className="text-[11px] text-slate-400">Terminal Desk SP_001</span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 flex overflow-hidden">
              {salesData.tenders.map((t) => (
                <div
                  key={t.mode}
                  style={{ width: `${t.percent}%` }}
                  className={`${t.bg} h-full transition-all`}
                  title={`${t.mode}: ${t.percent}%`}
                />
              ))}
            </div>

            {/* Tender detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {salesData.tenders.map((t) => (
                <div key={t.mode} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">{t.mode}</div>
                  <div className="text-lg font-black text-white font-mono">₹{t.amount.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>{t.count} payments</span>
                    <span className={t.color}>{t.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Items Leaderboard */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Top Selling Items Leaderboard</span>
              </div>
              <span className="text-[11px] text-slate-400">Ranked by volume & revenue</span>
            </div>

            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-black/20 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-2.5 px-3"># Rank</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {salesData.topItems.map((item) => (
                  <tr key={item.name} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-3">
                      <span className="w-5 h-5 rounded-full bg-white/10 font-mono font-bold text-[10px] flex items-center justify-center text-amber-300">
                        {item.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">{item.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-300">{item.qty}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{item.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Category Sales Share & Hourly Rush */}
        <div className="space-y-5">
          {/* Category Share */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-white/5">
              <Utensils className="w-4 h-4 text-indigo-400" />
              <span>Category Revenue Share</span>
            </div>

            <div className="space-y-2.5 text-xs">
              {salesData.categories.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-mono font-bold text-white">₹{cat.revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${cat.share}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{cat.qty} items</span>
                    <span>{cat.share}% share</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly Rush */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 pb-2 border-b border-white/5">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Hourly Rush & Velocity</span>
            </div>

            <div className="space-y-2 text-xs">
              {salesData.hourly.map((h) => {
                const maxSales = 15000;
                const pct = Math.min(100, Math.round((h.sales / maxSales) * 100));
                return (
                  <div key={h.hour} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{h.hour}</span>
                      <span className="font-mono font-bold text-white">₹{h.sales.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          h.sales > 10000 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 text-right">{h.orders} orders</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
