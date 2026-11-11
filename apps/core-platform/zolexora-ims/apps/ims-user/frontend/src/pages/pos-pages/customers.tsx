import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Award,
  CreditCard,
  Calendar,
  Gift,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  Sparkles,
  ShoppingBag,
  IndianRupee,
  X,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  loyalty_points: number;
  total_orders: number;
  lifetime_spent: number;
  last_visit: string;
  fav_item: string;
}

export default function PosCustomers() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    tier: 'Bronze' as Customer['tier'],
  });

  const loadCustomers = () => {
    setLoading(true);
    authFetch('/api/v1/customers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomers(
            data.map((c: any) => ({
              id: c.phone,
              name: c.name,
              phone: c.phone,
              email: c.email || undefined,
              tier: (c.tier as Customer['tier']) || 'Silver',
              loyalty_points: c.loyalty_points || 0,
              total_orders: c.total_orders || 0,
              lifetime_spent: c.total_spend || 0,
              last_visit: c.last_visit || 'Recently',
              fav_item: 'Oat Milk Cappuccino',
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const tiers = ['All', 'Platinum', 'Gold', 'Silver', 'Bronze'];

  const filtered = customers.filter((c) => {
    const matchesTier = selectedTier === 'All' || c.tier === selectedTier;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q));
    return matchesTier && matchesSearch;
  });

  const totalPoints = customers.reduce((acc, c) => acc + c.loyalty_points, 0);
  const totalLifetimeRevenue = customers.reduce((acc, c) => acc + c.lifetime_spent, 0);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;

    try {
      const res = await authFetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          tier: form.tier,
          loyalty_points: 50,
          total_orders: 0,
          total_spend: 0,
        }),
      });
      if (res.ok) {
        loadCustomers();
      }
    } catch {}

    setShowAddModal(false);
    setForm({ name: '', phone: '', email: '', tier: 'Bronze' });
  };

  const handleStartOrder = (cust: Customer) => {
    navigate(`/pos/dashboard?customer=${encodeURIComponent(cust.name)}&phone=${encodeURIComponent(cust.phone)}`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Customer CRM & Loyalty Points</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track frequent guests, manage reward point redemption, purchase history & phone directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Enrolled Guests</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{customers.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active profiles in CRM</div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>Points Outstanding</span>
            <Gift className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1.5">{totalPoints.toLocaleString('en-IN')} pts</div>
          <div className="text-[11px] text-indigo-400/80 mt-0.5">₹{(totalPoints * 0.5).toFixed(0)} redeemable value</div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>VIP & Platinum</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1.5">
            {customers.filter((c) => c.tier === 'Platinum').length} Members
          </div>
          <div className="text-[11px] text-amber-400/80 mt-0.5">High-frequency patrons</div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Lifetime Spend</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1.5">
            ₹{totalLifetimeRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Total recorded purchases</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {tiers.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTier(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                selectedTier === t
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by phone, name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-64"
          />
        </div>
      </div>

      {/* Grid Layout: Customer List & Detail Drawer */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Table/Cards */}
        <div className="lg:col-span-2 overflow-y-auto border border-white/10 rounded-2xl bg-slate-900/30">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-[#0b0d18] text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4 text-right">Points</th>
                <th className="py-3 px-4 text-right">Lifetime Spend</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`cursor-pointer transition group ${
                      isSelected ? 'bg-emerald-600/15 text-white' : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white group-hover:text-emerald-300 transition">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{c.total_orders} Orders placed</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-300">{c.phone}</div>
                      {c.email && <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{c.email}</div>}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          c.tier === 'Platinum'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : c.tier === 'Gold'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : c.tier === 'Silver'
                            ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {c.tier}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                      {c.loyalty_points}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      ₹{c.lifetime_spent.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartOrder(c);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-semibold transition"
                      >
                        Bill Now
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Customer Inspector */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          {selectedCustomer ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Customer Profile</div>
                    <div className="text-xl font-black text-white">{selectedCustomer.name}</div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                      selectedCustomer.tier === 'Platinum'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : selectedCustomer.tier === 'Gold'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : selectedCustomer.tier === 'Silver'
                        ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedCustomer.tier} Tier
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      Phone Number
                    </span>
                    <span className="text-white font-mono font-semibold">{selectedCustomer.phone}</span>
                  </div>

                  {selectedCustomer.email && (
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-indigo-400" />
                        Email Address
                      </span>
                      <span className="text-white font-semibold truncate max-w-[160px]">
                        {selectedCustomer.email}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      Loyalty Points
                    </span>
                    <span className="text-amber-300 font-mono font-bold text-sm">
                      {selectedCustomer.loyalty_points} pts (₹{(selectedCustomer.loyalty_points * 0.5).toFixed(0)})
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                      Total Visits
                    </span>
                    <span className="text-white font-semibold">{selectedCustomer.total_orders} Bills</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      Total Revenue
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      ₹{selectedCustomer.lifetime_spent.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      Favorite Order
                    </span>
                    <span className="text-slate-200 font-semibold">{selectedCustomer.fav_item}</span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Loyalty Reward Status</div>
                  <div className="text-xs text-slate-300">
                    Eligible for <span className="text-emerald-400 font-bold">₹{(selectedCustomer.loyalty_points * 0.5).toFixed(0)}</span> instant discount on next register checkout.
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleStartOrder(selectedCustomer)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/25"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Start New POS Order</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Users className="w-12 h-12 text-slate-600 mb-3" />
              <div className="font-bold text-slate-300 text-sm">No Customer Selected</div>
              <p className="text-xs text-slate-500 mt-1">
                Select a customer from the directory to review points, phone numbers, or initiate an order.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f121d] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Add New Customer</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 98765 00000"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Email Address (Optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Initial Membership Tier</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as any })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bronze" className="bg-slate-900">Bronze (Standard)</option>
                  <option value="Silver" className="bg-slate-900">Silver</option>
                  <option value="Gold" className="bg-slate-900">Gold</option>
                  <option value="Platinum" className="bg-slate-900">Platinum (VIP)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                >
                  Create Profile (+50 Pts Bonus)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
