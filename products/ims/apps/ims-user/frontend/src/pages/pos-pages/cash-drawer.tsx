import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  Calendar,
  Clock,
  CircleDollarSign,
  History,
  ShieldAlert,
  IndianRupee,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface CashTransaction {
  id: string;
  timestamp: string;
  type: 'Opening Float' | 'Cash Sale' | 'Pay In' | 'Pay Out' | 'Cash Drop (Safe)';
  amount: number;
  reason: string;
  cashier: string;
}

const INITIAL_LOGS: CashTransaction[] = [
  { id: 'cd_1', timestamp: '08:00 AM', type: 'Opening Float', amount: 3000, reason: 'Shift morning float assigned', cashier: 'Cashier SP-01' },
  { id: 'cd_2', timestamp: '09:42 AM', type: 'Cash Sale', amount: 1450, reason: 'Bill #904120', cashier: 'Cashier SP-01' },
  { id: 'cd_3', timestamp: '10:15 AM', type: 'Pay Out', amount: -250, reason: 'Dairy fresh milk delivery emergency', cashier: 'Cashier SP-01' },
  { id: 'cd_4', timestamp: '11:30 AM', type: 'Cash Sale', amount: 2190, reason: 'Bill #904126', cashier: 'Cashier SP-01' },
  { id: 'cd_5', timestamp: '01:05 PM', type: 'Cash Drop (Safe)', amount: -4000, reason: 'Midday cash drop to vault safe', cashier: 'Supervisor Raj' },
  { id: 'cd_6', timestamp: '02:20 PM', type: 'Pay In', amount: 1000, reason: 'Small coins & change replenish', cashier: 'Cashier SP-01' },
  { id: 'cd_7', timestamp: '03:10 PM', type: 'Cash Sale', amount: 1200, reason: 'Bill #904130', cashier: 'Cashier SP-01' },
];

