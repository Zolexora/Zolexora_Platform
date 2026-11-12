import React from 'react';
import { DollarSign, Printer, X, CreditCard, Banknote, QrCode, FileText, CheckCircle2 } from 'lucide-react';
import { RecentTxn } from './recent-sales-drawer';

interface RegisterSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: RecentTxn[];
  sellingPoint: string;
  cashierName: string;
}

export default function RegisterSummaryModal({
  isOpen,
  onClose,
  transactions,
  sellingPoint,
  cashierName,
}: RegisterSummaryModalProps) {
  if (!isOpen) return null;

  const openingFloat = 2000.0; // Standard cash float
  const totalOrders = transactions.length;
  const totalSales = transactions.reduce((acc, t) => acc + (t.total_amount || 0), 0);

  const cashSales = transactions
    .filter((t) => (t.payment_mode || '').toLowerCase() === 'cash')
    .reduce((acc, t) => acc + (t.total_amount || 0), 0);

  const upiSales = transactions
    .filter((t) => (t.payment_mode || '').toLowerCase() === 'upi')
    .reduce((acc, t) => acc + (t.total_amount || 0), 0);

  const cardSales = transactions
    .filter((t) => (t.payment_mode || '').toLowerCase() === 'card')
    .reduce((acc, t) => acc + (t.total_amount || 0), 0);

  const expectedCashInDrawer = openingFloat + cashSales;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#121420] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">Shift Z-Report & Cash Drawer Summary</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Content */}
        <div className="p-6 overflow-y-auto space-y-4 bg-[#0d0f17] text-xs font-mono print:bg-white print:text-black">
          <div className="text-center space-y-1">
            <h2 className="text-base font-black text-white print:text-black tracking-wider">ZOLEXORA RETAIL POS</h2>
            <p className="text-[11px] text-slate-400 print:text-slate-600">Daily Cashier Reconciliation Slip (Z-Report)</p>
            <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />
          </div>

          <div className="flex justify-between text-[11px] text-slate-300 print:text-black">
            <span>Terminal: <strong>{sellingPoint}</strong></span>
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-300 print:text-black">
            <span>Cashier: <strong>{cashierName}</strong></span>
            <span>Shift: Active (09:00 - Present)</span>
          </div>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />

          {/* KPI Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 print:border-black/20">
              <span className="text-[10px] text-slate-400 print:text-slate-600 block">Total Orders</span>
              <span className="text-lg font-bold text-white print:text-black">{totalOrders}</span>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 print:border-black/20">
              <span className="text-[10px] text-slate-400 print:text-slate-600 block">Gross Sales</span>
              <span className="text-lg font-bold text-emerald-400 print:text-black">₹{totalSales.toFixed(2)}</span>
            </div>
          </div>

          {/* Tender Breakdown */}
          <div className="space-y-1.5 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 print:text-black">
              Payment Breakdown by Tender
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5 print:border-black/10">
              <span className="flex items-center gap-1.5 text-slate-300 print:text-black">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                Cash Collections
              </span>
              <span className="font-bold text-white print:text-black">₹{cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5 print:border-black/10">
              <span className="flex items-center gap-1.5 text-slate-300 print:text-black">
                <QrCode className="w-3.5 h-3.5 text-teal-400" />
                UPI / QR Collections
              </span>
              <span className="font-bold text-white print:text-black">₹{upiSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5 print:border-black/10">
              <span className="flex items-center gap-1.5 text-slate-300 print:text-black">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                Card / POS EDC Swipes
              </span>
              <span className="font-bold text-white print:text-black">₹{cardSales.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />

          {/* Cash Drawer Reconciliation */}
          <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1 print:border-black/20 print:bg-white">
            <div className="flex justify-between text-slate-300 print:text-black text-[11px]">
              <span>Opening Cash Float:</span>
              <span>₹{openingFloat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300 print:text-black text-[11px]">
              <span>+ Cash Sales Collected:</span>
              <span>₹{cashSales.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-emerald-300 print:text-black text-xs">
              <span>Expected Cash in Drawer:</span>
              <span>₹{expectedCashInDrawer.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-[#141624] border-t border-white/10 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            <Printer className="w-4 h-4" />
            <span>Print Z-Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
