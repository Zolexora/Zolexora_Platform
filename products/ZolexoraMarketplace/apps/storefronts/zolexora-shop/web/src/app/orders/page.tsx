"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { ordersApi, cartApi, type Order, type OrderItem } from "@/lib/api";
import {
  Package, Truck, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, AlertTriangle, QrCode, Loader2,
  LucideIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import toast from "react-hot-toast";

const STATUS_CFG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  pending:    { label: "Pending",    color: "text-amber-600 bg-amber-50",   icon: Clock },
  processing: { label: "Processing", color: "text-blue-600 bg-blue-50",     icon: Package },
  shipped:    { label: "Shipped",    color: "text-purple-600 bg-purple-50", icon: Truck },
  delivered:  { label: "Delivered",  color: "text-green-600 bg-green-50",   icon: CheckCircle },
  cancelled:  { label: "Cancelled",  color: "text-red-500 bg-red-50",       icon: XCircle },
};

const PAY_CFG: Record<string, { label: string; color: string }> = {
  paid:                   { label: "Paid ✓",              color: "text-green-700 bg-green-50" },
  awaiting_verification:  { label: "⏳ Verifying payment", color: "text-amber-700 bg-amber-50" },
  pending:                { label: "Payment pending",      color: "text-gray-600 bg-gray-100" },
  failed:                 { label: "Payment failed",       color: "text-red-600 bg-red-50" },
};

