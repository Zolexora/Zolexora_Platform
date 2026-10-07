"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ordersApi } from "@/lib/api";
import { shippingApi } from "@/lib/shipping-api";
import { Truck, Package, CheckCircle, Clock, AlertTriangle, RefreshCw, X, ChevronLeft, Loader2, MapPin, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const STATUS_STEPS = ["processing", "shipped", "delivered"];

function ShipmentPanel({ order, onRefresh }: { order: any; onRefresh: () => void }) {
  const [shipmentData, setShipmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pickupLocations, setPickupLocations] = useState<any[]>([]);
  const [selectedPickup, setSelectedPickup] = useState("");
  const [pkg, setPkg] = useState({ weight_kg: 0.5, length_cm: 15, breadth_cm: 12, height_cm: 8 });
  const [showOverride, setShowOverride] = useState(false);
  const [manualForm, setManualForm] = useState({ provider: "", service_code: "", courier_name: "" });

  useEffect(() => {
    Promise.all([
      shippingApi.getOptions(order.id).then(setShipmentData).catch(() => {}),
      shippingApi.getPickupLocations().then((locs: any) => {
        setPickupLocations(locs);
        const def = locs.find((l: any) => l.is_default);
        if (def) setSelectedPickup(def.id);
      }),
    ]).finally(() => setLoading(false));
  }, [order.id]);

  const handleReadyToShip = async () => {
    setShipping(true);
    try {
      const result = await shippingApi.readyToShip(order.id, {
        pickup_location_id: selectedPickup || undefined,
        ...pkg,
      });
      toast.success(result.status === "booked"
        ? `Booked via ${result.shipment?.selected_courier_name}! AWB: ${result.shipment?.awb}`
        : "No valid courier found. Manual intervention required.");
      const updated = await shippingApi.getOptions(order.id);
      setShipmentData(updated);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Shipping failed"); }
    finally { setShipping(false); }
  };

  const handleSync = async () => {
    if (!shipmentData?.shipment?.id) return;
    setSyncing(true);
    try {
      await shippingApi.syncTracking(shipmentData.shipment.id);
      const updated = await shippingApi.getOptions(order.id);
      setShipmentData(updated);
      toast.success("Tracking synced");
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  };

  const handleManualBook = async () => {
    if (!manualForm.provider || !manualForm.service_code) { toast.error("Fill all fields"); return; }
    try {
      const result = await shippingApi.manualBook(order.id, manualForm);
      toast.success("Manual booking successful!");
      const updated = await shippingApi.getOptions(order.id);
      setShipmentData(updated);
      setShowOverride(false);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const shipment = shipmentData?.shipment;
  const options = shipmentData?.options || [];
  const validOptions = options.filter((o: any) => !o.rejected_reason).sort((a: any, b: any) => (a.ranking_position || 99) - (b.ranking_position || 99));
  const rejectedOptions = options.filter((o: any) => o.rejected_reason);
  const isBooked = shipment?.awb;
  const needsAttention = shipment?.shipping_attention_required;

  if (loading) return <div className="h-40 shimmer rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* Booking status */}
      {isBooked ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm text-green-900">Shipment Booked</p>
                <p className="text-xs text-green-700 mt-0.5">via {shipment.selected_courier_name}</p>
              </div>
            </div>
            <button onClick={handleSync} disabled={syncing} className="h-8 px-3 bg-white border border-green-200 rounded-lg text-xs font-semibold text-green-700 flex items-center gap-1.5 hover:bg-green-50">
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> Sync
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "AWB", value: shipment.awb },
              { label: "Cost", value: `₹${shipment.shipping_cost?.toFixed(0)}` },
              { label: "ETA", value: `${shipment.estimated_delivery_days} days` },
              { label: "Status", value: shipment.current_status?.replace(/_/g, " ") },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl p-3 border border-green-100">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
                <p className="text-sm font-bold text-ink mt-0.5 capitalize">{value}</p>
              </div>
            ))}
          </div>
          {shipment.tracking_url && (
            <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-green-700 hover:underline">
              <Truck size={12} /> Track shipment →
            </a>
          )}
        </div>
      ) : needsAttention ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-500" />
            <div>
              <p className="font-bold text-sm text-red-900">No valid courier found</p>
              <p className="text-xs text-red-700 mt-0.5">{shipment?.failure_reason || "All providers failed or were not serviceable"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleReadyToShip} disabled={shipping}
              className="h-8 px-4 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
              {shipping ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Retry Auto-book
            </button>
            <button onClick={() => setShowOverride(true)} className="h-8 px-4 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50">
              Manual Override
            </button>
          </div>
        </div>
      ) : (
        // Ready to ship form
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Truck size={17} className="text-ink-muted" />
            <h3 className="font-bold text-sm text-ink">Ship This Order</h3>
          </div>

          {/* Pickup location */}
          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">Pickup Location</label>
            {pickupLocations.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className="text-xs text-amber-800">
                  No pickup locations. <a href="/shipping" className="font-bold underline">Add one first →</a>
                </p>
              </div>
            ) : (
              <select value={selectedPickup} onChange={e => setSelectedPickup(e.target.value)} title="Select a pickup location"
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white">
                {pickupLocations.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.label} — {l.city} ({l.pincode}){l.is_default ? " ★" : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Package dimensions */}
          <div>
            <label className="text-xs font-semibold text-ink-muted mb-1.5 block">Package Details</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: "weight_kg", label: "Weight (kg)" },
                { k: "length_cm", label: "Length (cm)" },
                { k: "breadth_cm", label: "Breadth (cm)" },
                { k: "height_cm", label: "Height (cm)" },
              ].map(({ k, label }) => (
                <div key={k}>
                  <label className="text-[10px] text-gray-400 mb-1 block">{label}</label>
                  <input type="number" step="0.1" value={(pkg as any)[k]} title={label}
                    onChange={e => setPkg(p => ({ ...p, [k]: parseFloat(e.target.value) }))}
                    className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:border-gold" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleReadyToShip} disabled={shipping || pickupLocations.length === 0}
            className="w-full h-11 bg-ink hover:bg-ink-soft text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {shipping ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {shipping ? "Finding best courier & booking..." : "Mark Ready to Ship — Auto-book"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">System will compare all 7 couriers and auto-book the cheapest valid option (≤6 days)</p>
        </div>
      )}

      {/* Courier options table */}
      {validOptions.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-sm text-ink">Courier Options Evaluated</h3>
            <button onClick={() => setShowOverride(true)} className="text-xs font-semibold text-gold hover:underline">Manual override</button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-surface"><tr>
              {["#","Courier","Cost","Days","COD","Status"].map(h => (
                <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-ink-muted">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {validOptions.map((o: any, i: number) => (
                <tr key={o.id} className={i === 0 && isBooked && shipment?.selected_provider === o.provider ? "bg-green-50/50" : ""}>
                  <td className="px-4 py-2.5 text-ink-muted font-mono">{o.ranking_position || i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-ink">{o.courier_name}</td>
                  <td className="px-4 py-2.5 font-bold text-ink">₹{o.estimated_cost?.toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-ink">{o.estimated_delivery_days}d</td>
                  <td className="px-4 py-2.5">{o.cod_supported ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5">
                    {isBooked && shipment?.selected_provider === o.provider && shipment?.selected_service_code === o.service_code
                      ? <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Selected</span>
                      : <span className="text-[10px] text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectedOptions.length > 0 && (
        <details className="bg-gray-50 rounded-xl px-4 py-3">
          <summary className="text-xs font-semibold text-ink-muted cursor-pointer">{rejectedOptions.length} rejected options</summary>
          <div className="mt-2 space-y-1">
            {rejectedOptions.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">{o.courier_name}</span>
                <span className="text-red-500">{o.rejected_reason?.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Manual override modal */}
      <AnimatePresence>
        {showOverride && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-ink">Manual Courier Override</h3>
                <button onClick={() => setShowOverride(false)} title="Close modal"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-ink-muted mb-1 block">Provider</label>
                  <select value={manualForm.provider} onChange={e => setManualForm(f => ({ ...f, provider: e.target.value }))} title="Select a provider"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white">
                    <option value="">Select provider</option>
                    {["delhivery","nimbuspost","shiprocket","dtdc","bluedart","indiapost","pickrr"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-muted mb-1 block">Courier Name</label>
                  <input value={manualForm.courier_name} onChange={e => setManualForm(f => ({ ...f, courier_name: e.target.value }))}
                    placeholder="e.g. Delhivery Express" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-muted mb-1 block">Service Code</label>
                  <input value={manualForm.service_code} onChange={e => setManualForm(f => ({ ...f, service_code: e.target.value }))}
                    placeholder="e.g. delhivery_express" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowOverride(false)} className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
                  <button onClick={handleManualBook} className="flex-1 h-10 bg-ink text-white rounded-xl text-sm font-bold hover:bg-ink-soft">Book Manually</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    // Fetch single order from seller orders
    ordersApi.seller().then((orders: any) => {
      const o = orders.find((x: any) => x.id === id);
      if (o) setOrder(o);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="max-w-3xl mx-auto space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>;
  if (!order) return <div className="text-center py-20 text-ink-muted">Order not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> Back to Orders
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
        <p className="text-ink-muted text-sm">{order.buyer_name} · {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
      </div>

      {/* Order items */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="font-bold text-sm text-ink mb-4">Items</h2>
        <div className="space-y-3">
          {order.items?.map((item: any) => (
            <div key={item.product_id} className="flex items-center gap-3">
              {item.image && <img src={item.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-50" />}
              <div className="flex-1">
                <p className="font-medium text-sm text-ink">{item.product_title}</p>
                <p className="text-xs text-ink-muted">Qty {item.quantity} × ₹{item.price?.toLocaleString("en-IN")}</p>
              </div>
              <p className="font-bold text-sm">₹{(item.price * item.quantity)?.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-50 mt-4 pt-4 flex justify-between">
          <span className="font-bold text-sm text-ink">Total paid</span>
          <span className="font-bold text-sm text-ink">₹{order.total_paid?.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Shipping panel */}
      <div>
        <h2 className="font-display text-base font-bold text-ink mb-4 flex items-center gap-2">
          <Truck size={17} /> Shipping
        </h2>
        <ShipmentPanel order={order} onRefresh={load} />
      </div>
    </div>
  );
}
