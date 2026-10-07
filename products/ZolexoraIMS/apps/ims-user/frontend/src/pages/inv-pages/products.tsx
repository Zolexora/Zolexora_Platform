import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  ArrowUpDown,
  Trash2,
  RefreshCw,
  Boxes,
  Truck,
  PackagePlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import StockAdjustModal from './components/stock-adjust-modal';

interface Product {
  item_code: string;
  description: string;
  category: string;
  rate: number;
  tax_percent: number;
  min_stock: number;
  stock_s_001: number;
  stock_s_002: number;
  central_stock: number;
  total_stock: number;
  total_valuation: number;
  uom: string;
  status: string;
  last_updated?: string;
}

const DEFAULT_PRODUCTS: Product[] = [
  { item_code: "P001", description: "Logitech MX Master 3S Wireless Mouse", category: "Electronics", rate: 8999.0, tax_percent: 18.0, min_stock: 10, stock_s_001: 25, stock_s_002: 10, central_stock: 50, total_stock: 85, total_valuation: 764915.0, uom: "Pcs", status: "Active" },
  { item_code: "P002", description: "Keychron K2 Mechanical Keyboard V2", category: "Electronics", rate: 7499.0, tax_percent: 18.0, min_stock: 8, stock_s_001: 14, stock_s_002: 5, central_stock: 20, total_stock: 39, total_valuation: 292461.0, uom: "Pcs", status: "Active" },
  { item_code: "P003", description: "Dell UltraSharp 27 4K Monitor U2723QE", category: "Electronics", rate: 52000.0, tax_percent: 18.0, min_stock: 5, stock_s_001: 6, stock_s_002: 2, central_stock: 12, total_stock: 20, total_valuation: 1040000.0, uom: "Pcs", status: "Active" },
  { item_code: "P004", description: "Sony WH-1000XM5 Noise Cancelling Headphones", category: "Audio", rate: 29990.0, tax_percent: 18.0, min_stock: 8, stock_s_001: 9, stock_s_002: 4, central_stock: 15, total_stock: 28, total_valuation: 839720.0, uom: "Pcs", status: "Active" },
  { item_code: "P005", description: "Apple AirPods Pro (2nd Gen) USB-C", category: "Audio", rate: 24900.0, tax_percent: 18.0, min_stock: 10, stock_s_001: 18, stock_s_002: 8, central_stock: 30, total_stock: 56, total_valuation: 1394400.0, uom: "Pcs", status: "Active" },
  { item_code: "P006", description: "Anker 737 Power Bank (PowerCore 24K)", category: "Accessories", rate: 12499.0, tax_percent: 18.0, min_stock: 12, stock_s_001: 20, stock_s_002: 7, central_stock: 40, total_stock: 67, total_valuation: 837433.0, uom: "Pcs", status: "Active" },
  { item_code: "P007", description: "Samsung T7 Shield 2TB Portable SSD", category: "Storage", rate: 16999.0, tax_percent: 18.0, min_stock: 10, stock_s_001: 15, stock_s_002: 6, central_stock: 25, total_stock: 46, total_valuation: 781954.0, uom: "Pcs", status: "Active" },
  { item_code: "P008", description: "Belkin BoostCharge Pro 3-in-1 Wireless Pad", category: "Accessories", rate: 11999.0, tax_percent: 18.0, min_stock: 6, stock_s_001: 11, stock_s_002: 3, central_stock: 18, total_stock: 32, total_valuation: 383968.0, uom: "Pcs", status: "Active" },
  { item_code: "P009", description: "Ergotron LX Desk Mount LCD Arm", category: "Office", rate: 15500.0, tax_percent: 18.0, min_stock: 5, stock_s_001: 8, stock_s_002: 2, central_stock: 10, total_stock: 20, total_valuation: 310000.0, uom: "Pcs", status: "Active" },
  { item_code: "P010", description: "CalDigit TS4 Thunderbolt 4 Dock", category: "Accessories", rate: 38500.0, tax_percent: 18.0, min_stock: 5, stock_s_001: 4, stock_s_002: 1, central_stock: 8, total_stock: 13, total_valuation: 500500.0, uom: "Pcs", status: "Active" },
  { item_code: "P011", description: "Shure SM7B Vocal Dynamic Microphone", category: "Audio", rate: 36900.0, tax_percent: 18.0, min_stock: 4, stock_s_001: 5, stock_s_002: 2, central_stock: 7, total_stock: 14, total_valuation: 516600.0, uom: "Pcs", status: "Active" },
  { item_code: "P012", description: "Elgato Stream Deck XL 32 Keys", category: "Electronics", rate: 21990.0, tax_percent: 18.0, min_stock: 6, stock_s_001: 7, stock_s_002: 3, central_stock: 14, total_stock: 24, total_valuation: 527760.0, uom: "Pcs", status: "Active" },
];

