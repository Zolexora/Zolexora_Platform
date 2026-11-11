"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { shippingApi } from "@/lib/shipping-api";
import { ordersApi, type Order } from "@/lib/api";
import { useAuthStore } from "@/store";
import {
  Truck, Package, CheckCircle, Clock, MapPin,
  RefreshCw, AlertTriangle, ArrowLeft, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const STATUS_STEPS = [
  { key: "processing",       label: "Order Placed",       icon: Package },
  { key: "booked",           label: "Shipment Booked",    icon: Truck },
  { key: "pickup_requested", label: "Picked Up",          icon: Package },
  { key: "in_transit",       label: "In Transit",         icon: Truck },
  { key: "out_for_delivery", label: "Out for Delivery",   icon: Truck },
  { key: "delivered",        label: "Delivered",          icon: CheckCircle },
];

function stepIndex(status: string): number {
  const map: Record<string, number> = {
    pending: 0, processing: 0, booked: 1,
    pickup_requested: 2, in_transit: 3,
    out_for_delivery: 4, delivered: 5,
  };
  return map[status] ?? 0;
}

interface TrackingEvent {
  status?: string;
  description?: string;
  location?: string;
  time?: string;
}

interface Shipment {
  id?: string;
  awb?: string;
  current_status?: string;
  selected_courier_name?: string;
  estimated_delivery_days?: number;
  shipping_cost?: number;
  tracking_url?: string;
}

interface ShipmentData {
  shipment?: Shipment;
  tracking_events?: TrackingEvent[];
}

interface TrackingData {
  awb?: string;
  current_status?: string;
  events?: TrackingEvent[];
}

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (!events.length) return (
    <p className="text-sm text-gray-400 text-center py-6">No tracking events yet. Updates appear here once the shipment is picked up.</p>
  );
  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${i === 0 ? "bg-gold ring-4 ring-gold/20" : "bg-gray-200"}`} />
            {i < events.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
          </div>
          <div className="pb-5 min-w-0">
            <p className={`text-sm font-semibold ${i === 0 ? "text-ink" : "text-gray-500"}`}>
              {ev.status || ev.description || "Update"}
            </p>
            {ev.location && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={10} />{ev.location}</p>}
            {ev.time && <p className="text-xs text-gray-400 mt-0.5">{new Date(ev.time).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipmentProgress({ status }: { status: string }) {
  const currentStep = stepIndex(status);
  if (status === "cancelled") return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
      <AlertTriangle size={18} className="text-red-500" />
      <div>
        <p className="font-bold text-sm text-red-800">Shipment Cancelled</p>
        <p className="text-xs text-red-600 mt-0.5">Please contact seller for assistance.</p>
      </div>
    </div>
  );
  return (
    <div className="py-4">
      {/* Mobile: vertical */}
      <div className="sm:hidden space-y-3">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentStep;
          const active = i === currentStep;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${done ? (active ? "bg-gold" : "bg-green-500") : "bg-gray-100"}`}>
                <step.icon size={14} className={done ? "text-white" : "text-gray-400"} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${done ? (active ? "text-ink" : "text-gray-700") : "text-gray-400"}`}>
                  {step.label}
                </p>
              </div>
              {active && <span className="text-[10px] font-bold bg-gold/10 text-amber-800 px-2 py-0.5 rounded-full">Current</span>}
            </div>
          );
        })}
      </div>

      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-start gap-0">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentStep;
          const active = i === currentStep;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10
                  ${done ? (active ? "bg-gold ring-4 ring-gold/20" : "bg-green-500") : "bg-gray-100"}`}>
                  {done && !active
                    ? <CheckCircle size={14} className="text-white" />
                    : <step.icon size={14} className={done ? "text-white" : "text-gray-400"} />}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 ${i < currentStep ? "bg-green-500" : "bg-gray-100"}`} />
                )}
              </div>
              <p className={`text-[11px] font-semibold text-center mt-2 px-1 ${done ? (active ? "text-gold-dark" : "text-gray-700") : "text-gray-400"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const orderId = searchParams.get("order");
  const awbParam = searchParams.get("awb");

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState(orderId || "");
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [awbInput, setAwbInput] = useState(awbParam || "");

  useEffect(() => {
    if (user) {
      ordersApi.my().then(setOrders);
      if (orderId) loadShipmentForOrder(orderId);
    }
  }, [user, orderId]);

  const loadShipmentForOrder = async (oid: string) => {
    setLoading(true);
    setShipmentData(null); setTrackingData(null);
    try {
      const data = await shippingApi.getOrderShipment(oid);
      setShipmentData(data);
      if (data.shipment?.awb) {
        const tracking = await shippingApi.trackByAwb(data.shipment.awb);
        setTrackingData(tracking);
      }
    } catch { /* no shipment yet */ }
    finally { setLoading(false); }
  };

  const handleTrackAwb = async () => {
    if (!awbInput.trim()) return;
    setLoading(true);
    setShipmentData(null); setTrackingData(null);
    try {
      const tracking = await shippingApi.trackByAwb(awbInput.trim());
      setTrackingData(tracking);
    } catch { /* not found */ }
    finally { setLoading(false); }
  };

  const shipment = shipmentData?.shipment;
  const status = shipment?.current_status || "pending";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-ink mb-6 transition-colors">
        <ArrowLeft size={15} /> My Orders
      </Link>

      <h1 className="font-display text-2xl font-bold text-ink mb-6">Track Shipment</h1>

      {/* If not logged in — AWB-only lookup */}
      {!user ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-4">Enter your AWB number to track your shipment</p>
          <div className="flex gap-2">
            <input value={awbInput} onChange={e => setAwbInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTrackAwb()}
              placeholder="Enter AWB / tracking number"
              className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-gray-50" />
            <button onClick={handleTrackAwb} disabled={loading || !awbInput.trim()}
              className="h-11 px-5 bg-gold hover:bg-gold-dark rounded-xl font-bold text-sm text-ink disabled:opacity-50">
              {loading ? "..." : "Track"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Order selector */}
          {orders.length > 0 && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Select Order</label>
              <select value={selectedOrderId}
                onChange={e => { setSelectedOrderId(e.target.value); loadShipmentForOrder(e.target.value); }}
                title="Select an order to track"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white">
                <option value="">— Choose an order —</option>
                {orders.map(o => {
                  const oId = o.id || (o as any)._id || o.order_number || "";
                  const oDisplay = o.order_number || (oId ? `#${oId.slice(0, 8).toUpperCase()}` : "#ORDER");
                  const totalPaid = o.total_paid ?? ((o as any).grand_total?.amount_minor ? (o as any).grand_total.amount_minor / 100 : 0);
                  const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN") : "";
                  return (
                    <option key={oId} value={oId}>
                      Order {oDisplay} {totalPaid ? `· ₹${totalPaid.toLocaleString("en-IN")}` : ""} {dateStr ? `· ${dateStr}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* AWB manual lookup */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Or track by AWB number</label>
            <div className="flex gap-2">
              <input value={awbInput} onChange={e => setAwbInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleTrackAwb()}
                placeholder="Paste AWB / tracking number"
                className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-gray-50" />
              <button onClick={handleTrackAwb} disabled={loading || !awbInput.trim()}
                className="h-11 px-5 bg-ink hover:bg-ink-soft text-white rounded-xl font-bold text-sm disabled:opacity-40">
                {loading ? "..." : "Track"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 shimmer rounded-2xl" />)}
        </div>
      )}

      {/* No shipment yet */}
      {!loading && selectedOrderId && !shipment && !trackingData && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Clock size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Shipment not dispatched yet</p>
          <p className="text-sm text-gray-400 mt-1">The seller hasn&apos;t shipped your order yet. Check back soon.</p>
        </motion.div>
      )}

      {/* Shipment info card */}
      {!loading && shipment && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Courier</p>
                <p className="font-display text-lg font-bold text-ink mt-0.5">
                  {shipment.selected_courier_name || "Awaiting assignment"}
                </p>
              </div>
              {shipment.awb && (
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">AWB</p>
                  <p className="font-mono font-bold text-sm text-ink mt-0.5">{shipment.awb}</p>
                </div>
              )}
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: "Status",
                  value: status.replace(/_/g, " "),
                  color: status === "delivered" ? "text-green-700 bg-green-50" : status === "shipping_attention_required" ? "text-red-600 bg-red-50" : "text-blue-700 bg-blue-50",
                },
                {
                  label: "Est. Delivery",
                  value: shipment.estimated_delivery_days ? `${shipment.estimated_delivery_days} days` : "—",
                  color: "text-ink bg-cream",
                },
                {
                  label: "Shipping Cost",
                  value: shipment.shipping_cost ? `₹${shipment.shipping_cost.toFixed(0)}` : "—",
                  color: "text-ink bg-cream",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl p-3 ${color.split(" ")[1]}`}>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">{label}</p>
                  <p className={`text-sm font-bold mt-0.5 capitalize ${color.split(" ")[0]}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Progress stepper */}
            <ShipmentProgress status={status} />

            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-gold hover:underline">
                <Zap size={11} /> Track on courier website →
              </a>
            )}
          </div>

          {/* Real-time Tracking events */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-base font-bold text-ink">Tracking Timeline</h2>
              {shipment.id && (
                <button onClick={() => shippingApi.syncShipment(shipment.id!).then(() => { if (selectedOrderId) loadShipmentForOrder(selectedOrderId); })}
                  className="flex items-center gap-1.5 text-xs text-gold font-semibold hover:underline">
                  <RefreshCw size={12} /> Refresh
                </button>
              )}
            </div>
            <TrackingTimeline events={shipmentData?.tracking_events || []} />
          </div>
        </motion.div>
      )}

      {/* AWB-only direct tracking result */}
      {!loading && !selectedOrderId && trackingData && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase">AWB: {trackingData.awb}</p>
            <p className="text-sm font-bold text-ink mt-1 capitalize">Status: {(trackingData.current_status || "In Transit").replace(/_/g, " ")}</p>
            {trackingData.current_status && <ShipmentProgress status={trackingData.current_status} />}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-display text-base font-bold text-ink mb-5">Tracking Updates</h2>
            <TrackingTimeline events={trackingData.events || []} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
