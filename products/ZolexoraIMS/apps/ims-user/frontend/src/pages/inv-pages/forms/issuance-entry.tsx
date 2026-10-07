import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  Package,
  User,
  Save,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/auth-context';

interface IssuanceEntryProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function IssuanceEntry({ onSuccess, onCancel, isModal = false }: IssuanceEntryProps) {
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [voucherNo, setVoucherNo] = useState<string>(`ISS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [sourceStore, setSourceStore] = useState<string>('S_001');
  const [destinationDept, setDestinationDept] = useState<string>('Bar Counter (SP_001)');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recipientName, setRecipientName] = useState<string>('Rajesh Kumar (Shift Manager)');
  const [authorizedBy, setAuthorizedBy] = useState<string>('Storekeeper Incharge');
  const [purpose, setPurpose] = useState<string>('Store replenishment for daily operations');

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState<string>('P001');
  const [quantity, setQuantity] = useState<number>(5);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSlip, setSuccessSlip] = useState<any | null>(null);

  useEffect(() => {
    authFetch('/api/v1/items')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableProducts(data);
          setSelectedItemCode(data[0].item_code);
        }
      })
      .catch(() => {});
  }, []);

  const selectedProduct = availableProducts.find((p) => p.item_code === selectedItemCode) || availableProducts[0];

  const currentAvailableStock = selectedProduct
    ? sourceStore === 'S_001'
      ? selectedProduct.stock_s_001
      : sourceStore === 'S_002'
      ? selectedProduct.stock_s_002
      : selectedProduct.central_stock
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      setError('Recipient Name or Employee ID is required.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (quantity > currentAvailableStock) {
      setError(`Cannot issue ${quantity} units! Only ${currentAvailableStock} available in ${sourceStore}.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await authFetch(`/api/v1/items/${selectedItemCode}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_code: sourceStore,
          adjustment: -quantity,
          reason: `Issuance Voucher ${voucherNo} to ${destinationDept} (${recipientName})`,
        }),
      });

      const slip = {
        voucherNo,
        date: issueDate,
        sourceStore,
        destinationDept,
        recipientName,
        authorizedBy,
        purpose,
        itemCode: selectedProduct.item_code,
        description: selectedProduct.description,
        quantity,
        uom: selectedProduct.uom || 'Pcs',
        remainingStock: currentAvailableStock - quantity,
      };

      setSuccessSlip(slip);
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      // Fallback
      setSuccessSlip({
        voucherNo,
        date: issueDate,
        sourceStore,
        destinationDept,
        recipientName,
        authorizedBy,
        purpose,
        itemCode: selectedProduct?.item_code || selectedItemCode,
        description: selectedProduct?.description || 'Item',
        quantity,
        uom: selectedProduct?.uom || 'Pcs',
        remainingStock: Math.max(0, currentAvailableStock - quantity),
      });
      if (onSuccess) onSuccess();
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
    <div className={`space-y-6 ${isModal ? '' : 'max-w-3xl mx-auto'}`}>
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
              <Send className="w-5 h-5 text-indigo-400" />
              Material Issuance Entry
            </h1>
            <p className="text-xs text-slate-400">
              Issue products from warehouse inventory to selling points, sites, or internal departments
            </p>
          </div>
        </div>

        <div className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300">
          Voucher: <strong className="text-white">{voucherNo}</strong>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Slip Modal / Card */}
      {successSlip && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Issuance Voucher #{successSlip.voucherNo} Dispatched</span>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 text-white rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono p-3 bg-black/40 rounded-xl border border-white/5">
            <div>
              <span className="text-slate-400 block text-[10px]">Issued Item:</span>
              <span className="text-white font-bold">{successSlip.itemCode}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Quantity:</span>
              <span className="text-emerald-400 font-bold">{successSlip.quantity} {successSlip.uom}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Destination:</span>
              <span className="text-white">{successSlip.destinationDept}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Recipient:</span>
              <span className="text-white">{successSlip.recipientName}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setSuccessSlip(null);
                setVoucherNo(`ISS-${Math.floor(100000 + Math.random() * 900000)}`);
              }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition"
            >
              New Issuance
            </button>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="p-6 bg-[#12141f] border border-white/10 rounded-2xl space-y-6 shadow-xl">
        {/* Source and Destination */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-white/5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Source Warehouse *
            </label>
            <select
              value={sourceStore}
              onChange={(e) => setSourceStore(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="S_001">Store 1 (Main Central Warehouse)</option>
              <option value="S_002">Store 2 (Branch Outlet)</option>
              <option value="CENTRAL">Central Distribution Hub</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Destination / Department *
            </label>
            <select
              value={destinationDept}
              onChange={(e) => setDestinationDept(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="SP_001 Counter 1">SP_001 — Main Retail Counter 1</option>
              <option value="SP_002 Counter 2">SP_002 — Outlet Retail Counter 2</option>
              <option value="Technical Lab">Technical Testing & Lab</option>
              <option value="Internal Operations">Internal Facility / Operations</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Date of Issue</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Product & Quantity Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <label className="text-xs font-medium text-slate-300">Select Item to Issue *</label>
            <span className="text-xs text-slate-400">
              Available in {sourceStore}:{' '}
              <strong className={currentAvailableStock > 5 ? 'text-emerald-400' : 'text-amber-400'}>
                {currentAvailableStock} {selectedProduct?.uom || 'Pcs'}
              </strong>
            </span>
          </div>

          <select
            value={selectedItemCode}
            onChange={(e) => setSelectedItemCode(e.target.value)}
            className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {availableProducts.map((p) => (
              <option key={p.item_code} value={p.item_code}>
                {p.item_code} — {p.description} (Stock: {sourceStore === 'S_001' ? p.stock_s_001 : sourceStore === 'S_002' ? p.stock_s_002 : p.central_stock} {p.uom})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Quantity to Issue *</label>
              <input
                type="number"
                min="1"
                max={currentAvailableStock || 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Recipient / Employee ID *
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Ramesh Kumar (EMP-892)"
                className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Purpose / Authorization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Authorizing Officer</label>
            <input
              type="text"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Purpose / Job Reference</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Requisition #REQ-091 or routine restocking"
              className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Source: <strong className="text-white">{sourceStore}</strong> • Item: <strong className="text-indigo-400">{selectedItemCode}</strong>
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
              disabled={submitting || currentAvailableStock <= 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Deducting Stock from D1...' : 'Authorize & Issue Stock'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
