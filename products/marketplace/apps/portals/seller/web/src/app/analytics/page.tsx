"use client";
import { useState, useEffect } from "react";
import { ordersApi, productsApi, reelsApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Package, ShoppingBag, Video, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";

const COLORS = ["#FFB800", "#111111", "#10B981", "#8B5CF6", "#EF4444"];

// 1. Defined the explicit type to fix the TypeScript build error
interface CategoryData {
  name: string;
  value: number;
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([ordersApi.seller(), productsApi.my(), reelsApi.my()])
      .then(([o, p, r]) => { setOrders(o); setProducts(p); setReels(r); })
      .finally(() => setLoading(false));
  }, []);

  // Compute stats
  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total_paid, 0);
  const avgOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const totalViews = reels.reduce((s, r) => s + r.views_count, 0);

  // Orders by day (last 14 days)
  const ordersByDay = (() => {
    const days: Record<string, { date: string; orders: number; revenue: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), orders: 0, revenue: 0 };
    }
    paidOrders.forEach((o) => {
      const key = o.created_at.slice(0, 10);
      if (days[key]) { days[key].orders++; days[key].revenue += o.total_paid; }
    });
    return Object.values(days);
  })();

  // Category breakdown
  const catBreakdown = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1; return acc;
  }, {} as Record<string, number>);
  
  // 2. Applied the type here so TypeScript knows what 'd.value' is
 const catData: CategoryData[] = Object.entries(catBreakdown).map(([name, value]) => ({ 
  name, 
  value: value as number 
}));

  // Top products by orders
  const productSales: Record<string, { title: string; count: number; revenue: number }> = {};
  paidOrders.forEach((o) => {
    o.items?.forEach((item: any) => {
      if (!productSales[item.product_id]) productSales[item.product_id] = { title: item.product_title, count: 0, revenue: 0 };
      productSales[item.product_id].count += item.quantity;
      productSales[item.product_id].revenue += item.price * item.quantity;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const statCards = [
    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-green-50 text-green-600" },
    { label: "Paid Orders", value: paidOrders.length, icon: ShoppingBag, color: "bg-blue-50 text-blue-600" },
    { label: "Avg Order Value", value: `₹${Math.round(avgOrderValue).toLocaleString("en-IN")}`, icon: TrendingUp, color: "bg-purple-50 text-purple-600" },
    { label: "Reel Views", value: totalViews.toLocaleString(), icon: Video, color: "bg-amber-50 text-amber-600" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-ink mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.name === "revenue" ? `₹${Number(p.value).toLocaleString("en-IN")}` : p.value}</p>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="h-8 w-48 shimmer rounded" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
      <div className="h-64 shimmer rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-ink-muted text-sm mt-0.5">Your store performance overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color.split(" ")[0]}`}>
              <card.icon size={17} className={card.color.split(" ")[1]} />
            </div>
            <p className="font-display text-2xl font-bold text-ink">{card.value}</p>
            <p className="text-xs text-ink-muted mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-display text-base font-bold text-ink mb-5">Revenue – Last 14 Days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={ordersByDay}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="revenue" stroke="#FFB800" strokeWidth={2.5} dot={false} name="revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Orders bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-display text-base font-bold text-ink mb-5">Orders – Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ordersByDay}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" fill="#111111" radius={[4, 4, 0, 0]} name="orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-display text-base font-bold text-ink mb-5">Products by Category</h2>
          {catData.length === 0 ? <p className="text-ink-muted text-sm text-center py-8">No products yet</p> : (
            <div className="flex items-center gap-4">
              <PieChart width={140} height={140}>
                <Pie data={catData} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value">
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {catData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-ink-muted flex-1">{String(d.name)}</span>
                    {/* 3. Converted d.value to a String inline to guarantee React Node compatibility */}
                    <span className="text-xs font-bold text-ink">{String(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-display text-base font-bold text-ink mb-4">Top Products by Revenue</h2>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.title} className="flex items-center gap-4">
                <span className="text-xl font-display font-bold text-gray-200 w-7 text-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink line-clamp-1">{p.title}</p>
                  <p className="text-xs text-ink-muted">{p.count} units sold</p>
                </div>
                <p className="font-bold text-sm text-ink">₹{p.revenue.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}