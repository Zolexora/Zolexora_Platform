"use client";
import { useState, useEffect } from "react";
import { ordersApi } from "@/lib/api";
import { Package, Truck, CheckCircle, XCircle, Clock, ChevronDown, Search, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const STATUSES = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];
const STATUS_CFG: Record<string, { color: string; icon: any }> = {
  pending:    { color: "text-amber-600 bg-amber-50 border-amber-100",  icon: Clock },
  processing: { color: "text-blue-600 bg-blue-50 border-blue-100",     icon: Package },
  shipped:    { color: "text-purple-600 bg-purple-50 border-purple-100",icon: Truck },
  delivered:  { color: "text-green-600 bg-green-50 border-green-100",  icon: CheckCircle },
  cancelled:  { color: "text-red-500 bg-red-50 border-red-100",        icon: XCircle },
};
const NEXT_STATUSES: Record<string, string[]> = {
  pending:    ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered"],
  delivered:  [],
  cancelled:  [],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { ordersApi.seller().then(setOrders).finally(() => setLoading(false)); }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = filter === "all" || o.status === filter;
    const matchSearch = !search || o.buyer_name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      await ordersApi.updateStatus(orderId, status);
      setOrders((os) => os.map((o) => o.id === orderId ? { ...o, status } : o));
      toast.success(`Order marked as ${status}`);
    } catch { toast.error("Failed to update"); }
    finally { setUpdating(null); }
  };

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = s === "all" ? orders.length : orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Orders</h1>
        <p className="text-ink-muted text-sm mt-0.5">{orders.length} total orders</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold capitalize transition-all ${
              filter === s ? "bg-ink text-white" : "bg-white border border-gray-200 text-ink-muted hover:border-gray-400"
            }`}>
            {s} {counts[s] > 0 && <span className="ml-1 opacity-60">({counts[s]})</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer or ID..."
            className="h-8 pl-8 pr-3 rounded-full border border-gray-200 text-xs bg-white focus:outline-none focus:border-gold" />
        </div>
      </div>

      {/* Orders */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package size={36} className="mb-3" /><p className="font-semibold">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const cfg = STATUS_CFG[order.status] || STATUS_CFG.pending;
            const Icon = cfg.icon;
            const exp = expanded === order.id;
            const nextOptions = NEXT_STATUSES[order.status] || [];
            return (
              <motion.div key={order.id} layout className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button onClick={() => setExpanded(exp ? null : order.id)} className="w-full flex items-center gap-4 p-4 text-left">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${cfg.color.split(" ").slice(0,2).join(" ")} ${cfg.color.split(" ")[2]}`}>
                    <Icon size={16} className={cfg.color.split(" ")[0]} />
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="font-mono text-xs text-ink-muted">#{order.id.slice(0,8).toUpperCase()}</p>
                      <p className="font-semibold text-ink truncate">{order.buyer_name}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-ink-muted">Items</p>
                      <p className="font-medium text-ink">{order.items?.length} item{order.items?.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Amount</p>
                      <p className="font-bold text-ink">₹{order.total_paid?.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Date</p>
                      <p className="text-ink">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                  </div>
                  <span className={`hidden sm:block text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.color} capitalize`}>{order.status}</span>
                  <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 transition-transform ${exp ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {exp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <div className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4">
                        {/* Items */}
                        <div className="space-y-2">
                          {order.items?.map((item: any) => (
                            <div key={item.product_id} className="flex items-center gap-3">
                              {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-50" />}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-ink">{item.product_title}</p>
                                <p className="text-xs text-ink-muted">Qty {item.quantity} × ₹{item.price?.toLocaleString("en-IN")}</p>
                              </div>
                              <p className="text-sm font-bold text-ink">₹{(item.price * item.quantity)?.toLocaleString("en-IN")}</p>
                            </div>
                          ))}
                        </div>

                        {/* Payment info */}
                        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3">
                          {[["Payment", order.payment_status], ["Method", order.payment_method], ["Coins used", order.coins_used]].map(([k, v]) => (
                            <div key={k}><p className="text-xs text-ink-muted">{k}</p><p className="text-sm font-semibold capitalize text-ink">{v}</p></div>
                          ))}
                        </div>

                        {/* Update status */}
                        {nextOptions.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-ink-muted self-center">Update to:</span>
                            {nextOptions.map((s) => (
                              <button key={s} onClick={() => handleStatus(order.id, s)} disabled={updating === order.id}
                                className={`h-8 px-4 rounded-lg text-xs font-bold capitalize transition-all disabled:opacity-50 ${
                                  s === "cancelled" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-ink text-white hover:bg-ink-soft"
                                }`}>
                                {updating === order.id ? "..." : s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
