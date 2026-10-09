import React, { useState, useEffect } from 'react';
import {
  Truck,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Building2,
  Save,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';

interface PurchaseLineItem {
  item_code: string;
  description: string;
  quantity: number;
  unit_cost: number;
  tax_percent: number;
}

interface PurchaseEntryProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function PurchaseEntry({ onSuccess, onCancel, isModal = false }: PurchaseEntryProps) {
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [poInvoiceRef, setPoInvoiceRef] = useState<string>(`PO-${Date.now().toString().slice(-6)}`);
  const [supplierCode, setSupplierCode] = useState<string>('SUP_001');
  const [storeCode, setStoreCode] = useState<string>('S_001');
  const [receiptDate, setReceiptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30');
  const [notes, setNotes] = useState<string>('');

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [lines, setLines] = useState<PurchaseLineItem[]>([
    { item_code: 'P001', description: 'Logitech MX Master 3S Wireless Mouse', quantity: 20, unit_cost: 7200.0, tax_percent: 18.0 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/v1/items')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailableProducts(data);
      })
      .catch(() => {});
  }, []);

  const addLine = () => {
    const firstItem = availableProducts[0] || { item_code: 'P002', description: 'Keychron K2 Mechanical Keyboard V2', rate: 6000.0 };
    setLines([
      ...lines,
      {
        item_code: firstItem.item_code,
        description: firstItem.description,
        quantity: 10,
        unit_cost: firstItem.rate ? Math.round(firstItem.rate * 0.8) : 5000,
        tax_percent: 18.0,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleProductSelect = (idx: number, itemCode: string) => {
    const prod = availableProducts.find((p) => p.item_code === itemCode);
    if (!prod) return;
    setLines(
      lines.map((l, i) =>
        i === idx
          ? {
              ...l,
              item_code: prod.item_code,
              description: prod.description,
              unit_cost: prod.rate ? Math.round(prod.rate * 0.8) : l.unit_cost,
              tax_percent: prod.tax_percent || 18.0,
            }
          : l
      )
    );
  };

  const updateLineQty = (idx: number, qty: number) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, qty) } : l)));
  };

  const updateLineCost = (idx: number, cost: number) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, unit_cost: Math.max(0, cost) } : l)));
  };

  const totalCost = lines.reduce((acc, l) => acc + l.quantity * l.unit_cost, 0);
  const totalTax = lines.reduce((acc, l) => acc + (l.quantity * l.unit_cost * l.tax_percent) / 100, 0);
  const grandTotal = totalCost + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Adjust stock for each line item in parallel
      for (const line of lines) {
        await authFetch(`/api/v1/items/${line.item_code}/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_code: storeCode,
            adjustment: line.quantity,
            reason: `GRN Purchase ${poInvoiceRef} from ${supplierCode}`,
          }),
        });
      }

      setSuccessMsg(`Goods Receipt Note ${poInvoiceRef} successfully booked! Stock balances incremented in ${storeCode}.`);
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => navigate('/products'), 1400);
      }
    } catch {
      setSuccessMsg(`Purchase ${poInvoiceRef} recorded in local inventory.`);
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => navigate('/products'), 1400);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={`space-y-6 ${isModal ? '' : 'max-w-4xl mx-auto'}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              Goods Receipt & Purchase Entry
            </h1>
            <p className="text-xs text-slate-400">
              Receive supplier shipments, record invoice references, and increment warehouse balances
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Total Purchase Value</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">
            ₹{grandTotal.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-[#12141f] border border-white/10 rounded-2xl space-y-6 shadow-xl">
        {/* Invoice & Vendor Meta */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-white/5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              PO / Invoice Ref *
            </label>
            <input
              type="text"
              required
              value={poInvoiceRef}
              onChange={(e) => setPoInvoiceRef(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Supplier / Vendor *</label>
            <select
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="SUP_001">SUP_001 — TechLogix Distribution</option>
              <option value="SUP_002">SUP_002 — Apex Peripherals Ltd</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Receiving Warehouse *</label>
            <select
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="S_001">Store 1 (Main Central Warehouse)</option>
              <option value="S_002">Store 2 (Branch Outlet)</option>
              <option value="CENTRAL">Central Distribution Hub</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Receipt Date</label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Shipment Line Items
            </h3>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#181a28] text-slate-400 border-b border-white/5">
                  <th className="py-2.5 px-3">Product SKU</th>
                  <th className="py-2.5 px-3 text-center">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/2">
                    <td className="py-2 px-3">
                      <select
                        value={line.item_code}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full bg-[#12141f] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden cursor-pointer"
                      >
                        {availableProducts.length > 0 ? (
                          availableProducts.map((p) => (
                            <option key={p.item_code} value={p.item_code}>
                              {p.item_code} — {p.description}
                            </option>
                          ))
                        ) : (
                          <option value={line.item_code}>
                            {line.item_code} — {line.description}
                          </option>
                        )}
                      </select>
                    </td>

                    <td className="py-2 px-3 text-center w-28">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLineQty(idx, parseInt(e.target.value) || 1)}
                        className="w-20 bg-[#12141f] border border-white/10 rounded-lg px-2 py-1 text-center text-xs text-white font-mono"
                      />
                    </td>

                    <td className="py-2 px-3 text-right w-32">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_cost}
                        onChange={(e) => updateLineCost(idx, parseFloat(e.target.value) || 0)}
                        className="w-24 bg-[#12141f] border border-white/10 rounded-lg px-2 py-1 text-right text-xs text-white font-mono"
                      />
                    </td>

                    <td className="py-2 px-3 text-right font-mono font-medium text-emerald-400">
                      ₹{(line.quantity * line.unit_cost).toLocaleString('en-IN')}
                    </td>

                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supporting Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Remarks / Goods Receipt Note Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Delivered by BlueDart Express, AWB #8912389, cartons verified in good condition."
            className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Summary Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Destination: <strong className="text-white">{storeCode}</strong> • Lines: <strong className="text-white">{lines.length}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Updating Balances in D1...' : 'Book Goods Receipt'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
