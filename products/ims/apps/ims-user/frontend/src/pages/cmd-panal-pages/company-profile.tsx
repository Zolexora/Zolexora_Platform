import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building,
  FileText,
  MapPin,
  Phone,
  Mail,
  Save,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export default function OrgCompanyProfile() {
  const { authFetch } = useAuth();

  const [legalName, setLegalName] = useState('Zolexora Retail Operations Pvt Ltd');
  const [tradeName, setTradeName] = useState('Zolexora Artisan Roasters');
  const [gstin, setGstin] = useState('27AABCZ1234F1Z8');
  const [pan, setPan] = useState('AABCZ1234F');
  const [storeAddress, setStoreAddress] = useState('Shop 4, Ground Floor, Cyber City Boulevard, Mumbai, Maharashtra 400051');
  const [phoneOnReceipt, setPhoneOnReceipt] = useState('+91 98765 43210');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with Zolexora! Have a great day.');
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(0.0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/settings/terminal');
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          const s = data.settings;
          setLegalName(s.store_legal_name || 'Zolexora Retail Operations Pvt Ltd');
          setGstin(s.gstin || '27AABCZ1234F1Z8');
          setStoreAddress(s.store_address || 'Shop 4, Ground Floor, Cyber City Boulevard, Mumbai');
          setPhoneOnReceipt(s.phone_on_receipt || '+91 98765 43210');
          setReceiptFooter(s.receipt_footer || 'Thank you for dining with Zolexora! Have a great day.');
          setServiceChargePercent(s.service_charge_percent || 0.0);
          if (s.gstin && s.gstin.length >= 12) {
            setPan(s.gstin.substring(2, 12));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load company profile:', err);
    }
    setLoading(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/v1/settings/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_legal_name: legalName.trim(),
          gstin: gstin.trim().toUpperCase(),
          store_address: storeAddress.trim(),
          phone_on_receipt: phoneOnReceipt.trim(),
          receipt_footer: receiptFooter.trim(),
          service_charge_percent: Number(serviceChargePercent) || 0.0,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save company settings:', err);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Company Legal Profile & Tax Identity</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              CORPORATE IDENTITY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure legal entity names, GSTIN compliance, registered corporate addresses, and tax policies.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Legal Profile'}</span>
        </button>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Company legal profile and tax rules persisted to database.</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-white/5">
          <Building className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Organization Registration & Tax Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Legal Entity Name *</label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Zolexora Retail Operations Pvt Ltd"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Official legal name on incorporation/current account documents.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Brand / Trade Name</label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder="e.g. Zolexora Artisan Roasters"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Customer-facing trade name on store banners & menus.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">GSTIN (15 Digits) *</label>
            <input
              type="text"
              required
              value={gstin}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setGstin(val);
                if (val.length >= 12) setPan(val.substring(2, 12));
              }}
              placeholder="e.g. 27AABCZ1234F1Z8"
              maxLength={15}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs uppercase"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Printed on all tax invoices and electronic B2B e-invoices.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Entity PAN Number</label>
            <input
              type="text"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="e.g. AABCZ1234F"
              maxLength={10}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs uppercase"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Permanent Account Number extracted from GSTIN chars 3-12.
            </span>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-300 mb-1 font-semibold">Registered Corporate Address *</label>
            <textarea
              rows={2}
              required
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="Complete legal business address with City, State, and PIN code"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Corporate Support Phone</label>
            <input
              type="text"
              value={phoneOnReceipt}
              onChange={(e) => setPhoneOnReceipt(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">Optional Service Charge (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              value={serviceChargePercent}
              onChange={(e) => setServiceChargePercent(parseFloat(e.target.value) || 0)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-300 mb-1 font-semibold">Invoice Receipt Footer Greeting</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="e.g. Thank you for dining with Zolexora! Have a great day."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
