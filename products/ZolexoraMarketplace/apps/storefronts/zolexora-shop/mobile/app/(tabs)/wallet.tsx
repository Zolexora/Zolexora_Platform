import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Coins, TrendingUp, TrendingDown, Gift, Sparkles } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { coinsApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";
import Toast from "react-native-toast-message";

const TIERS = [
  { coins:50,  percent:10, label:"Starter Deal" },
  { coins:100, percent:20, label:"Good Savings" },
  { coins:200, percent:30, label:"Max Discount" },
];

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [tab, setTab] = useState<"history"|"codes">("history");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number|null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([coinsApi.balance(), coinsApi.history(), (coinsApi as any).myDiscounts?.() || Promise.resolve([])])
      .then(([b,h,d]) => { setBalance(b.coin_balance); setHistory(h); setDiscounts(d); })
      .finally(() => setLoading(false));
  }, [user]);

  const generate = async (tier: typeof TIERS[0]) => {
    if (balance < tier.coins) { Toast.show({ type:"error", text1:"Not enough coins" }); return; }
    setGenerating(tier.coins);
    try {
      const { api } = await import("../../src/lib/api");
      const res = await api.post("/coins/generate-discount", { coins_to_spend: tier.coins }).then(r=>r.data);
      setDiscounts(d => [res,...d]);
      setBalance(b => b - tier.coins);
      Toast.show({ type:"success", text1:`${tier.percent}% discount generated!`, text2:`Code: ${res.code}` });
    } catch { Toast.show({ type:"error", text1:"Failed" }); }
    finally { setGenerating(null); }
  };

  if (!user) return (
    <View style={ss.centered}>
      <Coins size={48} color="#E0E0E0" />
      <Text style={ss.emptyTitle}>Sign in to view wallet</Text>
      <TouchableOpacity style={ss.signInBtn} onPress={() => router.push("/auth")}>
        <Text style={ss.signInText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <ScrollView style={ss.container} showsVerticalScrollIndicator={false}>
      <View style={ss.header}><Text style={ss.title}>Coin Wallet</Text></View>

      {/* Balance card */}
      <Animated.View entering={FadeInDown.duration(400)} style={ss.balanceCard}>
        <Coins size={22} color="#FFB800" />
        <Text style={ss.balanceLabel}>Your Balance</Text>
        <Text style={ss.balanceAmount}>{balance.toLocaleString()}</Text>
        <Text style={ss.balanceSub}>≈ ₹{(balance * 0.01).toFixed(0)} in discounts</Text>
      </Animated.View>

      {/* Earn tips */}
      <View style={ss.section}>
        <Text style={ss.sectionTitle}>How to earn</Text>
        <View style={ss.tipsRow}>
          {[{ emoji:"🎬", title:"Watch Reels", sub:"+3 coins each" },
            { emoji:"🛍️", title:"Shop Products", sub:"Earn on purchase" }].map(t => (
            <View key={t.title} style={ss.tipCard}>
              <Text style={{ fontSize:24, marginBottom:6 }}>{t.emoji}</Text>
              <Text style={ss.tipTitle}>{t.title}</Text>
              <Text style={ss.tipSub}>{t.sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Redeem */}
      <View style={ss.section}>
        <Text style={ss.sectionTitle}>Redeem for Discounts</Text>
        <View style={{ gap:10 }}>
          {TIERS.map(tier => {
            const can = balance >= tier.coins;
            return (
              <View key={tier.coins} style={[ss.tierRow, !can && { opacity:0.5 }]}>
                <View style={ss.tierIcon}><Sparkles size={18} color="#FFB800" /></View>
                <View style={{ flex:1 }}>
                  <Text style={ss.tierTitle}>{tier.percent}% off — {tier.label}</Text>
                  <Text style={ss.tierSub}>{tier.coins} coins</Text>
                </View>
                <TouchableOpacity style={[ss.redeemBtn, !can && ss.redeemBtnDisabled]} onPress={() => generate(tier)} disabled={!can||generating===tier.coins}>
                  <Text style={ss.redeemText}>{generating===tier.coins?"...":"Redeem"}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tabs */}
      <View style={ss.tabRow}>
        {(["history","codes"] as const).map(t => (
          <TouchableOpacity key={t} style={[ss.tab, tab===t && ss.tabActive]} onPress={() => setTab(t)}>
            <Text style={[ss.tabText, tab===t && ss.tabTextActive]}>{t==="history"?"History":"Discount Codes"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={ss.section}>
        {tab === "history" ? (
          history.length === 0 ? <Text style={ss.emptyText}>No transactions yet</Text> :
          history.map(tx => (
            <View key={tx.id} style={ss.txRow}>
              <View style={[ss.txIcon, tx.type==="earned" ? ss.txIconEarn : ss.txIconSpend]}>
                {tx.type==="earned" ? <TrendingUp size={14} color="#22C55E" /> : <TrendingDown size={14} color="#EF4444" />}
              </View>
              <View style={{ flex:1 }}>
                <Text style={ss.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={ss.txDate}>{new Date(tx.created_at).toLocaleDateString("en-IN")}</Text>
              </View>
              <Text style={[ss.txAmount, tx.amount>0 ? ss.txAmountPos : ss.txAmountNeg]}>
                {tx.amount>0?"+":""}{tx.amount}
              </Text>
            </View>
          ))
        ) : (
          discounts.length === 0 ? <Text style={ss.emptyText}>No discount codes yet</Text> :
          discounts.map(d => (
            <View key={d.id} style={[ss.codeRow, d.is_used && { opacity:0.5 }]}>
              <Text style={ss.codeEmoji}>🎟️</Text>
              <View style={{ flex:1 }}>
                <Text style={ss.codeText}>{d.code}</Text>
                <Text style={ss.codeSub}>{d.discount_percent}% off · {d.coins_spent} coins</Text>
              </View>
              <View style={[ss.codeBadge, d.is_used ? ss.codeBadgeUsed : ss.codeBadgeActive]}>
                <Text style={[ss.codeBadgeText, !d.is_used && { color:"#15803d" }]}>{d.is_used?"Used":"Active"}</Text>
              </View>
            </View>
          ))
        )}
      </View>
      <View style={{ height:40 }} />
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#FAFAF8" },
  header: { paddingHorizontal:20, paddingTop:56, paddingBottom:14, backgroundColor:"#fff" },
  title: { fontSize:22, fontWeight:"900", color:"#111" },
  balanceCard: { margin:16, backgroundColor:"#111", borderRadius:24, padding:24, alignItems:"center", gap:4 },
  balanceLabel: { color:"#FFB800", fontSize:13, fontWeight:"700", marginTop:4 },
  balanceAmount: { color:"#fff", fontSize:48, fontWeight:"900" },
  balanceSub: { color:"rgba(255,255,255,0.4)", fontSize:13 },
  section: { paddingHorizontal:16, marginBottom:8 },
  sectionTitle: { fontSize:16, fontWeight:"800", color:"#111", marginBottom:12 },
  tipsRow: { flexDirection:"row", gap:12 },
  tipCard: { flex:1, backgroundColor:"#fff", borderRadius:18, padding:14 },
  tipTitle: { fontSize:13, fontWeight:"800", color:"#111" },
  tipSub: { fontSize:11, color:"#888", marginTop:2 },
  tierRow: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:"#fff", borderRadius:16, padding:14 },
  tierIcon: { width:40, height:40, backgroundColor:"#FFF8E1", borderRadius:12, alignItems:"center", justifyContent:"center" },
  tierTitle: { fontSize:13, fontWeight:"700", color:"#111" },
  tierSub: { fontSize:11, color:"#888", marginTop:1 },
  redeemBtn: { backgroundColor:"#FFB800", borderRadius:10, paddingHorizontal:14, paddingVertical:7 },
  redeemBtnDisabled: { backgroundColor:"#F0F0F0" },
  redeemText: { fontSize:12, fontWeight:"800", color:"#111" },
  tabRow: { flexDirection:"row", marginHorizontal:16, marginBottom:12, backgroundColor:"#F0F0F0", borderRadius:14, padding:3 },
  tab: { flex:1, paddingVertical:8, borderRadius:12, alignItems:"center" },
  tabActive: { backgroundColor:"#fff" },
  tabText: { fontSize:12, fontWeight:"700", color:"#888" },
  tabTextActive: { color:"#111" },
  txRow: { flexDirection:"row", alignItems:"center", gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#F5F5F5" },
  txIcon: { width:32, height:32, borderRadius:10, alignItems:"center", justifyContent:"center" },
  txIconEarn: { backgroundColor:"#F0FDF4" },
  txIconSpend: { backgroundColor:"#FEF2F2" },
  txDesc: { fontSize:13, fontWeight:"600", color:"#111", flex:1 },
  txDate: { fontSize:11, color:"#AAA" },
  txAmount: { fontSize:14, fontWeight:"900" },
  txAmountPos: { color:"#22C55E" },
  txAmountNeg: { color:"#EF4444" },
  codeRow: { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#fff", borderRadius:16, padding:14, marginBottom:8 },
  codeEmoji: { fontSize:22 },
  codeText: { fontFamily:"monospace", fontSize:16, fontWeight:"900", color:"#111", letterSpacing:3 },
  codeSub: { fontSize:11, color:"#888", marginTop:1 },
  codeBadge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  codeBadgeActive: { backgroundColor:"#F0FDF4" },
  codeBadgeUsed: { backgroundColor:"#F5F5F5" },
  codeBadgeText: { fontSize:11, fontWeight:"700", color:"#888" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", gap:12 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"#555" },
  emptyText: { fontSize:13, color:"#AAA", textAlign:"center", paddingVertical:20 },
  signInBtn: { backgroundColor:"#111", borderRadius:16, paddingHorizontal:24, paddingVertical:12 },
  signInText: { fontSize:14, fontWeight:"800", color:"#fff" },
});
