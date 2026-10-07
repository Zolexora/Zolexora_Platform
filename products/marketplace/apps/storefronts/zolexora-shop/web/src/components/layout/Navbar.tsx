"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingCart, Search, Package, Coins, LogOut, ChevronDown, Truck, User as UserIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, useCartStore } from "@/store";
import { productsApi, type Product } from "@/lib/api";
import toast from "react-hot-toast";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { count, fetch: fetchCart } = useCartStore();
  const [search, setSearch] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (user) fetchCart(); }, [user, fetchCart]);

  useEffect(() => {
    if (search.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await productsApi.list({ search, limit: 5 });
        setSuggestions(data);
        setShowSugg(true);
      } catch { /* ignore */ }
    }, 300);
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/store?search=${encodeURIComponent(search.trim())}`);
      setShowSugg(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUserOpen(false);
    router.push("/");
    toast.success("Logged out");
  };

  const categories = ["Electronics", "Fashion", "Home & Living", "Beauty", "Sports", "Food"];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      {/* Main bar */}
      <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center gap-2" aria-label="Zolexora home">
          <span className="relative h-10 w-12 flex items-center justify-center overflow-hidden rounded-md bg-white">
            <img src="/Zolexora_logo.png" alt="Zolexora" className="h-10 w-12 object-contain" />
          </span>
          <span className="font-display font-bold text-xl tracking-tight text-ink hidden sm:inline">
            Zolexora
          </span>
        </Link>

        {/* Search */}
        <div ref={searchRef} className="flex-1 max-w-2xl relative">
          <form onSubmit={handleSearch} className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              placeholder="Search for products..."
              className="w-full h-10 pl-4 pr-12 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all placeholder:text-gray-400"
            />
            <button type="submit" title="Search" className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center rounded-r-lg bg-gold hover:bg-gold-dark transition-colors">
              <Search size={16} className="text-ink" />
            </button>
          </form>

          <AnimatePresence>
            {showSugg && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute top-12 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-modal z-50 overflow-hidden">
                {suggestions.map((p) => (
                  <button key={p.id} onClick={() => { router.push(`/product/${p.id}`); setShowSugg(false); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream text-left transition-colors">
                    {p.images?.[0] && <Image src={p.images[0]} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover" unoptimized />}
                    <div>
                      <h4 className="text-sm font-semibold text-ink line-clamp-1">{p.title}</h4>
                      <p className="text-xs text-gray-500">₹{(p.price.amount_minor / 100).toLocaleString("en-IN")}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Cart */}
          <Link href="/cart" className="relative h-10 w-10 flex items-center justify-center rounded-lg hover:bg-cream transition-colors">
            <ShoppingCart size={20} className="text-ink-soft" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-gold text-ink text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          {/* User */}
          {user ? (
            <div className="relative">
              <button onClick={() => setUserOpen(!userOpen)}
                className="flex items-center gap-2 h-10 px-3 rounded-lg hover:bg-cream transition-colors">
                <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-ink">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium text-ink hidden sm:block max-w-[100px] truncate">{user.name?.split(" ")[0]}</span>
                <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
              </button>

              <AnimatePresence>
                {userOpen && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    className="absolute right-0 top-12 w-52 bg-white border border-gray-100 rounded-xl shadow-modal z-50 overflow-hidden py-1">
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="font-semibold text-sm text-ink">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link href="/profile" onClick={() => setUserOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream text-sm text-ink transition-colors">
                      <UserIcon size={15} className="text-gray-400" />
                      <span>My Profile</span>
                    </Link>
                    <Link href="/wallet" onClick={() => setUserOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream text-sm text-ink transition-colors">
                      <Coins size={15} className="text-gold" />
                      <span>{user.coin_balance?.toLocaleString()} coins</span>
                    </Link>
                    <Link href="/orders" onClick={() => setUserOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream text-sm text-ink transition-colors">
                      <Package size={15} className="text-gray-400" />
                      <span>My Orders</span>
                    </Link>
                    <Link href="/track" onClick={() => setUserOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream text-sm text-ink transition-colors">
                      <Truck size={15} className="text-gray-400" />
                      <span>Track Shipment</span>
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-sm text-red-600 transition-colors">
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link href="/auth" className="h-10 px-4 bg-gold hover:bg-gold-dark transition-colors rounded-lg flex items-center text-sm font-semibold text-ink">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Category bar */}
      <div className="border-t border-gray-50 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center gap-6 h-9 overflow-x-auto scrollbar-hide">
          <Link href="/store" className="text-xs font-medium text-gray-500 hover:text-ink whitespace-nowrap transition-colors">All Products</Link>
          {categories.map((cat) => (
            <Link key={cat} href={`/store?category=${cat}`} className="text-xs font-medium text-gray-500 hover:text-ink whitespace-nowrap transition-colors">
              {cat}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
