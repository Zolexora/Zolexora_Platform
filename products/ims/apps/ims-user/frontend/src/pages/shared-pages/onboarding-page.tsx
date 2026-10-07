import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Store,
  Boxes,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);

  // Form State
  const [orgData, setOrgData] = useState({
    businessName: 'Zolexora Retail Operations',
    industry: 'Consumer Electronics & Peripherals',
    currency: '₹ (INR)',
    taxId: '29ABCDE1234F1Z5',
  });

  const [storeData, setStoreData] = useState({
    storeCode: 'S_001',
    storeName: 'Main Central Hub & Warehouse',
    address: 'Plot 42, Industrial Area, Phase 1',
    posCounterName: 'Main Retail Counter 1 (SP_001)',
  });

  const [seedSampleCatalog, setSeedSampleCatalog] = useState(true);
  const [completed, setCompleted] = useState(false);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-[#07080e] text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Brand Header */}
      <div className="max-w-xl mx-auto w-full text-center space-y-2">
        <Link to="/landing" className="inline-flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-600/30">
            Z
          </div>
          <span className="font-bold text-sm tracking-wider text-white">ZOLEXORA IMS</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Store & Workspace Onboarding</h1>
        <p className="text-xs text-slate-400">
          Initialize your organization profile, primary warehouse, and POS register in 3 quick steps
        </p>
      </div>

      {/* Wizard Progress Bar */}
      <div className="max-w-xl mx-auto w-full mt-6">
        <div className="flex items-center justify-between text-xs">
          {[
            { num: 1, label: 'Business Profile' },
            { num: 2, label: 'Warehouse & POS' },
            { num: 3, label: 'Catalog Ready' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  step >= s.num
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                    : 'bg-white/5 text-slate-500 border border-white/10'
                }`}
              >
                {s.num}
              </div>
              <span className={step >= s.num ? 'text-white font-medium' : 'text-slate-500'}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Wizard Card */}
      <div className="max-w-xl mx-auto w-full my-8">
        <div className="bg-[#0f111c] border border-white/10 p-8 rounded-3xl shadow-2xl space-y-6">
          {!completed ? (
            <>
              {/* Step 1: Business Profile */}
              {step === 1 && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-bold text-white">Organization & Business Details</h2>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Business / Organization Name *</label>
                    <input
                      type="text"
                      required
                      value={orgData.businessName}
                      onChange={(e) => setOrgData({ ...orgData, businessName: e.target.value })}
                      className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Industry Segment</label>
                    <input
                      type="text"
                      value={orgData.industry}
                      onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                      className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Primary Currency</label>
                      <select
                        value={orgData.currency}
                        onChange={(e) => setOrgData({ ...orgData, currency: e.target.value })}
                        className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-hidden cursor-pointer"
                      >
                        <option value="₹ (INR)">₹ (Indian Rupee)</option>
                        <option value="$ (USD)">$ (US Dollar)</option>
                        <option value="€ (EUR)">€ (Euro)</option>
                        <option value="£ (GBP)">£ (British Pound)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">GST / Tax Registration</label>
                      <input
                        type="text"
                        value={orgData.taxId}
                        onChange={(e) => setOrgData({ ...orgData, taxId: e.target.value })}
                        className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Warehouse Setup */}
              {step === 2 && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Store className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white">Primary Warehouse & POS Register</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">Store Code *</label>
                      <input
                        type="text"
                        required
                        value={storeData.storeCode}
                        onChange={(e) => setStoreData({ ...storeData, storeCode: e.target.value.toUpperCase() })}
                        className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1.5">POS Register Name *</label>
                      <input
                        type="text"
                        required
                        value={storeData.posCounterName}
                        onChange={(e) => setStoreData({ ...storeData, posCounterName: e.target.value })}
                        className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Warehouse Location Name *</label>
                    <input
                      type="text"
                      required
                      value={storeData.storeName}
                      onChange={(e) => setStoreData({ ...storeData, storeName: e.target.value })}
                      className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1.5">Facility Physical Address</label>
                    <input
                      type="text"
                      value={storeData.address}
                      onChange={(e) => setStoreData({ ...storeData, address: e.target.value })}
                      className="w-full bg-[#181a28] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Catalog Setup */}
              {step === 3 && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Boxes className="w-4 h-4 text-purple-400" />
                    <h2 className="text-sm font-bold text-white">Catalog & Inventory Seeding</h2>
                  </div>

                  <div
                    onClick={() => setSeedSampleCatalog(!seedSampleCatalog)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 select-none ${
                      seedSampleCatalog
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
                        : 'bg-white/5 border-white/5 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={seedSampleCatalog}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-white/10 text-indigo-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Pre-populate Sample Product Catalog (12 High-Velocity Electronics)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Instantly populates your database with realistic products (Logitech MX mice, Keychron keyboards, Sony headphones, SSDs) with ready-to-use stock counts and pricing.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1 text-slate-400">
                    <div className="text-white font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cloudflare D1 Ready</span>
                    </div>
                    <p className="text-[11px]">
                      Your organization nodes are configured for high-concurrency ACID transactions on Cloudflare D1.
                    </p>
                  </div>
                </div>
              )}

              {/* Wizard Nav Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div></div>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                >
                  <span>{step === 3 ? 'Complete Setup' : 'Continue'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            /* Setup Complete Screen */
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">Workspace Successfully Initialized!</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {orgData.businessName} is configured with primary warehouse {storeData.storeName} ({storeData.storeCode}).
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-left space-y-1.5 text-xs text-slate-300 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Code:</span>
                  <span className="text-white">{storeData.storeCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">POS Counter:</span>
                  <span className="text-white">{storeData.posCounterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Catalog Items:</span>
                  <span className="text-emerald-400">12 SKUs Initialized</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => navigate('/pos')}
                  className="py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition"
                >
                  Open POS Register
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition"
                >
                  Enter Inventory Master
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Already have credentials?{' '}
        <Link to="/login" className="text-indigo-400 hover:underline font-medium">
          Sign In
        </Link>
      </div>
    </div>
  );
}
