import React from 'react';
import { X, Receipt, Clock, ArrowUpRight } from 'lucide-react';

export interface RecentTxn {
  id: string;
  bill_no: string;
  timestamp: string;
  customer_name: string;
  total_amount: number;
  payment_mode: string;
  item_name?: string;
  quantity?: number;
}

interface RecentSalesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: RecentTxn[];
  onSelectTxn: (txn: RecentTxn) => void;
}

export default function RecentSalesDrawer({
  isOpen,
  onClose,
  transactions,
  onSelectTxn,
}: RecentSalesDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#10121d] border-l border-white/10 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">Recent Sales Terminal Orders</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transactions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No recent sales recorded yet in this session.
            </div>
          ) : (
            transactions.map((txn, index) => (
              <div
                key={txn.id || index}
                onClick={() => onSelectTxn(txn)}
                className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 rounded-xl transition cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-xs text-white">
                      {txn.bill_no || `TXN-${index + 1}`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                      {txn.payment_mode || 'Cash'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {txn.customer_name || 'Walk-in Customer'}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{txn.timestamp ? new Date(txn.timestamp).toLocaleTimeString() : 'Recent'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-sm text-emerald-400">
                    ₹{txn.total_amount?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-end gap-0.5 group-hover:text-indigo-400 transition mt-1">
                    <span>View Slip</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
