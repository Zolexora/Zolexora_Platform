"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, Video, ShoppingBag, BarChart3, Settings, LogOut, Coins, ChevronRight, Menu, X, Truck } from "lucide-react";
import { useAuthStore } from "@/store";
import { authApi, sellerOrgApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/products",   icon: Package,          label: "Products" },
  { href: "/reels",      icon: Video,             label: "Reels" },
  { href: "/orders",     icon: ShoppingBag,       label: "Orders" },
  { href: "/shipping",   icon: Truck,             label: "Shipping" },
  { href: "/analytics",  icon: BarChart3,         label: "Analytics" },
  { href: "/settings",   icon: Settings,          label: "Settings" },
];

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, login, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPublicRoute = pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/verification");

  useEffect(() => {
    setLoading(true);
    // Public seller pages are reachable without a marketplace session. Do not
    // probe /auth/me until the session marker exists, avoiding an expected 401
    // in the browser console on the login page.
    if (isPublicRoute && typeof document !== "undefined" && !document.cookie.includes("z_csrf=")) {
      setLoading(false);
      return;
    }
    authApi.me().then(async (u: any) => {
      login(u);
      if (!isPublicRoute) {
        let organizations: any[] = [];
        try {
          organizations = await sellerOrgApi.listMy();
        } catch {
          // Authenticated users without seller authorization still belong in
          // Business Verification, not on the login screen.
          organizations = [];
        }
        const verified = organizations.some((org: any) => ["VERIFIED", "ACTIVE"].includes(String(org.verification_status || "").toUpperCase()) || String(org.status || "").toUpperCase() === "ACTIVE");
        if (!verified) router.replace("/verification");
      }
    }).catch(() => { 
      logout(); 
      if (!isPublicRoute) router.replace("/auth"); 
    })
      .finally(() => setLoading(false));
  }, [isPublicRoute, pathname]);

  if (isPublicRoute) return <>{children}</>;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  const Sidebar = () => (
    <aside className="w-64 bg-sidebar flex flex-col h-full">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src="/Zolexora_logo.png" alt="" className="h-10 w-12 rounded-md bg-white object-contain" />
          <span className="font-display text-white text-xl font-bold">Zolexora</span>
        </div>
        <p className="text-white/40 text-xs mt-0.5">Seller Dashboard</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <nav className="space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  active ? "bg-gold text-ink" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}>
                <Icon size={17} className={active ? "text-ink" : "text-white/40 group-hover:text-white"} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto text-ink/60" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-white/5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-ink">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <div className="flex items-center gap-1 text-gold text-xs"><Coins size={10} />{user.coin_balance}</div>
          </div>
        </div>
        <button onClick={() => { void authApi.logout().catch(() => {}); logout(); router.push("/auth"); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0"><Sidebar /></div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className="absolute left-0 top-0 bottom-0 w-64 flex">
              <Sidebar />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-50" aria-label="Open menu">
            <Menu size={20} className="text-ink" />
          </button>
          <img src="/Zolexora_logo.png" alt="" className="h-9 w-11 rounded-md object-contain" />
          <span className="font-display font-bold text-ink">Zolexora Seller</span>
        </div>
        <main className="flex-1 overflow-y-auto bg-surface p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