export default function PosCashDrawer() {
  const { user, authFetch } = useAuth();
  const [logs, setLogs] = useState<CashTransaction[]>(INITIAL_LOGS);
  const [showPayInOutModal, setShowPayInOutModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'Pay In' | 'Pay Out' | 'Cash Drop (Safe)'>('Pay In');
  const [amountInput, setAmountInput] = useState<string>('');
  const [reasonInput, setReasonInput] = useState<string>('');

  // End of Shift Reconciliation
  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [countedCash, setCountedCash] = useState<string>('');
  const [shiftClosed, setShiftClosed] = useState<boolean>(false);

  const fetchLogs = () => {
    authFetch('/api/v1/cash-drawer/logs')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLogs(
            data.map((l: any) => ({
              id: l.id,
              timestamp: l.timestamp,
              type: l.type as CashTransaction['type'],
              amount: l.amount,
              reason: l.reason,
              cashier: l.cashier,
            }))
          );
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Compute Expected Cash
  const openingFloat = logs.find((l) => l.type === 'Opening Float')?.amount || 3000;
  const cashSales = logs.filter((l) => l.type === 'Cash Sale').reduce((a, b) => a + b.amount, 0);
  const payIns = logs.filter((l) => l.type === 'Pay In').reduce((a, b) => a + b.amount, 0);
  const payOuts = logs.filter((l) => l.type === 'Pay Out').reduce((a, b) => a + Math.abs(b.amount), 0);
  const cashDrops = logs.filter((l) => l.type === 'Cash Drop (Safe)').reduce((a, b) => a + Math.abs(b.amount), 0);

  const expectedCash = openingFloat + cashSales + payIns - payOuts - cashDrops;

  const handleAddDrawerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountInput);
    if (isNaN(val) || val <= 0) return;

    const actualAmount = modalType === 'Pay In' ? val : -val;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reasonStr = reasonInput || `${modalType} adjustment`;
    const cashierStr = user?.email || 'Active Cashier';

    try {
      await authFetch('/api/v1/cash-drawer/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: nowStr,
          type: modalType,
          amount: actualAmount,
          reason: reasonStr,
          cashier: cashierStr,
        }),
      });
      fetchLogs();
    } catch {
      const entry: CashTransaction = {
        id: `cd_${Date.now()}`,
        timestamp: nowStr,
        type: modalType,
        amount: actualAmount,
        reason: reasonStr,
        cashier: cashierStr,
      };
      setLogs([entry, ...logs]);
    }

    setShowPayInOutModal(false);
    setAmountInput('');
    setReasonInput('');
  };

  const handleReconcileShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authFetch('/api/v1/cash-drawer/close-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counted_cash: parseFloat(countedCash) || 0,
          expected_cash: expectedCash,
          cashier: user?.email || 'Active Cashier',
        }),
      });
      fetchLogs();
    } catch {}
    setShiftClosed(true);
    setShowCloseShiftModal(false);
  };

  const countedVal = parseFloat(countedCash) || 0;
  const variance = countedVal - expectedCash;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Cash Drawer & Float Reconciliation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Shift float auditing, pay-ins, expense pay-outs, safe drops & end-of-day Z-Report
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setModalType('Pay In');
              setShowPayInOutModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Pay In (Float)</span>
          </button>
          <button
            onClick={() => {
              setModalType('Pay Out');
              setShowPayInOutModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Pay Out (Expense)</span>
          </button>
          <button
            onClick={() => {
              setModalType('Cash Drop (Safe)');
              setShowPayInOutModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Safe Drop</span>
          </button>
          <button
            onClick={() => setShowCloseShiftModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Close Shift / Z-Report</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Row: Drawer Live Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Expected in Drawer</span>
            <CircleDollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1.5 font-mono">
            ₹{expectedCash.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Calculated system balance</div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Opening Float</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5 font-mono">
            ₹{openingFloat.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Assigned at shift open</div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>Cash Sales Tenders</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1.5 font-mono">
            ₹{cashSales.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-indigo-400/80 mt-0.5">Registered cash bills</div>
        </div>

        <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
            <span>Pay Outs & Drops</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1.5 font-mono">
            -₹{(payOuts + cashDrops).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-rose-400/80 mt-0.5">Safe drops & petty expenses</div>
        </div>
      </div>

      {/* Shift Status Banner if closed */}
      {shiftClosed && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="font-bold text-white text-sm">Shift Z-Report Generated & Drawer Balanced</div>
              <div className="text-xs text-slate-300">
                Counted: ₹{countedVal.toLocaleString('en-IN')} • Expected: ₹{expectedCash.toLocaleString('en-IN')} •
                <span className={variance >= 0 ? 'text-emerald-400 font-bold ml-1' : 'text-rose-400 font-bold ml-1'}>
                  Variance: {variance >= 0 ? `+₹${variance}` : `-₹${Math.abs(variance)}`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Z-Report</span>
          </button>
        </div>
      )}

      {/* Cash Drawer Activity Ledger */}
      <div className="flex-1 overflow-hidden flex flex-col border border-white/10 rounded-2xl bg-slate-900/30">
        <div className="p-3.5 border-b border-white/10 bg-[#0b0d18] flex items-center justify-between">
          <div className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <span>Cash Drawer Movement Audit Log</span>
          </div>
          <div className="text-[11px] text-slate-400">Terminal: SP_001 • Shift #04</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-black/30 text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Authorized Cashier</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => {
                const isPositive = log.amount >= 0;
                return (
                  <tr key={log.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{log.timestamp}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          log.type === 'Cash Sale'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : log.type === 'Opening Float'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                            : log.type === 'Pay In'
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : log.type === 'Cash Drop (Safe)'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">{log.reason}</td>
                    <td className="py-3 px-4 text-slate-400">{log.cashier}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+₹${log.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(log.amount).toLocaleString('en-IN')}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay In / Pay Out Modal */}
      {showPayInOutModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f121d] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Cash Movement: {modalType}</span>
              </h3>
              <button onClick={() => setShowPayInOutModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDrawerEntry} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Movement Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Pay In', 'Pay Out', 'Cash Drop (Safe)'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setModalType(t)}
                      className={`py-2 px-1 rounded-lg text-[11px] font-bold border transition ${
                        modalType === t
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-white/5 text-slate-300 border-white/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 500"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Reason / Audit Memo *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vendor delivery, Ice bag, Change coins"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayInOutModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                >
                  Record Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift / Z-Report Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f121d] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Shift Reconciliation & Z-Report</span>
              </h3>
              <button onClick={() => setShowCloseShiftModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 bg-white/5 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Expected Drawer Cash:</span>
                <span className="font-mono font-bold text-white">₹{expectedCash.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Shift Cash Sales:</span>
                <span className="font-mono">₹{cashSales.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleReconcileShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Physical Counted Cash (₹) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="Enter total counted notes & coins"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              {countedCash && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    variance >= 0
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span className="font-medium">Variance (Over / Short):</span>
                  <span className="font-mono font-bold text-sm">
                    {variance >= 0 ? `+₹${variance}` : `-₹${Math.abs(variance)}`}
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                >
                  Confirm & Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
