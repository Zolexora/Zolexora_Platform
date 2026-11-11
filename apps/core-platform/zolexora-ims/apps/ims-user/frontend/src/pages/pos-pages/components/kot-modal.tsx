import React from 'react';
import { ChefHat, Printer, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { CartItem } from './receipt-modal';

export interface KotData {
  kot_no: string;
  table_no?: string;
  order_type: string;
  server_name: string;
  timestamp: string;
  items: (CartItem & { notes?: string })[];
}

interface KotModalProps {
  kot: KotData | null;
  onClose: () => void;
  onConfirmFire?: () => void;
}

export default function KotModal({ kot, onClose, onConfirmFire }: KotModalProps) {
  if (!kot) return null;

  const handlePrint = () => {
    window.print();
    if (onConfirmFire) {
      onConfirmFire();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#121420] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between text-purple-300">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ChefHat className="w-5 h-5 text-purple-400" />
            <span>Kitchen Order Ticket (KOT) Generated</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal KOT Slip */}
        <div className="p-6 overflow-y-auto font-mono text-xs space-y-3 bg-[#0d0f17] text-slate-200 print:bg-white print:text-black">
          <div className="text-center space-y-1">
            <h2 className="text-base font-black tracking-widest text-white print:text-black">*** KITCHEN ORDER TICKET ***</h2>
            <div className="text-xs font-bold text-purple-400 print:text-black">
              {kot.kot_no}
            </div>
            <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />
          </div>

          <div className="flex justify-between text-xs">
            <span>Type: <strong className="text-white print:text-black uppercase">{kot.order_type}</strong></span>
            {kot.table_no && <span>Table: <strong className="text-white print:text-black text-sm">{kot.table_no}</strong></span>}
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 print:text-slate-600">
            <span>Server: {kot.server_name}</span>
            <span>Time: {new Date(kot.timestamp).toLocaleTimeString()}</span>
          </div>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />

          {/* KOT Items */}
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 print:text-slate-600 border-b border-white/10">
                <th className="pb-1.5 font-bold">Qty</th>
                <th className="pb-1.5 font-bold">Item Description</th>
                <th className="pb-1.5 font-bold text-right">Station</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-black/10">
              {kot.items.map((item, idx) => (
                <tr key={idx} className="py-2 align-top">
                  <td className="py-2 pr-2 text-base font-black text-white print:text-black">
                    {item.quantity}x
                  </td>
                  <td className="py-2 font-sans">
                    <div className="font-bold text-white print:text-black text-xs">
                      {item.description}
                    </div>
                    {item.notes && (
                      <div className="text-[11px] text-amber-300 print:text-black font-mono italic mt-0.5">
                        * Note: {item.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right text-[10px] text-purple-300 print:text-black font-mono">
                    MAIN KITCHEN
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />
          <div className="text-center text-[10px] text-slate-500 print:text-slate-600">
            Total Line Items: {kot.items.reduce((s, i) => s + i.quantity, 0)} • Fired via Zolexora POS
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-600/30"
          >
            <Printer className="w-4 h-4" />
            <span>Print & Fire to Kitchen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
