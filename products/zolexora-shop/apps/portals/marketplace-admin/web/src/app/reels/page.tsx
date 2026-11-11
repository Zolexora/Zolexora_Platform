"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { Search, Eye, EyeOff, Trash2, Video, Zap } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function AdminReelsPage() {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => { adminApi.reels().then(setReels).finally(() => setLoading(false)); }, []);

  const filtered = reels.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.creator_name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.content_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleToggle = async (r: any) => {
    try {
      const res = await adminApi.toggleReel(r.id);
      setReels(rs => rs.map(x => x.id === r.id ? { ...x, is_active: res.is_active } : x));
      toast.success(res.is_active ? "Reel restored" : "Reel hidden");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this reel?")) return;
    await adminApi.deleteReel(id);
    setReels(rs => rs.filter(r => r.id !== id));
    toast.success("Reel deleted");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Reels Moderation</h1>
        <p className="text-ink-muted text-sm mt-0.5">{reels.length} total reels · {reels.filter(r=>r.content_type==="sponsored").length} sponsored</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or creator..."
            className="h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gold w-64" />
        </div>
        {["all","organic","sponsored"].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`h-9 px-4 rounded-xl text-xs font-semibold capitalize transition-all ${typeFilter===t ? "bg-ink text-white" : "bg-white border border-gray-200 text-ink-muted"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {loading ? Array.from({length:10}).map((_,i) => (
          <div key={i} className="aspect-[9/16] shimmer rounded-2xl" />
        )) : filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.03 }}
            className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${!r.is_active ? "opacity-60" : ""}`}>
            <div className="relative aspect-[9/16] bg-gray-100">
              {r.video_url
                ? <img src={r.video_url} alt={r.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Video size={24} className="text-gray-300" /></div>}
              <div className="absolute top-2 left-2 flex gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.content_type==="sponsored" ? "bg-gold text-ink" : "bg-black/60 text-white"}`}>
                  {r.content_type==="sponsored" ? "Sponsored" : "Organic"}
                </span>
              </div>
              {!r.is_active && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full">Hidden</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-ink line-clamp-1">{r.title}</p>
              <p className="text-[11px] text-ink-muted mt-0.5">{r.creator_name} · {r.views_count} views</p>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => handleToggle(r)}
                  className={`flex-1 h-7 flex items-center justify-center rounded-lg text-[11px] font-semibold transition-all ${r.is_active ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-green-50 text-green-700"}`}>
                  {r.is_active ? <EyeOff size={11}/> : <Eye size={11}/>}
                </button>
                <button onClick={() => handleDelete(r.id)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                  <Trash2 size={11}/>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
