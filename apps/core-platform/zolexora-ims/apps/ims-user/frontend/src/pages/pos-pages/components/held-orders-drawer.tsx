import React from 'react';
import { X, PauseCircle, Play, Trash2, Clock, ShoppingCart, Tag } from 'lucide-react';
import { CartItem } from './receipt-modal';

export interface HeldOrder {
  id: string;
  label: string;
  order_type: string;
  table_no?: string;
  customer_name: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
}

interface HeldOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: HeldOrder[];
  onResumeOrder: (order: HeldOrder) => void;
  onDeleteOrder: (id: string) => void;
}

export default function HeldOrdersDrawer({
  isOpen,
  onClose,
  heldOrders,
  onResumeOrder,
  onDeleteOrder,
}: HeldOrdersDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#10121d] border-l border-white/10 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#131625]">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-white text-sm">
              Parked / Held Orders ({heldOrders.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {heldOrders.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-slate-500 text-xs">
              <PauseCircle className="w-10 h-10 mx-auto text-slate-600 stroke-1" />
              <p className="font-medium text-slate-400">No Orders On Hold</p>
              <p className="text-[11px] text-slate-600">
                Press Hold Order [F8] on the billing screen to park an active cart.
              </p>
            </div>
          ) : (
            heldOrders.map((order) => (
              <div
                key={order.id}
                className="p-3.5 bg-white/5 border border-white/10 hover:border-amber-500/40 rounded-2xl space-y-3 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">
                      {order.label || order.id}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      {order.order_type}
                    </span>
                    {order.table_no && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        {order.table_no}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">
                    ₹{order.subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  Customer: <span className="font-medium text-white">{order.customer_name}</span>
                </div>

                {/* Items preview snippet */}
                <div className="text-[11px] text-slate-400 line-clamp-2 bg-black/20 p-2 rounded-lg font-mono">
                  {order.items.map((i) => `${i.quantity}x ${i.description}`).join(' • ')}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.timestamp).toLocaleTimeString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDeleteOrder(order.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                      title="Discard Held Order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onResumeOrder(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume</span>
                    </button>
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
