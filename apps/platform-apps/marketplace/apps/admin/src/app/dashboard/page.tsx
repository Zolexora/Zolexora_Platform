"use client";
import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { Users, Package, ShoppingBag, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";

const Tip=({active,payload,label}:any)=>active&&payload?.length?<div className="bg-white rounded-xl border border-gray-100 shadow px-3 py-2 text-xs"><p className="font-bold">{label}: {payload[0].value}</p></div>:null;

export default function AdminDashboard() {
  const [stats,setStats]=useState<any>(null);
  const [analytics,setAnalytics]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([adminApi.stats(),adminApi.analytics()])
      .then(([s,a])=>{setStats(s);setAnalytics(a);})
      .finally(()=>setLoading(false));
  },[]);

  const cards = stats ? [
    {label:"Users",    value:stats.total_users,     icon:Users,      cls:"bg-blue-50 text-blue-600",    href:"/users"},
    {label:"Products", value:stats.active_products, icon:Package,    cls:"bg-orange-50 text-orange-600",href:"/products"},
    {label:"Paid Orders",value:stats.paid_orders,   icon:ShoppingBag,cls:"bg-green-50 text-green-600",  href:"/orders"},
    {label:"Pending",  value:stats.pending_orders,  icon:Clock,      cls:"bg-amber-50 text-amber-700",  href:"/orders"},
  ] : [];

  const payData = analytics ? [
    {name:"Razorpay",value:analytics.razorpay_orders_30d,fill:"#3B82F6"},
    {name:"UPI",     value:analytics.upi_orders_30d,     fill:"#10B981"},
  ] : [];

  const growData = analytics ? [
    {name:"Users 7d", value:analytics.new_users_7d},
    {name:"Users 30d",value:analytics.new_users_30d},
    {name:"Orders 7d",value:analytics.orders_7d},
    {name:"Orders 30d",value:analytics.orders_30d},
  ] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Platform Overview</h1>
        <p className="text-ink-muted text-sm mt-0.5">Cloudinary (media) · PostgreSQL (data) · Zolexora auth service (sign-in)</p>
      </div>

      {/* UPI Alert */}
      {stats?.pending_upi_verification > 0 && (
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-amber-700"/></div>
            <div>
              <p className="font-bold text-amber-900">{stats.pending_upi_verification} UPI payment{stats.pending_upi_verification>1?"s":""} await manual verification</p>
              <p className="text-amber-700 text-xs">Customers paid & submitted UTRs — verify in your UPI app then approve/reject</p>
            </div>
          </div>
          <Link href="/orders" className="h-10 px-5 bg-amber-700 text-white rounded-xl text-sm font-bold hover:bg-amber-800 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Clock size={14}/> Verify Now
          </Link>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading?[...Array(8)].map((_,i)=><div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse"/>)
        :cards.map((c,i)=>(
          <motion.div key={c.label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
            <Link href={c.href} className="block bg-white rounded-2xl p-3.5 border border-gray-100 hover:shadow-sm transition-all">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${c.cls.split(" ")[0]}`}>
                <c.icon size={15} className={c.cls.split(" ")[1]}/>
              </div>
              <p className="font-display text-xl font-bold text-ink">{c.value?.toLocaleString()}</p>
              <p className="text-[10px] text-ink-muted mt-0.5 leading-tight">{c.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {analytics && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-display text-sm font-bold text-ink mb-1">Orders by Payment Method (30d)</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={payData} barSize={32}>
                <XAxis dataKey="name" tick={{fontSize:10,fill:"#888"}}/><YAxis tick={{fontSize:10,fill:"#888"}} allowDecimals={false}/>
                <Tooltip content={<Tip/>}/><Bar dataKey="value" fill="#FFB800" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-display text-sm font-bold text-ink mb-1">Growth</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={growData} barSize={28}>
                <XAxis dataKey="name" tick={{fontSize:10,fill:"#888"}}/><YAxis tick={{fontSize:10,fill:"#888"}} allowDecimals={false}/>
                <Tooltip content={<Tip/>}/><Bar dataKey="value" fill="#6366F1" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Storage Architecture */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-100 p-5">
        <h2 className="font-display text-sm font-bold text-ink mb-3 flex items-center gap-2"><TrendingUp size={15}/> Storage Architecture</h2>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          <div><p className="font-semibold text-orange-800 mb-1">☁️ Cloudinary (media)</p>
            <ul className="text-orange-700 space-y-0.5 list-disc list-inside">
              <li>Product images → /products/</li><li>User avatars → /avatars/</li>
              <li className="text-gray-500">Free: 25GB + global CDN</li>
            </ul></div>
          <div><p className="font-semibold text-blue-800 mb-1">🔵 PostgreSQL</p>
            <ul className="text-blue-700 space-y-0.5 list-disc list-inside">
              <li>catalog, stock, carts, orders</li><li>payments, shipments, pickup addresses</li><li>wishlists</li>
            </ul></div>
        </div>
      </div>
    </div>
  );
}
