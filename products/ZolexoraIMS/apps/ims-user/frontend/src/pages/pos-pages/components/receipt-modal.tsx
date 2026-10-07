import React from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';

export interface CartItem {
  item_code: string;
  description: string;
  rate: number;
  quantity: number;
  tax_percent: number;
  notes?: string;
}

export interface SaleReceipt {
  bill_no: string;
  token_no?: string;
  date: string;
  selling_point: string;
  cashier: string;
  customer_name: string;
  customer_phone?: string;
  order_type?: string;
  table_no?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_mode: string;
  tendered?: number;
  change?: number;
  loyalty_points?: number;
}

interface ReceiptModalProps {
  receipt: SaleReceipt | null;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#12141f] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-emerald-400">
          <div className="flex items-center gap-2 font-medium text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Sale Completed Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Area */}
        <div className="p-6 overflow-y-auto font-mono text-xs space-y-4 bg-[#0d0f17] text-slate-300 print:bg-white print:text-black">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold tracking-wider text-white print:text-black">ZOLEXORA IMS</h2>
            <p className="text-[11px] text-slate-400 print:text-slate-600">Enterprise Retail Terminal</p>
            <p className="text-[11px] text-slate-400 print:text-slate-600">{receipt.selling_point} • Main Branch</p>
            <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />
          </div>

          <div className="flex justify-between text-[11px]">
            <span>Bill: <strong className="text-white print:text-black">{receipt.bill_no}</strong></span>
            <span>{receipt.date}</span>
          </div>
          {receipt.token_no && (
            <div className="flex justify-between text-xs font-bold text-amber-400 print:text-black">
              <span>Token: {receipt.token_no}</span>
              <span>{receipt.order_type || 'Counter'}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px]">
            <span>Cashier: {receipt.cashier}</span>
            <span>{receipt.table_no ? `Table: ${receipt.table_no}` : (receipt.order_type || 'Takeaway')}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>Cust: {receipt.customer_name}</span>
            {receipt.customer_phone && <span>Ph: {receipt.customer_phone}</span>}
          </div>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />

          {/* Line items table */}
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 print:text-slate-600 border-b border-white/10">
                <th className="pb-1">Item</th>
                <th className="pb-1 text-center">Qty</th>
                <th className="pb-1 text-right">Rate</th>
                <th className="pb-1 text-right">Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-black/10">
              {receipt.items.map((item, idx) => (
                <tr key={idx} className="py-1 align-top">
                  <td className="py-1 pr-2 max-w-[130px] font-sans text-xs text-white print:text-black">
                    <div>{item.description}</div>
                    {item.notes && (
                      <div className="text-[10px] text-amber-300 print:text-black font-mono italic">
                        ↳ {item.notes}
                      </div>
                    )}
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">₹{item.rate.toFixed(2)}</td>
                  <td className="py-1 text-right font-medium text-white print:text-black">
                    ₹{(item.quantity * item.rate).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b border-dashed border-white/20 my-2 print:border-black/40" />

          {/* Totals */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>₹{receipt.subtotal.toFixed(2)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span>-₹{receipt.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>GST / Tax</span>
              <span>₹{receipt.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white print:text-black border-t border-white/10 pt-1">
              <span>TOTAL PAYABLE</span>
              <span>₹{receipt.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300 pt-1">
              <span>Payment Mode:</span>
              <span className="uppercase font-semibold text-white print:text-black">{receipt.payment_mode}</span>
            </div>
            {receipt.payment_mode === 'Cash' && receipt.tendered && (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Amount Tendered:</span>
                  <span>₹{receipt.tendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Change Returned:</span>
                  <span>₹{(receipt.change || 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center pt-2 text-[10px] text-slate-500 print:text-slate-600">
            <p>Thank you for shopping with us!</p>
            <p>Cloudflare D1 Synchronized • Zolexora POS</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[#161926] border-t border-white/10 flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium py-2.5 px-4 rounded-xl transition text-sm"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition text-sm shadow-lg shadow-indigo-600/30"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
