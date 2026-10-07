"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Package, Video, ShoppingBag, BarChart3, LogOut, ChevronRight, Menu, Truck } from "lucide-react";
import { useAuthStore } from "@/store";
import { authApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { href:"/dashboard", icon:LayoutDashboard, label:"Dashboard" },
  { href:"/users",     icon:Users,           label:"Users" },
  { href:"/storefronts", icon:LayoutDashboard, label:"Storefronts" },
  { href:"/sellers",   icon:Users,           label:"Sellers" },
  { href:"/catalog",   icon:Package,         label:"Catalog" },
  { href:"/inventory", icon:Package,         label:"Inventory" },
  { href:"/products",  icon:Package,         label:"Products" },
  { href:"/reels",     icon:Video,           label:"Reels" },
  { href:"/orders",    icon:ShoppingBag,     label:"Orders" },
  { href:"/shipping",  icon:Truck,           label:"Shipping" },
  { href:"/payments",  icon:BarChart3,       label:"Payments" },
  { href:"/audit",     icon:BarChart3,       label:"Audit Log" },
  { href:"/analytics", icon:BarChart3,       label:"Analytics" },
];

export default function AdminShell({ children }:{ children:React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, login, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/auth")) {
      setLoading(false);
      return;
    }
    authApi.me().then((u) => {
      if (u.role !== "admin") { logout(); router.replace("/auth"); return; }
      login(u);
    }).catch(() => {
      logout();
      router.replace("/auth");
    }).finally(() => setLoading(false));
  }, [pathname]);

  if (pathname.startsWith("/auth")) return <>{children}</>;
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return null;

  const Sidebar = () => (
    <aside className="w-60 bg-ink flex flex-col h-full">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <img src="/Zolexora_logo.png" alt="" className="h-8 w-10 rounded-md bg-white object-contain" />
          <div><span className="font-display text-white text-base font-bold block leading-tight">Zolexora</span>
            <span className="text-white/30 text-[10px] uppercase tracking-widest">Admin</span></div>
        </div>
      </div>
      <nav className="p-3 flex-1 space-y-0.5">
        {NAV.map(({ href, icon:Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${active ? "bg-gold text-ink" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              <Icon size={16} className={active ? "text-ink" : "text-white/30 group-hover:text-white/70"} />
              {label}
              {active && <ChevronRight size={13} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <div className="px-3 py-2 mb-1 flex items-center gap-2">
          <div className="w-7 h-7 bg-gold rounded-full flex items-center justify-center text-xs font-bold text-ink">{user.name?.[0]?.toUpperCase()}</div>
          <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{user.name}</p><p className="text-white/30 text-[10px]">Administrator</p></div>
        </div>
        <button onClick={() => { void authApi.logout().catch(() => {}); logout(); router.push("/auth"); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/30 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all">
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex flex-shrink-0"><Sidebar /></div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x:-260 }} animate={{ x:0 }} exit={{ x:-260 }} className="absolute left-0 top-0 bottom-0 w-60 flex"><Sidebar /></motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 h-13 bg-white border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-50"><Menu size={20} /></button>
          <img src="/Zolexora_logo.png" alt="" className="h-9 w-11 rounded-md object-contain" />
          <span className="font-display font-bold text-ink">Admin</span>
        </div>
        <main className="flex-1 overflow-y-auto bg-surface p-6">{children}</main>
      </div>
    </div>
  );
}
