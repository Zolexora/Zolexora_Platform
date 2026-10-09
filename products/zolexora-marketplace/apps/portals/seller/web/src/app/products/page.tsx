"use client";
import { useState, useEffect, useRef } from "react";
import { productsApi } from "@/lib/api";
import { useAuthStore } from "@/store";
import { Plus, Pencil, Trash2, ImagePlus, Eye, EyeOff, Search, Filter, X, Loader2, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Link from "next/link";

const CATS = ["Electronics","Fashion","Home & Living","Beauty","Sports","Food","Other"];

function ProductModal({ product, onClose, onSave }: { product?: any; onClose: () => void; onSave: (p: any) => void }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    title: product?.title || "", description: product?.description || "",
    price: product?.price || "", original_price: product?.original_price || "",
    discount_percent: product?.discount_percent || "", category: product?.category || "Other",
    stock: product?.stock || 999,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price), original_price: form.original_price ? Number(form.original_price) : undefined, discount_percent: form.discount_percent ? Number(form.discount_percent) : undefined, stock: Number(form.stock) };
      const result = isEdit ? await productsApi.update(product.id, payload) : await productsApi.create(payload);
      onSave(result);
      toast.success(isEdit ? "Product updated" : "Product created!");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const inputCls = "w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display text-lg font-bold text-ink">{isEdit ? "Edit Product" : "New Product"}</h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Product Title *</label>
            <input required value={form.title} onChange={set("title")} placeholder="e.g. Pro Wireless Headphones" className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Description *</label>
            <textarea required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Describe your product..." className={`${inputCls} h-auto py-2 resize-none`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Price (₹) *</label>
              <input required type="number" min="0" value={form.price} onChange={set("price")} placeholder="999" className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Original Price (₹)</label>
              <input type="number" min="0" value={form.original_price} onChange={set("original_price")} placeholder="1499" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Discount %</label>
              <input type="number" min="0" max="90" value={form.discount_percent} onChange={set("discount_percent")} placeholder="33" className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Stock</label>
              <input type="number" min="0" value={form.stock} onChange={set("stock")} placeholder="100" className={inputCls} /></div>
          </div>
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Category</label>
            <select value={form.category} onChange={set("category")} className={inputCls} title="Product category">
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-semibold text-ink-muted hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-10 bg-gold hover:bg-gold-dark rounded-xl text-sm font-bold text-ink transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | any>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadForId = useRef<string | null>(null);

  useEffect(() => { productsApi.my().then(setProducts).finally(() => setLoading(false)); }, []);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = async (p: any) => {
    try {
      await productsApi.update(p.id, { is_active: !p.is_active } as any);
      setProducts((ps) => ps.map((pr) => pr.id === p.id ? { ...pr, is_active: !pr.is_active } : pr));
      toast.success(p.is_active ? "Product hidden" : "Product listed");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await productsApi.delete(id);
    setProducts((ps) => ps.filter((p) => p.id !== id));
    toast.success("Deleted");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const id = uploadForId.current;
    if (!file || !id) return;
    setUploading(id);
    try {
      const res = await productsApi.uploadImage(id, file);
      setProducts((ps) => ps.map((p) => p.id === id ? { ...p, images: [...(p.images || []), res.image_url] } : p));
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(null); e.target.value = ""; }
  };

  const triggerUpload = (id: string) => { uploadForId.current = id; fileRef.current?.click(); };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} title="Upload product image" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Products</h1>
          <p className="text-ink-muted text-sm mt-0.5">{products.length} products in your store</p>
        </div>
        <div className="flex gap-2">
          <Link href="/products/bulk"
            className="h-10 px-4 rounded-xl border border-gray-200 hover:border-gold flex items-center gap-2 text-sm font-semibold text-gray-600 transition-all">
            Bulk Upload
          </Link>
          <Link href="/products/new"
            className="h-10 px-5 bg-gold hover:bg-gold-dark rounded-xl flex items-center gap-2 font-bold text-sm text-ink transition-all">
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gold" />
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="h-56 shimmer rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">{search ? "No products match" : "No products yet"}</p>
          {!search && <button onClick={() => setModal("create")} className="mt-4 h-9 px-5 bg-gold rounded-xl text-sm font-bold text-ink">Add your first product</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-white rounded-2xl border overflow-hidden transition-all ${p.is_active ? "border-gray-100" : "border-gray-100 opacity-70"}`}>
                {/* Product image */}
                <div className="relative aspect-video bg-gray-50 overflow-hidden">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
                  {!p.is_active && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><span className="bg-gray-800 text-white text-xs font-semibold px-3 py-1 rounded-full">Hidden</span></div>}
                  <button onClick={() => triggerUpload(p.id)} disabled={uploading === p.id}
                    className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gold transition-colors">
                    {uploading === p.id ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={13} />}
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-ink line-clamp-1 flex-1">{p.title}</h3>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">{p.category}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bold text-sm text-ink">₹{(p.price?.amount_minor / 100 || 0).toLocaleString("en-IN")}</span>
                    {(p.original_price?.amount_minor || 0) > (p.price?.amount_minor || 0) && <span className="text-xs text-gray-400 line-through">₹{(p.original_price?.amount_minor / 100).toLocaleString("en-IN")}</span>}
                    {p.discount_percent > 0 && <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-bold">{Math.round(p.discount_percent)}% off</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/products/${p.id}`}
                      className="flex-1 h-8 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-ink hover:bg-gray-50 transition-colors">
                      <Pencil size={12} /> Edit
                    </Link>
                    <button onClick={() => handleToggle(p)}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 border rounded-lg text-xs font-semibold transition-colors ${p.is_active ? "border-gray-200 hover:bg-gray-50 text-ink" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}>
                      {p.is_active ? <><EyeOff size={12} />Hide</> : <><Eye size={12} />List</>}
                    </button>
                    <button onClick={() => handleDelete(p.id)} title="Delete product"
                      className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <ProductModal product={modal === "create" ? undefined : modal}
            onClose={() => setModal(null)}
            onSave={(saved) => {
              if (modal === "create") setProducts((ps) => [saved, ...ps]);
              else setProducts((ps) => ps.map((p) => p.id === saved.id ? saved : p));
              setModal(null);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}
