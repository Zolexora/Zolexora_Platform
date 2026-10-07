"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ordersApi, api, type Order, type OrderItem } from "@/lib/api";
import {
  Package, Truck, CheckCircle, Clock, XCircle,
  MapPin, ChevronLeft, RefreshCw, ExternalLink, LucideIcon
} from "lucide-react";
import { motion } from "framer-motion";

const STEP_MAP: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "pending",            label: "Order Placed",      icon: Clock },
  { key: "processing",         label: "Processing",        icon: Package },
  { key: "booked",             label: "Shipment Booked",   icon: Truck },
  { key: "pickup_requested",   label: "Pickup Scheduled",  icon: MapPin },
  { key: "in_transit",         label: "In Transit",        icon: Truck },
  { key: "out_for_delivery",   label: "Out for Delivery",  icon: Truck },
  { key: "delivered",          label: "Delivered",         icon: CheckCircle },
];

interface TrackingEvent {
  status?: string;
  description?: string;
  location?: string;
  time?: string;
  event_time?: string;
}

interface Shipment {
  id: string;
  current_status?: string;
  awb?: string;
  selected_courier_name?: string;
  estimated_delivery_days?: number;
  tracking_url?: string;
}

function TrackingTimeline({ events, currentStatus }: { events: TrackingEvent[]; currentStatus: string }) {
  const activeIdx = STEP_MAP.findIndex(s => s.key === currentStatus);
  return (
    <div className="space-y-0">
      {STEP_MAP.map((step, i) => {
        const done = i <= activeIdx && currentStatus !== "cancelled";
        const active = i === activeIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done ? "bg-ink border-ink" : "bg-white border-gray-200"
              } ${active ? "ring-4 ring-gold/20" : ""}`}>
                <Icon size={15} className={done ? "text-white" : "text-gray-300"} />
              </div>
              {i < STEP_MAP.length - 1 && (
                <div className={`w-0.5 h-8 mt-1 ${i < activeIdx ? "bg-ink" : "bg-gray-100"}`} />
              )}
            </div>
            <div className="pb-8 pt-1.5 flex-1">
              <p className={`text-sm font-semibold ${done ? "text-ink" : "text-gray-400"}`}>{step.label}</p>
              {active && events.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-2 space-y-2">
                  {events.slice(0, 3).map((ev, j) => (
                    <div key={j} className="bg-cream rounded-xl px-3 py-2">
                      <p className="text-xs font-medium text-ink">{ev.status || ev.description}</p>
                      {ev.location && <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={9} />{ev.location}</p>}
                      {ev.time && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(ev.time).toLocaleString("en-IN")}</p>}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const orders = await ordersApi.my();
      const found = orders.find((o: Order) => o.id === id);
      if (!found) return;
      setOrder(found);
      // Try to fetch shipment for this order
      try {
        const opts = await api.get(`/shipping/orders/${id}/options`).then(r => r.data);
        setShipment(opts.shipment);
        // Fetch events if shipment exists
        if (opts.shipment?.id) {
          const full = await api.get(`/shipping/shipments/${opts.shipment.id}`).then(r => r.data);
          setTrackingEvents(full.tracking_events || []);
        }
      } catch { /* no shipment yet */ }
    } catch { router.push("/orders"); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (!shipment?.id) return;
    setSyncing(true);
    try {
      await api.post(`/shipping/sync/${shipment.id}`);
      await load();
    } catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  if (loading) return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 shimmer rounded-2xl" />)}
    </div>
  );

  if (!order) return (
    <div className="text-center py-20 text-gray-400">Order not found</div>
  );

  const effectiveStatus = shipment?.current_status || order.status;
  const isCancelled = effectiveStatus === "cancelled";

  const orderDisplayId = order.order_number || (order.id ? `#${order.id.slice(0, 8).toUpperCase()}` : "#ORDER");
  const rawLines: any[] = order.items || (order as any).lines || [];
  const totalPaid = order.total_paid ?? ((order as any).grand_total?.amount_minor ? (order as any).grand_total.amount_minor / 100 : 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-ink mb-6">
        <ChevronLeft size={16} /> Back to Orders
      </button>

      {/* Order header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Order</p>
            <p className="font-display text-xl font-bold text-ink mt-0.5">{orderDisplayId}</p>
            <p className="text-xs text-gray-500 mt-1">
              Placed {new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {shipment?.awb && (
            <div className="text-right">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">AWB</p>
              <p className="font-mono font-bold text-sm text-ink mt-0.5">{shipment.awb}</p>
              <p className="text-xs text-gray-500 mt-0.5">{shipment.selected_courier_name}</p>
            </div>
          )}
        </div>

        {/* Items summary */}
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
          {rawLines.map((item: any, idx: number) => {
            const itemImg = item.image;
            const itemTitle = item.product_title || item.title || "Product";
            const itemQty = item.quantity || 1;
            const itemUnitMinor = item.price?.amount_minor ?? (item.unit_price?.amount_minor ?? (typeof item.price === "number" ? item.price * 100 : (typeof item.unit_price === "number" ? item.unit_price * 100 : 0)));
            const itemUnit = itemUnitMinor / 100;
            const itemSubtotal = itemUnit * itemQty;

            return (
              <div key={item.product_id || idx} className="flex items-center gap-3">
                {itemImg && (
                  <div className="w-10 h-10 relative flex-shrink-0">
                    <Image src={itemImg} alt="" fill sizes="40px" className="rounded-lg object-cover bg-gray-50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink line-clamp-1">{itemTitle}</p>
                  <p className="text-xs text-gray-400">Qty {itemQty}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs font-bold text-ink">₹{itemSubtotal.toLocaleString("en-IN")}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">Total Paid</span>
          <span className="font-bold text-sm text-ink">₹{totalPaid.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Shipment info bar */}
      {shipment && (
        <div className="bg-ink rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Truck size={18} className="text-gold" />
            <div>
              <p className="text-white text-sm font-bold">{shipment.selected_courier_name || "Shipment booked"}</p>
              <p className="text-white/50 text-xs">Est. delivery: {shipment.estimated_delivery_days} day{shipment.estimated_delivery_days !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer"
                className="h-8 px-3 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1.5 text-white text-xs font-semibold transition-colors">
                <ExternalLink size={12} /> Track
              </a>
            )}
            <button onClick={handleSync} disabled={syncing} title="Sync tracking information"
              className="h-8 w-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
              <RefreshCw size={13} className={`text-white ${syncing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Tracking timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-display text-base font-bold text-ink mb-6">
          {isCancelled ? "Order Cancelled" : "Tracking Status"}
        </h2>
        {isCancelled ? (
          <div className="flex items-center gap-3 text-red-500">
            <XCircle size={20} />
            <p className="font-semibold text-sm">This order has been cancelled</p>
          </div>
        ) : (
          <TrackingTimeline events={trackingEvents} currentStatus={effectiveStatus} />
        )}
      </div>

      {/* All tracking events */}
      {trackingEvents.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-ink mb-4">Full Tracking History</h3>
          <div className="space-y-3">
            {trackingEvents.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-ink">{ev.status || ev.description}</p>
                  {ev.location && <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={9} />{ev.location}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{ev.event_time ? new Date(ev.event_time).toLocaleString("en-IN") : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