/* Inline UTR submission for pending UPI orders */
function UpiSubmitInline({ orderId, onDone }: { orderId:string; onDone:()=>void }) {
  const [utr, setUtr]   = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!utr.trim() || utr.trim().length < 6) { toast.error("Enter a valid UTR / Transaction Reference"); return; }
    setBusy(true);
    try {
      await cartApi.upiPaid(orderId, utr.trim());
      toast.success("Payment submitted! Pending verification.");
      onDone();
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Failed to submit");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
        <QrCode size={13}/> Submit UPI Transaction Reference
      </p>
      <p className="text-[11px] text-amber-700">
        Already paid via UPI? Enter your UTR / Transaction Reference Number to confirm.
      </p>
      <div className="flex gap-2">
        <input value={utr} onChange={e=>setUtr(e.target.value)}
          placeholder="12-digit UTR (e.g. 415123456789)"
          className="flex-1 h-9 px-3 rounded-lg border border-amber-300 text-xs font-mono bg-white focus:outline-none focus:border-gold"/>
        <button onClick={submit} disabled={busy||!utr.trim()}
          className="h-9 px-4 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
          {busy ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12}/>}
          Submit
        </button>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router  = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);

  const load = useCallback(() => {
    ordersApi.my().then(setOrders).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    load();
  }, [user, router, load]);

  const pendingVerify = orders.filter(o => o.payment_status === "awaiting_verification").length;

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-28 shimmer rounded-2xl"/>)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-6">My Orders</h1>

      {/* Pending UPI verification notice */}
      {pendingVerify > 0 && (
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-700"/>
          </div>
          <div>
            <p className="font-bold text-amber-900 text-sm">
              {pendingVerify} order{pendingVerify>1?"s":""} awaiting payment verification
            </p>
            <p className="text-amber-700 text-xs">
              We&apos;re verifying your UPI payment — usually confirmed within a few hours.
            </p>
          </div>
        </motion.div>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package size={48} className="text-gray-200 mb-4"/>
          <h2 className="font-semibold text-lg text-gray-500">No orders yet</h2>
          <p className="text-sm text-gray-400 mt-1 mb-6">Your orders will appear here</p>
          <Link href="/store" className="h-11 px-6 bg-gold rounded-xl flex items-center font-semibold text-sm text-ink">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const orderId = order.id || (order as any)._id || order.order_number || "ORDER";
            const orderDisplayId = order.order_number || (order.id ? `#${order.id.slice(0, 8).toUpperCase()}` : "#ORDER");
            const st  = STATUS_CFG[order.status]  || STATUS_CFG.pending;
            const pay = PAY_CFG[order.payment_status] || PAY_CFG.pending;
            const Icon = st.icon;
            const isOpen = expanded === orderId;
            const isUpiPending = order.payment_method === "upi" && order.payment_status === "pending";
            const isUpiVerifying = order.payment_status === "awaiting_verification";
            
            const rawLines: any[] = order.items || (order as any).lines || [];
            const totalPaid = order.total_paid ?? ((order as any).grand_total?.amount_minor ? (order as any).grand_total.amount_minor / 100 : 0);
            const shippingAddr: any = (order as any).shipping_address || (order as any).delivery_address;
            const deliveryName = order.delivery_name || shippingAddr?.name || "";
            const deliveryPhone = order.delivery_phone || shippingAddr?.phone || "";
            const deliveryAddress = order.delivery_address || shippingAddr?.address || "";
            const deliveryCity = order.delivery_city || shippingAddr?.city || "";
            const deliveryState = order.delivery_state || shippingAddr?.state || "";
            const deliveryPincode = order.delivery_pincode || shippingAddr?.pincode || "";

            return (
              <motion.div key={orderId} layout
                className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                  isUpiVerifying ? "border-amber-200" : "border-gray-100"
                }`}>

                {/* Header row */}
                <button onClick={()=>setExpanded(isOpen?null:orderId)}
                  className="w-full flex items-center gap-4 p-4 text-left">

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${st.color.split(" ")[1]}`}>
                    <Icon size={17} className={st.color.split(" ")[0]}/>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-ink">
                        {orderDisplayId}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pay.color}`}>
                        {pay.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rawLines.length} item{rawLines.length!==1?"s":""} ·{" "}
                      ₹{totalPaid.toLocaleString("en-IN")} ·{" "}
                      {new Date(order.created_at || Date.now()).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                    </p>
                    {/* Payment method badge */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        order.payment_method==="upi"     ?"bg-green-50 text-green-700":
                        order.payment_method==="razorpay"?"bg-blue-50 text-blue-700"  :
                                                           "bg-amber-50 text-amber-700"}`}>
                        {order.payment_method}
                      </span>
                      {isUpiVerifying && (
                        <span className="text-[9px] text-amber-600 font-semibold animate-pulse">
                          UTR: {order.upi_transaction_ref}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
                  <Link href={`/orders/${orderId}`} onClick={e=>e.stopPropagation()}
                    className="ml-1 text-xs font-semibold text-gold hover:underline flex-shrink-0">
                    Details
                  </Link>
                </button>

                {/* Expanded section */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
                      exit={{height:0,opacity:0}} transition={{duration:0.25}} className="overflow-hidden">
                      <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">

                        {/* Items */}
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
                                <div className="w-12 h-12 relative flex-shrink-0">
                                  <Image src={itemImg} alt="" fill sizes="48px" className="rounded-xl object-cover bg-gray-50"/>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-ink line-clamp-1">{itemTitle}</p>
                                <p className="text-xs text-gray-400">Qty {itemQty} × ₹{itemUnit.toLocaleString("en-IN")}</p>
                              </div>
                              <p className="text-sm font-bold text-ink">₹{itemSubtotal.toLocaleString("en-IN")}</p>
                            </div>
                          );
                        })}

                        {/* Delivery address */}
                        {(deliveryAddress || deliveryName) && (
                          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                            <p className="font-semibold text-ink text-xs mb-1">Delivery to</p>
                            <p>{deliveryName} {deliveryPhone ? `· ${deliveryPhone}` : ""}</p>
                            <p>{[deliveryAddress, deliveryCity, deliveryState, deliveryPincode].filter(Boolean).join(", ")}</p>
                          </div>
                        )}

                        {/* Summary */}
                        <div className="border-t border-gray-50 pt-3 space-y-1.5">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Subtotal</span><span>₹{(order.subtotal || totalPaid).toLocaleString("en-IN")}</span>
                          </div>
                          {(order.coins_discount || 0) > 0 && (
                            <div className="flex justify-between text-xs text-green-600">
                              <span>Coin discount ({order.coins_used} coins)</span>
                              <span>- ₹{order.coins_discount}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold text-ink">
                            <span>Total Paid</span><span>₹{totalPaid.toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        {/* UPI awaiting verification info */}
                        {isUpiVerifying && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                            <p className="font-semibold mb-1">⏳ Payment under verification</p>
                            <p>Your UTR <code className="font-mono bg-amber-100 px-1 rounded">{order.upi_transaction_ref}</code> has been submitted. We&apos;ll confirm within a few hours.</p>
                          </div>
                        )}

                        {/* UPI pending — customer hasn't submitted UTR yet */}
                        {isUpiPending && (
                          <UpiSubmitInline orderId={orderId} onDone={load}/>
                        )}

                        {/* Admin note if any */}
                        {order.admin_note && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
                            <p className="font-semibold mb-0.5">Note from us:</p>
                            <p>{order.admin_note}</p>
                          </div>
                        )}

                        {/* Progress bar */}
                        {order.status !== "cancelled" && (
                          <>
                            <div className="flex items-center gap-1.5 pt-1">
                              {["pending","processing","shipped","delivered"].map((s,i,arr) => {
                                const idx = arr.indexOf(order.status);
                                const done = i <= idx;
                                return (
                                  <div key={s} className="flex items-center flex-1">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done?"border-green-500 bg-green-500":"border-gray-200 bg-white"}`}>
                                      {done && <CheckCircle size={10} className="text-white"/>}
                                    </div>
                                    {i < arr.length-1 && (
                                      <div className={`flex-1 h-0.5 ${done&&i<idx?"bg-green-500":"bg-gray-100"}`}/>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                              {["Placed","Processing","Shipped","Delivered"].map(l=><span key={l}>{l}</span>)}
                            </div>
                          </>
                        )}

                        <Link href={`/track?order=${order.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline mt-1">
                          <Truck size={12}/> Track Shipment →
                        </Link>
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
