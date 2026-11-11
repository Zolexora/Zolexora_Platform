"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { coinsApi, type CoinTransaction, type DiscountCode } from "@/lib/api";
import { Coins, Gift, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

const DISCOUNT_TIERS = [
  { coins: 50, percent: 10, label: "Starter" },
  { coins: 100, percent: 20, label: "Popular" },
  { coins: 200, percent: 30, label: "Max Savings" },
];

export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<CoinTransaction[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [generating, setGenerating] = useState<number | null>(null);
  const [tab, setTab] = useState<"history" | "discounts">("history");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    Promise.all([coinsApi.balance(), coinsApi.history(), coinsApi.discounts()])
      .then(([b, h, d]) => { setBalance(b.coin_balance); setHistory(h); setDiscounts(d); })
      .finally(() => setLoading(false));
  }, [user, router]);

  const generateDiscount = async (tier: typeof DISCOUNT_TIERS[0]) => {
    if (balance < tier.coins) { toast.error("Not enough coins"); return; }
    setGenerating(tier.coins);
    try {
      const code = await coinsApi.generate(tier.coins);
      setDiscounts((d) => [code, ...d]);
      setBalance((b) => b - tier.coins);
      toast.success(`${tier.percent}% discount code generated!`);
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setGenerating(null); }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-6">Coin Wallet</h1>

      {/* Balance card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-ink to-ink-soft rounded-3xl p-7 text-white mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={20} className="text-gold" />
            <span className="text-gold font-semibold text-sm">Your Coins</span>
          </div>
          <div className="font-display text-5xl font-bold mb-2">{balance.toLocaleString()}</div>
          <p className="text-white/60 text-sm">≈ ₹{(balance * 0.01).toFixed(0)} in discounts</p>
        </div>
      </motion.div>

      {/* How to earn */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: "🎬", title: "Watch Reels", sub: "+3 coins per reel (max 150/day)", color: "bg-purple-50 border-purple-100" },
          { icon: "🛍️", title: "Shop Products", sub: "Earn coins on purchases", color: "bg-blue-50 border-blue-100" },
        ].map((item) => (
          <div key={item.title} className={`${item.color} border rounded-2xl p-4`}>
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-sm font-semibold text-ink">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Redeem section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={17} className="text-gold" />
          <h2 className="font-bold text-base text-ink">Redeem Coins for Discounts</h2>
        </div>
        <div className="space-y-2">
          {DISCOUNT_TIERS.map((tier) => {
            const canAfford = balance >= tier.coins;
            return (
              <div key={tier.coins} className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${canAfford ? "border-gray-100 hover:border-gold/40 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <Sparkles size={15} className="text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-ink">{tier.percent}% off — {tier.label}</p>
                    <p className="text-xs text-gray-400">{tier.coins} coins</p>
                  </div>
                </div>
                <button onClick={() => generateDiscount(tier)} disabled={!canAfford || generating === tier.coins}
                  className="h-8 px-4 bg-gold hover:bg-gold-dark disabled:opacity-50 rounded-lg text-xs font-bold text-ink transition-all">
                  {generating === tier.coins ? "..." : "Redeem"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-4">
        {(["history", "discounts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 pb-2.5 text-sm font-semibold capitalize transition-all ${tab === t ? "border-b-2 border-gold text-ink" : "text-gray-400 hover:text-gray-600"}`}>
            {t === "history" ? "Transaction History" : `My Discount Codes (${discounts.filter((d) => !d.is_used).length})`}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No transactions yet. Watch reels to earn coins!</p>
          ) : history.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === "earned" ? "bg-green-50" : "bg-red-50"}`}>
                {tx.type === "earned"
                  ? <ArrowUpRight size={14} className="text-green-600" />
                  : <ArrowDownRight size={14} className="text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink line-clamp-1">{tx.description}</p>
                <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString("en-IN")}</p>
              </div>
              <span className={`text-sm font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                {tx.amount > 0 ? "+" : ""}{tx.amount}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No discount codes yet. Redeem your coins above!</p>
          ) : discounts.map((d) => (
            <div key={d.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${d.is_used ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gold/30"}`}>
              <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-sm">🎟️</div>
              <div className="flex-1">
                <p className="font-mono font-bold text-sm text-ink tracking-widest">{d.code}</p>
                <p className="text-xs text-gray-500">{d.discount_percent}% off · {d.coins_spent} coins</p>
              </div>
              {d.is_used
                ? <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Used</span>
                : <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">Active</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
