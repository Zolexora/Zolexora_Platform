"use client";
import { useState, useEffect } from "react";
import { shippingApi } from "@/lib/shipping-api";
import { AlertTriangle, CheckCircle, RefreshCw, Search, XCircle, Eye, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const STATUS_COLOR: Record<string,string> = {
  pending:"bg-gray-100 text-gray-600", booked:"bg-green-50 text-green-700",
  in_transit:"bg-blue-50 text-blue-700", out_for_delivery:"bg-purple-50 text-purple-700",
  delivered:"bg-green-100 text-green-800", cancelled:"bg-gray-100 text-gray-500",
  booking_failed:"bg-red-50 text-red-700", shipping_attention_required:"bg-red-100 text-red-800",
};

function DetailDrawer({ shipmentId, onClose }: { shipmentId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => { shippingApi.getShipment(shipmentId).then(setData).finally(() => setLoading(false)); }, [shipmentId]);

  const handleSync = async () => {
    setSyncing(true);
    try { await shippingApi.syncTracking(shipmentId); const u = await shippingApi.getShipment(shipmentId); setData(u); toast.success("Synced"); }
    catch { toast.error("Failed"); } finally { setSyncing(false); }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const r = await shippingApi.retryBooking(shipmentId);
      const u = await shippingApi.getShipment(shipmentId); setData(u);
      toast.success(r.status === "booked" ? `Booked! AWB: ${r.shipment?.awb}` : "All couriers failed again");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed"); } finally { setRetrying(false); }
  };

  const s = data?.shipment; const options = data?.options||[]; const attempts = data?.booking_attempts||[]; const events = data?.tracking_events||[];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:30,stiffness:300}}
        className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Shipment Detail</h2>
            {s && <p className="text-xs text-ink-muted">Order #{s.order_id?.slice(0,8).toUpperCase()} · AWB: {s.awb || "—"}</p>}
          </div>
          <div className="flex items-center gap-2">
            {s?.awb && <button onClick={handleSync} disabled={syncing} className="h-8 px-3 border border-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50"><RefreshCw size={12} className={syncing?"animate-spin":""}/> Sync</button>}
            {s?.shipping_attention_required && <button onClick={handleRetry} disabled={retrying} className="h-8 px-3 bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-amber-600 disabled:opacity-50"><Zap size={12}/>{retrying?"Retrying...":"Retry Auto-book"}</button>}
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><XCircle size={16} className="text-gray-400"/></button>
          </div>
        </div>
        {loading ? <div className="p-5 space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 shimmer rounded-xl"/>)}</div> : !s ? <div className="p-8 text-center text-gray-400">Not found</div> : (
          <div className="p-5 space-y-5">
            {s.shipping_attention_required && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <AlertTriangle size={17} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <div><p className="font-bold text-sm text-red-900">Attention Required</p><p className="text-xs text-red-700 mt-0.5">{s.failure_reason||"No valid courier found"}</p></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {[["Status",s.current_status?.replace(/_/g," ")],["Provider",s.selected_provider||"—"],["Courier",s.selected_courier_name||"—"],["AWB",s.awb||"—"],["Cost",s.shipping_cost?`₹${s.shipping_cost.toFixed(0)}`:"—"],["ETA",s.estimated_delivery_days?`${s.estimated_delivery_days} days`:"—"],["Auto-booked",s.is_auto_booked?"Yes":"No"],["Pickup PIN",s.pickup_pincode||"—"]].map(([k,v])=>(
                <div key={k} className="bg-surface rounded-xl p-3"><p className="text-[10px] font-semibold text-ink-muted uppercase">{k}</p><p className="text-sm font-bold text-ink mt-0.5 capitalize">{v}</p></div>
              ))}
            </div>
            {options.length>0&&(
              <div>
                <p className="text-xs font-bold text-ink-muted uppercase mb-2">Courier Options ({options.length})</p>
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs"><thead className="bg-surface border-b border-gray-50"><tr>{["Provider","Cost","Days","Valid","Reason"].map(h=><th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-ink-muted">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-50">{options.map((o:any)=>(
                      <tr key={o.id} className={o.ranking_position===1&&!o.rejected_reason?"bg-green-50/50":""}>
                        <td className="px-3 py-2 font-semibold text-ink">{o.courier_name}</td>
                        <td className="px-3 py-2 font-bold">₹{o.estimated_cost?.toFixed(0)||"—"}</td>
                        <td className="px-3 py-2">{o.estimated_delivery_days||"—"}d</td>
                        <td className="px-3 py-2">{!o.rejected_reason?<CheckCircle size={12} className="text-green-500"/>:<XCircle size={12} className="text-red-400"/>}</td>
                        <td className="px-3 py-2 text-red-500 text-[10px]">{o.rejected_reason?.replace(/_/g," ")||"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {attempts.length>0&&(
              <div><p className="text-xs font-bold text-ink-muted uppercase mb-2">Booking Attempts ({attempts.length})</p>
                <div className="space-y-2">{attempts.map((a:any)=>(
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${a.success?"bg-green-50 border-green-100":"bg-red-50 border-red-100"}`}>
                    {a.success?<CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0"/>:<XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>}
                    <div><p className="text-xs font-bold text-ink">{a.provider} — Attempt #{a.attempt_number}</p>
                      {a.error_message&&<p className="text-[11px] text-red-600 mt-0.5">{a.error_message}</p>}
                      <p className="text-[10px] text-ink-muted mt-0.5">{new Date(a.created_at).toLocaleString("en-IN")}</p></div>
                  </div>
                ))}</div>
              </div>
            )}
            {events.length>0&&(
              <div><p className="text-xs font-bold text-ink-muted uppercase mb-2">Tracking Events ({events.length})</p>
                <div className="space-y-2">{events.map((ev:any,i:number)=>(
                  <div key={ev.id} className="flex gap-3 p-3 bg-surface rounded-xl">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${i===0?"bg-gold":"bg-gray-300"}`}/>
                    <div><p className="text-xs font-semibold text-ink">{ev.status}</p>
                      {ev.location&&<p className="text-[11px] text-ink-muted">{ev.location}</p>}
                      <p className="text-[10px] text-gray-400">{ev.event_time?new Date(ev.event_time).toLocaleString("en-IN"):""}</p></div>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function AdminShippingPage() {
  const [stats, setStats] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<"all"|"attention">("all");
  const [selectedId, setSelectedId] = useState<string|null>(null);

  useEffect(() => { Promise.all([shippingApi.stats(), shippingApi.all()]).then(([s,a])=>{setStats(s);setShipments(a);}).finally(()=>setLoading(false)); }, []);

  const handleTab = async (t: "all"|"attention") => {
    setTab(t); setLoading(true);
    try { setShipments(t==="attention" ? await shippingApi.attentionRequired() : await shippingApi.all()); }
    finally { setLoading(false); }
  };

  const filtered = shipments.filter(s => {
    const ms = statusFilter==="all"||s.current_status===statusFilter;
    const mq = !search||s.awb?.includes(search)||s.order_id?.includes(search)||s.selected_courier_name?.toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  });

  const statCards = stats ? [
    {l:"Total",v:stats.total,c:"text-ink bg-white",b:"border-gray-100"},
    {l:"Booked",v:stats.booked,c:"text-green-700 bg-green-50",b:"border-green-100"},
    {l:"In Transit",v:stats.in_transit,c:"text-blue-700 bg-blue-50",b:"border-blue-100"},
    {l:"Delivered",v:stats.delivered,c:"text-green-800 bg-green-100",b:"border-green-200"},
    {l:"Needs Action",v:stats.attention_required,c:"text-red-700 bg-red-50",b:"border-red-200"},
    {l:"Cancelled",v:stats.cancelled,c:"text-gray-600 bg-gray-50",b:"border-gray-100"},
  ] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div><h1 className="font-display text-2xl font-bold text-ink">Shipping Oversight</h1>
        <p className="text-ink-muted text-sm mt-0.5">Monitor all shipments, courier decisions, failures and tracking across the platform</p></div>

      {!loading&&stats&&(
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {statCards.map((c,i)=>(
            <motion.div key={c.l} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
              className={`rounded-2xl border p-4 ${c.c} ${c.b}`}>
              <p className="font-display text-2xl font-bold">{c.v}</p><p className="text-[11px] font-semibold mt-1 opacity-70">{c.l}</p>
            </motion.div>
          ))}
        </div>
      )}

      {stats?.attention_required>0&&(
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl">
          <div className="flex items-center gap-3"><AlertTriangle size={18} className="text-red-500"/>
            <div><p className="font-bold text-sm text-red-900">{stats.attention_required} shipment{stats.attention_required!==1?"s":""} need manual intervention</p>
              <p className="text-xs text-red-700">Auto-booking failed — all couriers returned errors or no serviceability</p></div></div>
          <button onClick={()=>handleTab("attention")} className="h-9 px-4 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700">Review</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(["all","attention"] as const).map(t=>(
            <button key={t} onClick={()=>handleTab(t)} className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${tab===t?"bg-white text-ink shadow-sm":"text-ink-muted"}`}>
              {t==="attention"?"⚠️ Needs Action":"All Shipments"}
            </button>
          ))}
        </div>
        <div className="relative"><Search size={13} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="AWB, order, courier..."
            className="h-9 pl-8 pr-3 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:border-gold w-56"/></div>
        <span className="text-xs text-ink-muted ml-auto">{filtered.length} shipments</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-gray-100">
              <tr>{["Order","AWB","Courier","Cost","Days","Status","Auto","Date",""].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-muted whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({length:8}).map((_,i)=>(
                <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-8 shimmer rounded-lg"/></td></tr>
              )) : filtered.length===0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-ink-muted">{tab==="attention"?"No attention required 🎉":"No shipments found"}</td></tr>
              ) : filtered.map((s,i)=>(
                <motion.tr key={s.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}} className="hover:bg-surface/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">#{s.order_id?.slice(0,8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-ink">{s.awb||"—"}</td>
                  <td className="px-4 py-3 text-xs font-medium text-ink">{s.selected_courier_name||"—"}</td>
                  <td className="px-4 py-3 font-bold text-xs">{s.shipping_cost?`₹${s.shipping_cost.toFixed(0)}`:"—"}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{s.estimated_delivery_days?`${s.estimated_delivery_days}d`:"—"}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${STATUS_COLOR[s.current_status]||"bg-gray-100 text-gray-600"}`}>{s.current_status?.replace(/_/g," ")}</span></td>
                  <td className="px-4 py-3 text-xs">{s.is_auto_booked?<span className="text-green-600 font-semibold">Auto</span>:<span className="text-gray-400">Manual</span>}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</td>
                  <td className="px-4 py-3">
                    <button onClick={()=>setSelectedId(s.id)} className="h-7 px-3 flex items-center gap-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold text-ink hover:bg-surface">
                      <Eye size={11}/> View
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>{selectedId&&<DetailDrawer shipmentId={selectedId} onClose={()=>setSelectedId(null)}/>}</AnimatePresence>
    </div>
  );
}
