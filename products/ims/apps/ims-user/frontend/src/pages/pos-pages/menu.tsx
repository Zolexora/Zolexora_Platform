import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Tag,
  DollarSign,
  Coffee,
  Utensils,
  Layers,
  ArrowUpDown,
  Filter,
  Flame,
  Leaf,
  Check,
  X,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  tax_rate: number; // e.g. 5, 12, 18
  diet: 'veg' | 'non-veg' | 'vegan';
  is_available: boolean;
  shortcode: string;
  prep_time: string;
  stock: number;
}

const INITIAL_MENU: MenuItem[] = [
  { id: 'm1', sku: 'SKU_ESPRESSO', name: 'Artisan Espresso Single', category: 'Beverages', price: 140, tax_rate: 5, diet: 'vegan', is_available: true, shortcode: 'ESP', prep_time: '2m', stock: 45 },
  { id: 'm2', sku: 'SKU_CAPPUCCINO', name: 'Oat Milk Cappuccino', category: 'Beverages', price: 220, tax_rate: 5, diet: 'vegan', is_available: true, shortcode: 'CAP', prep_time: '4m', stock: 38 },
  { id: 'm3', sku: 'SKU_MATCHA', name: 'Ceremonial Matcha Latte', category: 'Beverages', price: 260, tax_rate: 5, diet: 'veg', is_available: true, shortcode: 'MAT', prep_time: '3m', stock: 24 },
  { id: 'm4', sku: 'SKU_CROISSANT', name: 'Butter Croissant Flaky', category: 'Bakery', price: 160, tax_rate: 5, diet: 'veg', is_available: true, shortcode: 'CRS', prep_time: '1m', stock: 18 },
  { id: 'm5', sku: 'SKU_BAGEL', name: 'Smoked Salmon Bagel', category: 'Mains', price: 380, tax_rate: 12, diet: 'non-veg', is_available: true, shortcode: 'BAG', prep_time: '7m', stock: 12 },
  { id: 'm6', sku: 'SKU_PANEER_WRAP', name: 'Tandoori Paneer Roll', category: 'Mains', price: 240, tax_rate: 5, diet: 'veg', is_available: true, shortcode: 'PAN', prep_time: '6m', stock: 20 },
  { id: 'm7', sku: 'SKU_CHICKEN_WINGS', name: 'Crispy Korean Wings', category: 'Appetizers', price: 340, tax_rate: 12, diet: 'non-veg', is_available: false, shortcode: 'WNG', prep_time: '10m', stock: 0 },
  { id: 'm8', sku: 'SKU_AVO_TOAST', name: 'Sourdough Avocado Toast', category: 'Mains', price: 320, tax_rate: 5, diet: 'vegan', is_available: true, shortcode: 'AVO', prep_time: '5m', stock: 15 },
  { id: 'm9', sku: 'SKU_BROWNIE', name: 'Belgian Fudge Brownie', category: 'Desserts', price: 180, tax_rate: 18, diet: 'veg', is_available: true, shortcode: 'BRW', prep_time: '2m', stock: 30 },
  { id: 'm10', sku: 'SKU_CHEESECAKE', name: 'Lotus Biscoff Cheesecake', category: 'Desserts', price: 290, tax_rate: 18, diet: 'veg', is_available: true, shortcode: 'LBC', prep_time: '2m', stock: 8 },
  { id: 'm11', sku: 'SKU_ICED_TEA', name: 'Peach Passion Iced Tea', category: 'Beverages', price: 180, tax_rate: 5, diet: 'vegan', is_available: true, shortcode: 'TEA', prep_time: '2m', stock: 50 },
  { id: 'm12', sku: 'SKU_TRUFFLE_FRIES', name: 'Parmesan Truffle Fries', category: 'Appetizers', price: 220, tax_rate: 5, diet: 'veg', is_available: true, shortcode: 'TRS', prep_time: '6m', stock: 22 },
];

