"use client";
import { useState, useEffect, useRef } from "react";
import { reelsApi, productsApi } from "@/lib/api";
import { Plus, Trash2, Video, ImagePlus, Loader2, Link2, X, Eye, Megaphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

function ReelModal({ onClose, onSave, products }: { onClose: () => void; onSave: (r: any) => void; products: any[] }) {
  const [form, setForm] = useState({ title: "", description: "", content_type: "organic", linked_product_id: "", sponsor_data: { cta_label: "Shop Now", cta_url: "", brand_name: "" } });
  const [reel, setReel] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: any = { title: form.title, description: form.description, content_type: form.content_type };
      if (form.linked_product_id) payload.linked_product_id = form.linked_product_id;
      if (form.content_type === "sponsored") payload.sponsor_data = form.sponsor_data;
      const created = await reelsApi.create(payload);
      setReel(created);
      toast.success("Reel created! Now upload your media.");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !reel) return;
    setUploading(true);
    try {
      const res = await reelsApi.uploadMedia(reel.id, file);
      const updated = { ...reel, video_url: res.video_url };
      setReel(updated); toast.success("Media uploaded!");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDone = () => { if (reel) onSave(reel); onClose(); };

  const inputCls = "w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display text-lg font-bold text-ink">Upload Reel</h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        {!reel ? (
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Reel Title *</label>
              <input required value={form.title} onChange={set("title")} placeholder="e.g. Unboxing our new collection" className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Caption for your reel" className={`${inputCls} h-auto py-2 resize-none`} /></div>

            {/* Type selector */}
            <div>
              <label className="text-xs font-semibold text-ink-muted mb-2 block">Content Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ val: "organic", icon: Video, label: "Organic", sub: "Regular content reel" },
                  { val: "sponsored", icon: Megaphone, label: "Sponsored", sub: "Promotional reel with CTA" }].map((t) => (
                  <button key={t.val} type="button" onClick={() => setForm((f) => ({ ...f, content_type: t.val }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.content_type === t.val ? "border-gold bg-gold/5" : "border-gray-100 hover:border-gray-200"}`}>
                    <t.icon size={15} className="mb-1 text-ink-muted" />
                    <p className="text-sm font-semibold text-ink">{t.label}</p>
                    <p className="text-[11px] text-ink-muted">{t.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Link product */}
            {products.length > 0 && (
              <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Link to Product (optional)</label>
                <select value={form.linked_product_id} onChange={set("linked_product_id")} className={inputCls} title="Link to Product">
                  <option value="">None</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select></div>
            )}

            {/* Sponsor data */}
            {form.content_type === "sponsored" && (
              <div className="space-y-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs font-bold text-amber-800 mb-2">Sponsor Details</p>
                <input value={form.sponsor_data.brand_name} onChange={(e) => setForm((f) => ({ ...f, sponsor_data: { ...f.sponsor_data, brand_name: e.target.value } }))} placeholder="Brand name" className={inputCls} />
                <input value={form.sponsor_data.cta_label} onChange={(e) => setForm((f) => ({ ...f, sponsor_data: { ...f.sponsor_data, cta_label: e.target.value } }))} placeholder="CTA button text (e.g. Shop Now)" className={inputCls} />
                <input value={form.sponsor_data.cta_url} onChange={(e) => setForm((f) => ({ ...f, sponsor_data: { ...f.sponsor_data, cta_url: e.target.value } }))} placeholder="CTA URL" className={inputCls} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-semibold text-ink-muted hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 h-10 bg-gold hover:bg-gold-dark rounded-xl text-sm font-bold text-ink disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Next: Upload Media
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-5">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
              <p className="font-semibold text-green-800 text-sm">✓ Reel &quot;{reel.title}&quot; created</p>
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              {reel.video_url ? (
                <div className="space-y-3">
                  <img src={reel.video_url} alt="" className="w-full max-h-40 object-cover rounded-xl" />
                  <p className="text-sm text-green-600 font-semibold">✓ Media uploaded</p>
                </div>
              ) : (
                <div>
                  <Video size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-ink-muted mb-3">Upload your video or image</p>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="h-9 px-5 bg-gold hover:bg-gold-dark rounded-xl text-sm font-bold text-ink flex items-center gap-2 mx-auto">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                    {uploading ? "Uploading..." : "Choose File"}
                  </button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleUpload} title="Upload media file" />
            <button onClick={handleDone} className="w-full h-10 bg-ink hover:bg-ink-soft text-white rounded-xl text-sm font-bold transition-colors">
              Done — Publish Reel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ReelsPage() {
  const [reels, setReels] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    Promise.all([reelsApi.my(), productsApi.my()])
      .then(([r, p]) => { setReels(r); setProducts(p); })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reel?")) return;
    await reelsApi.delete(id);
    setReels((rs) => rs.filter((r) => r.id !== id));
    toast.success("Reel deleted");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Reels</h1>
          <p className="text-ink-muted text-sm mt-0.5">{reels.length} reels · earn coins when people watch</p>
        </div>
        <button onClick={() => setModal(true)}
          className="h-10 px-5 bg-gold hover:bg-gold-dark rounded-xl flex items-center gap-2 font-bold text-sm text-ink transition-all">
          <Plus size={16} /> Upload Reel
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="aspect-[9/16] shimmer rounded-2xl" />)}
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Video size={40} className="text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">No reels yet</p>
          <p className="text-sm text-ink-muted mt-1 mb-4">Upload reels to earn coins when viewers watch</p>
          <button onClick={() => setModal(true)} className="h-9 px-5 bg-gold rounded-xl text-sm font-bold text-ink">Upload First Reel</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {reels.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden group">
              <div className="relative aspect-[9/16] bg-gray-100 overflow-hidden">
                {r.video_url
                  ? <img src={r.video_url} alt={r.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Video size={32} className="text-gray-300" /></div>}
                <div className="absolute top-2 left-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.content_type === "sponsored" ? "bg-gold text-ink" : "bg-white/80 text-ink"}`}>
                    {r.content_type === "sponsored" ? "Sponsored" : "Organic"}
                  </span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-xs font-semibold line-clamp-2">{r.title}</p>
                  <p className="text-white/60 text-[10px] mt-0.5">{r.views_count} views</p>
                </div>
              </div>
              <div className="p-2 flex gap-1">
                <div className="flex-1 flex items-center gap-1 text-[10px] text-ink-muted px-2">
                  <Eye size={10} /> {r.views_count}
                </div>
                <button onClick={() => handleDelete(r.id)} title="Delete reel" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && <ReelModal products={products} onClose={() => setModal(false)} onSave={(r) => setReels((rs) => [r, ...rs])} />}
      </AnimatePresence>
    </div>
  );
}
