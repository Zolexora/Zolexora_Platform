import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  PieChart,
  Package,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';

export default function Reports() {
  const [activeReport, setActiveReport] = useState<'Valuation' | 'Movement' | 'Consumption' | 'Purchases'>('Valuation');
  const [dateRange, setDateRange] = useState('Month');

  const categoryValuation = [
    { category: 'Electronics', count: 4, value: 2617376, share: 44.5 },
    { category: 'Audio', count: 3, value: 2750720, share: 46.8 },
    { category: 'Accessories', count: 3, value: 1718401, share: 29.2 },
    { category: 'Storage', count: 1, value: 781954, share: 13.3 },
    { category: 'Office', count: 1, value: 310000, share: 5.2 },
  ];

  const movementData = [
    { code: 'P001', name: 'Logitech MX Master 3S', velocity: 'High', monthlySales: 142, turnoverDays: 18 },
    { code: 'P005', name: 'Apple AirPods Pro USB-C', velocity: 'High', monthlySales: 96, turnoverDays: 15 },
    { code: 'P002', name: 'Keychron K2 Mechanical Keyboard', velocity: 'Medium', monthlySales: 48, turnoverDays: 24 },
    { code: 'P006', name: 'Anker 737 Power Bank', velocity: 'Medium', monthlySales: 35, turnoverDays: 28 },
    { code: 'P003', name: 'Dell UltraSharp 27 4K Monitor', velocity: 'Slow', monthlySales: 12, turnoverDays: 62 },
    { code: 'P010', name: 'CalDigit TS4 Thunderbolt Dock', velocity: 'Slow', monthlySales: 8, turnoverDays: 75 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Inventory Analytics & Audit Reports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational summaries, stock valuation distributions, velocity metrics, and turnover rates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={() => alert('Exporting CSV to download folder...')}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Switcher & Filter */}
      <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center bg-[#181a28] border border-white/10 rounded-xl p-0.5 text-xs w-full sm:w-auto overflow-x-auto">
          {(['Valuation', 'Movement', 'Consumption', 'Purchases'] as const).map((rep) => (
            <button
              key={rep}
              onClick={() => setActiveReport(rep)}
              className={`px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                activeReport === rep
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {rep === 'Valuation' ? 'Stock Valuation' : rep === 'Movement' ? 'Stock Velocity' : rep === 'Consumption' ? 'Consumption' : 'Purchases'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Period:
          </span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-[#181a28] border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-hidden cursor-pointer"
          >
            <option value="Today">Today</option>
            <option value="Week">This Week</option>
            <option value="Month">Current Fiscal Month</option>
            <option value="Quarter">Q3 2026</option>
          </select>
        </div>
      </div>

      {/* Report 1: Valuation */}
      {activeReport === 'Valuation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl space-y-1">
              <span className="text-xs text-slate-400">Total Book Value</span>
              <div className="text-2xl font-black text-white font-mono">₹5,880,450</div>
              <span className="text-[11px] text-emerald-400">100% verified across 3 hubs</span>
            </div>
            <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl space-y-1">
              <span className="text-xs text-slate-400">Main Warehouse (S_001)</span>
              <div className="text-2xl font-black text-indigo-400 font-mono">₹3,420,000</div>
              <span className="text-[11px] text-slate-400">58.1% of inventory</span>
            </div>
            <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl space-y-1">
              <span className="text-xs text-slate-400">Branch & Central Hub</span>
              <div className="text-2xl font-black text-purple-400 font-mono">₹2,460,450</div>
              <span className="text-[11px] text-slate-400">41.9% of inventory</span>
            </div>
          </div>

          <div className="bg-[#12141f] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white">Stock Valuation by Product Category</h3>
            <div className="space-y-3">
              {categoryValuation.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{cat.category} ({cat.count} SKUs)</span>
                    <span className="font-mono text-slate-300">₹{cat.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                      style={{ width: `${Math.min(100, cat.share)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Movement */}
      {activeReport === 'Movement' && (
        <div className="bg-[#12141f] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">Stock Velocity & Inventory Turnover Analysis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#161826] text-slate-400 border-b border-white/10">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3 text-center">Velocity Class</th>
                  <th className="py-3 px-3 text-center">Monthly Sales Units</th>
                  <th className="py-3 px-3 text-center">Days to Stockout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {movementData.map((m) => (
                  <tr key={m.code} className="hover:bg-white/5">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">{m.code}</td>
                    <td className="py-3 px-4 text-white font-medium">{m.name}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          m.velocity === 'High'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : m.velocity === 'Medium'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {m.velocity} Turnover
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-white font-mono">{m.monthlySales}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{m.turnoverDays} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3 & 4: Overview cards */}
      {(activeReport === 'Consumption' || activeReport === 'Purchases') && (
        <div className="p-8 bg-[#12141f] border border-white/10 rounded-2xl text-center space-y-3">
          <FileSpreadsheet className="w-12 h-12 text-indigo-400 mx-auto stroke-[1.5]" />
          <h3 className="text-base font-bold text-white">Detailed {activeReport} Breakdown Generated</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All transaction lines, supplier purchase orders, and issuance slips for the selected period are ready to download or print.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold"
            >
              Print Audit Summary
            </button>
            <button
              onClick={() => alert('Downloading report file...')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              Export Spreadsheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