export default function PosMenu() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [items, setItems] = useState<MenuItem[]>(INITIAL_MENU);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Fetch live products catalog from database
  useEffect(() => {
    authFetch('/api/v1/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setItems(
            data.map((p: any) => ({
              id: p.id || p.item_code,
              sku: p.item_code,
              name: p.description,
              category: p.category || 'Mains',
              price: p.rate,
              tax_rate: p.tax_percent ?? 5,
              diet: (p.diet as MenuItem['diet']) || 'veg',
              is_available: p.status === 'Active',
              shortcode: p.shortcode || p.item_code.slice(0, 3).toUpperCase(),
              prep_time: p.prep_time || '5m',
              stock: p.total_stock ?? ((p.stock_s_001 || 0) + (p.stock_s_002 || 0)),
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Form state
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    category: 'Beverages',
    price: 150,
    tax_rate: 5,
    diet: 'veg',
    shortcode: '',
    is_available: true,
  });

  const categories = ['All', 'Beverages', 'Bakery', 'Mains', 'Appetizers', 'Desserts', 'Electronics', 'Audio', 'Accessories'];

  // Toggle in-stock / 86-item status
  const handleToggleAvailability = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_available: !item.is_available } : item))
    );
  };

  const handleOpenModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'Beverages',
        price: 150,
        tax_rate: 5,
        diet: 'veg',
        shortcode: '',
        is_available: true,
      });
    }
    setShowModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    if (editingItem) {
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? { ...it, ...formData } as MenuItem : it))
      );
      try {
        await authFetch(`/api/v1/products/${editingItem.sku || editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: formData.name,
            rate: formData.price,
            category: formData.category,
            tax_percent: formData.tax_rate,
          }),
        });
      } catch {}
    } else {
      const newSku = `SKU_${Date.now().toString().slice(-6)}`;
      const newItem: MenuItem = {
        id: newSku,
        sku: newSku,
        name: formData.name,
        category: formData.category || 'Beverages',
        price: Number(formData.price),
        tax_rate: Number(formData.tax_rate) || 5,
        diet: (formData.diet as MenuItem['diet']) || 'veg',
        is_available: formData.is_available ?? true,
        shortcode: formData.shortcode || newSku.slice(-3),
        prep_time: formData.prep_time || '5m',
        stock: Number(formData.stock) || 20,
      };
      setItems([newItem, ...items]);
      try {
        await authFetch('/api/v1/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_code: newSku,
            description: newItem.name,
            category: newItem.category,
            rate: newItem.price,
            tax_percent: newItem.tax_rate,
            uom: 'Pcs',
            central_stock: newItem.stock,
            stock_s_001: newItem.stock,
            stock_s_002: 0,
            total_stock: newItem.stock,
            status: 'Active',
          }),
        });
      } catch {}
    }
    setShowModal(false);
  };

  const filteredItems = items.filter((it) => {
    const matchesCategory = selectedCategory === 'All' || it.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      it.name.toLowerCase().includes(q) ||
      it.sku.toLowerCase().includes(q) ||
      it.shortcode.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const availableCount = items.filter((i) => i.is_available).length;
  const soldOutCount = items.filter((i) => !i.is_available).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#07080e] p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <span>POS Menu Master & Shortcodes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage quick register keys, 86-item stock availability, GST rates & cashier shortcodes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Menu Items</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{items.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">In Active POS Catalog</div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>In-Stock / Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1.5">{availableCount}</div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">Live on Register screen</div>
        </div>

        <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center justify-between">
            <span>86'd / Sold Out</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1.5">{soldOutCount}</div>
          <div className="text-[11px] text-rose-400/80 mt-0.5">Blocked from ordering</div>
        </div>

        <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
            <span>Catalog Sync</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1.5">Instant</div>
          <div className="text-[11px] text-indigo-400/80 mt-0.5">Zero reload required</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search item, SKU or shortcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-56"
          />
        </div>
      </div>

      {/* Menu Item Table */}
      <div className="flex-1 overflow-y-auto border border-white/10 rounded-2xl bg-slate-900/30">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="bg-[#0b0d18] text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-white/10">
            <tr>
              <th className="py-3 px-4">Item Name & Diet</th>
              <th className="py-3 px-4">Shortcode</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Tax (GST)</th>
              <th className="py-3 px-4 text-right">Price (₹)</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-white/5 transition group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[8px] font-black ${
                        item.diet === 'veg'
                          ? 'border-emerald-500 text-emerald-400'
                          : item.diet === 'vegan'
                          ? 'border-cyan-500 text-cyan-400'
                          : 'border-rose-500 text-rose-400'
                      }`}
                    >
                      ●
                    </span>
                    <div>
                      <div className="font-semibold text-white group-hover:text-emerald-300 transition">
                        {item.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-amber-300 font-bold text-[11px]">
                    {item.shortcode}
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-medium border border-white/5">
                    {item.category}
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span className="text-slate-400 font-mono text-[11px]">{item.tax_rate}% GST</span>
                </td>

                <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                  ₹{item.price.toFixed(2)}
                </td>

                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleToggleAvailability(item.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition border ${
                      item.is_available
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                    }`}
                  >
                    {item.is_available ? 'Available' : '86 / Sold Out'}
                  </button>
                </td>

                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f121d] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span>{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Item Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Vanilla Cold Brew"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} className="bg-slate-900">{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Diet Type</label>
                  <select
                    value={formData.diet}
                    onChange={(e) => setFormData({ ...formData, diet: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="veg" className="bg-slate-900">Vegetarian</option>
                    <option value="non-veg" className="bg-slate-900">Non-Vegetarian</option>
                    <option value="vegan" className="bg-slate-900">Vegan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Price (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tax (GST %)</label>
                  <select
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="0" className="bg-slate-900">0% (Nil)</option>
                    <option value="5" className="bg-slate-900">5% (F&B standard)</option>
                    <option value="12" className="bg-slate-900">12% (Packaged)</option>
                    <option value="18" className="bg-slate-900">18% (Luxury)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Register Shortcode (Hot-key)
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={formData.shortcode}
                  onChange={(e) => setFormData({ ...formData, shortcode: e.target.value.toUpperCase() })}
                  placeholder="e.g. VCB"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
