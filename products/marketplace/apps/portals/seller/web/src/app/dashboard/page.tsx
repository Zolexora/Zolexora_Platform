"use client";
import { useState, useEffect } from "react";
import { productsApi, ordersApi, reelsApi, coinsApi } from "@/lib/api";
import { useAuthStore } from "@/store";
import { Package, ShoppingBag, Video, Coins, TrendingUp, ArrowRight, Clock, CheckCircle, Truck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ products: 0, orders: 0, reels: 0, pending: 0, coins: 0, revenue: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([productsApi.my(), ordersApi.seller(), reelsApi.my(), coinsApi.balance()])
      .then(([products, orders, reels, coinData]) => {
        const revenue = orders.filter((o: any) => o.payment_status === "paid" || o.status !== "cancelled").reduce((s: number, o: any) => s + (o.seller_subtotal?.amount_minor / 100 || 0), 0);
        setStats({
          products: products.length,
          orders: orders.length,
          reels: reels.length,
          pending: orders.filter((o: any) => o.status === "pending" || o.status === "processing").length,
          coins: coinData.coin_balance,
          revenue,
        });
        setRecentOrders(orders.slice(0, 5));
      }).finally(() => setLoading(false));
  }, []);

  const STATUS_COLOR: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50", processing: "text-blue-600 bg-blue-50",
    shipped: "text-purple-600 bg-purple-50", delivered: "text-green-600 bg-green-50", cancelled: "text-red-500 bg-red-50",
  };

  const cards = [
    { label: "Total Products", value: stats.products, icon: Package, color: "bg-blue-50 text-blue-600", href: "/products" },
    { label: "Total Orders", value: stats.orders, icon: ShoppingBag, color: "bg-green-50 text-green-600", href: "/orders" },
    { label: "Pending Actions", value: stats.pending, icon: Clock, color: "bg-amber-50 text-amber-600", href: "/orders" },
    { label: "Total Reels", value: stats.reels, icon: Video, color: "bg-purple-50 text-purple-600", href: "/reels" },
    { label: "Revenue (₹)", value: `₹${stats.revenue.toLocaleString("en-IN")}`, icon: TrendingUp, color: "bg-emerald-50 text-emerald-600", href: "/analytics" },
    { label: "Coin Balance", value: stats.coins.toLocaleString(), icon: Coins, color: "bg-gold/10 text-amber-700", href: "#" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-ink-muted text-sm mt-1">Here&apos;s what&apos;s happening with your store today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}>
            <Link href={card.href} className="block bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color.split(" ")[0]}`}>
                <card.icon size={17} className={card.color.split(" ")[1]} />
              </div>
              <p className="font-display text-xl font-bold text-ink">
                {loading ? <span className="block h-6 w-16 shimmer rounded" /> : card.value}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">{card.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-base font-bold text-ink mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Add New Product", sub: "List a product for sale", href: "/products/new", icon: Package, color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50" },
            { label: "Upload Reel", sub: "Create organic or sponsored reel", href: "/reels", icon: Video, color: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/50" },
            { label: "Manage Orders", sub: `${stats.pending} need attention`, href: "/orders", icon: ShoppingBag, color: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50" },
          ].map((a) => (
            <Link key={a.label} href={a.href}
              className={`flex items-center gap-4 p-4 bg-white rounded-2xl border-2 transition-all group ${a.color}`}>
              <a.icon size={20} className="text-ink-muted flex-shrink-0 group-hover:text-ink transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink">{a.label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{a.sub}</p>
              </div>
              <ArrowRight size={15} className="text-gray-300 group-hover:text-ink group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-ink">Recent Orders</h2>
          <Link href="/orders" className="text-sm text-gold font-semibold flex items-center gap-1 hover:gap-2 transition-all">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-12 shimmer rounded-xl" />)}</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-gray-100">
                <tr>{["Order", "Buyer", "Amount", "Status", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-muted">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-surface/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">#{o.order_id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 font-medium text-ink">{o.buyer_name || "Buyer"}</td>
                    <td className="px-4 py-3 font-bold text-ink">₹{(o.seller_subtotal?.amount_minor / 100 || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status] || "bg-gray-50 text-gray-500"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted text-xs">{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
