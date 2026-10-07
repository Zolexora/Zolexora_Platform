"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { Search, Eye, EyeOff, Trash2, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { adminApi.products().then(setProducts).finally(() => setLoading(false)); }, []);

  const filtered = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.seller_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (p: any) => {
    try {
      const res = await adminApi.toggleProduct(p.id);
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, is_active: res.is_active } : x));
      toast.success(res.is_active ? "Product listed" : "Product hidden");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this product?")) return;
    await adminApi.deleteProduct(id);
    setProducts(ps => ps.filter(p => p.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Products</h1>
          <p className="text-ink-muted text-sm mt-0.5">{products.length} total products across all sellers</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or seller..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gold" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-gray-100">
            <tr>{["Product","Seller","Category","Price","Stock","Status","Actions"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({length:6}).map((_,i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-8 shimmer rounded-lg" /></td></tr>
            )) : filtered.map((p,i) => (
              <motion.tr key={p.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.02 }}
                className="hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-gray-400" /></div>}
                    <span className="font-medium text-ink line-clamp-1 max-w-[200px]">{p.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted text-xs">{p.seller_name}</td>
                <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.category}</span></td>
                <td className="px-4 py-3 font-bold text-ink">₹{p.price?.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-ink-muted">{p.stock}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${p.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.is_active ? "Live" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleToggle(p)} className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${p.is_active ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
                      {p.is_active ? <EyeOff size={12}/> : <Eye size={12}/>}
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