export default function Products() {
  const { authFetch } = useAuth();
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low' | 'Out'>('All');

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/items');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.category));
    return ['All', ...Array.from(s)];
  }, [products]);

  const filteredItems = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.item_code.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      let matchesStock = true;
      if (stockFilter === 'Low') matchesStock = p.total_stock <= p.min_stock && p.total_stock > 0;
      if (stockFilter === 'Out') matchesStock = p.total_stock <= 0;
      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, search, selectedCategory, stockFilter]);

  const handleDelete = async (item_code: string) => {
    if (!confirm(`Are you sure you want to delete SKU ${item_code}?`)) return;
    try {
      await authFetch(`/api/v1/items/${item_code}`, { method: 'DELETE' });
    } catch {}
    setProducts((prev) => prev.filter((p) => p.item_code !== item_code));
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-400" />
            Product Master & Stock Registry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage product specifications, multi-store stock allocations, unit rates, and replenishment triggers
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProducts}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition"
            title="Refresh from D1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <Link
            to="/forms/purchase-entry"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-semibold transition"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>+ Purchase Entry</span>
          </Link>
          <Link
            to="/forms/sku-addition"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Add SKU</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#12141f] border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU code, brand, or product title..."
            className="w-full bg-[#181a28] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#181a28] border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2 outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-[#181a28] border border-white/10 rounded-xl p-0.5 text-xs">
            {(['All', 'Low', 'Out'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStockFilter(filter)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  stockFilter === filter
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {filter === 'All' ? 'All' : filter === 'Low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#12141f] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#161826] border-b border-white/10 text-slate-400 font-medium">
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Unit Rate</th>
                <th className="py-3 px-3 text-center">Store 1</th>
                <th className="py-3 px-3 text-center">Store 2</th>
                <th className="py-3 px-3 text-center">Central</th>
                <th className="py-3 px-3 text-center">Total Stock</th>
                <th className="py-3 px-4 text-right">Valuation</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.total_stock <= item.min_stock && item.total_stock > 0;
                  const isOut = item.total_stock <= 0;

                  return (
                    <tr key={item.item_code} className="hover:bg-white/5 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {item.item_code}
                      </td>
                      <td className="py-3 px-4 font-medium text-white max-w-[220px] truncate">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{item.category}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200">
                        ₹{item.rate.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        {item.stock_s_001}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        {item.stock_s_002}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {item.central_stock}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-white">
                        {item.total_stock} {item.uom}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-emerald-400">
                        ₹{item.total_valuation.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setAdjustProduct(item)}
                            className="p-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                            title="Restock or Adjust"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.item_code)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition"
                            title="Delete SKU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockAdjustModal
        isOpen={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        product={adjustProduct}
        onStockUpdated={(updated) => {
          setProducts((prev) =>
            prev.map((p) => (p.item_code === updated.item_code ? updated : p))
          );
        }}
      />
    </div>
  );
}
