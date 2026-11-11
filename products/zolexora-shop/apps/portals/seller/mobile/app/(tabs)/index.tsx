import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Package, ShoppingBag, Video, TrendingUp, Coins, ArrowRight, Plus, Clock } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { productsApi, ordersApi, reelsApi, coinsApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";

export default function SellerDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState({ products:0, orders:0, reels:0, pending:0, revenue:0, coins:0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [prods, ords, reels, coinData] = await Promise.all([productsApi.my(), ordersApi.seller(), reelsApi.my(), coinsApi.balance()]);
      const revenue = ords.filter((o: any) => o.payment_status==="paid").reduce((s: number, o: any) => s+o.total_paid, 0);
      setStats({ products:prods.length, orders:ords.length, reels:reels.length, pending:ords.filter((o:any)=>o.status==="pending"||o.status==="processing").length, revenue, coins:coinData.coin_balance });
      setRecentOrders(ords.slice(0,4));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const STATUS_COLOR: Record<string,string> = { pending:"#D97706", processing:"#2563EB", shipped:"#7C3AED", delivered:"#16A34A", cancelled:"#DC2626" };

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <ScrollView style={ss.container} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFB800" />}>

      {/* Header */}
      <View style={ss.header}>
        <View>
          <Text style={ss.greeting}>Welcome, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={ss.greetingSub}>Your seller dashboard</Text>
        </View>
        <TouchableOpacity style={ss.coinBadge}>
          <Coins size={14} color="#FFB800" />
          <Text style={ss.coinBadgeText}>{stats.coins}</Text>
        </TouchableOpacity>
      </View>

      {/* Stat cards */}
      <View style={ss.statsGrid}>
        {[
          { label:"Products", value:stats.products, icon:Package, color:"#2563EB", bg:"rgba(37,99,235,0.1)" },
          { label:"Orders", value:stats.orders, icon:ShoppingBag, color:"#16A34A", bg:"rgba(22,163,74,0.1)" },
          { label:"Pending", value:stats.pending, icon:Clock, color:"#D97706", bg:"rgba(217,119,6,0.1)" },
          { label:"Reels", value:stats.reels, icon:Video, color:"#7C3AED", bg:"rgba(124,58,237,0.1)" },
        ].map((c,i) => (
          <Animated.View key={c.label} entering={FadeInDown.delay(i*60)} style={ss.statCard}>
            <View style={[ss.statIcon, { backgroundColor:c.bg }]}><c.icon size={17} color={c.color} /></View>
            <Text style={ss.statValue}>{c.value}</Text>
            <Text style={ss.statLabel}>{c.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Revenue */}
      <Animated.View entering={FadeInDown.delay(250)} style={ss.revenueCard}>
        <View><Text style={ss.revenueLabel}>Total Revenue</Text><Text style={ss.revenueAmount}>₹{stats.revenue.toLocaleString("en-IN")}</Text></View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/analytics")} style={ss.viewBtn}><Text style={ss.viewBtnText}>Analytics</Text><ArrowRight size={13} color="#FFB800" /></TouchableOpacity>
      </Animated.View>

      {/* Quick actions */}
      <View style={ss.section}>
        <Text style={ss.sectionTitle}>Quick Actions</Text>
        <View style={ss.actionsGrid}>
          {[
            { label:"Add Product", icon:Plus, color:"#2563EB", bg:"rgba(37,99,235,0.1)", onPress:() => router.push("/product-form") },
            { label:"Upload Reel", icon:Video, color:"#7C3AED", bg:"rgba(124,58,237,0.1)", onPress:() => router.push("/(tabs)/reels") },
            { label:"View Orders", icon:ShoppingBag, color:"#16A34A", bg:"rgba(22,163,74,0.1)", onPress:() => router.push("/(tabs)/orders") },
            { label:"My Products", icon:Package, color:"#D97706", bg:"rgba(217,119,6,0.1)", onPress:() => router.push("/(tabs)/products") },
          ].map(a => (
            <TouchableOpacity key={a.label} style={ss.actionCard} onPress={a.onPress} activeOpacity={0.8}>
              <View style={[ss.actionIcon, { backgroundColor:a.bg }]}><a.icon size={20} color={a.color} /></View>
              <Text style={ss.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent orders */}
      <View style={ss.section}>
        <View style={ss.sectionRow}>
          <Text style={ss.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/orders")}><Text style={ss.seeAll}>See all</Text></TouchableOpacity>
        </View>
        {recentOrders.length === 0
          ? <Text style={ss.emptyText}>No orders yet</Text>
          : recentOrders.map(o => (
            <View key={o.id} style={ss.orderRow}>
              <View style={{ flex:1 }}>
                <Text style={ss.orderBuyer}>{o.buyer_name}</Text>
                <Text style={ss.orderMeta}>{o.items?.length} items · ₹{o.total_paid?.toLocaleString("en-IN")}</Text>
              </View>
              <View style={[ss.orderStatus, { backgroundColor: `${STATUS_COLOR[o.status]}22` }]}>
                <Text style={[ss.orderStatusText, { color:STATUS_COLOR[o.status] || "#888" }]}>{o.status}</Text>
              </View>
            </View>
          ))}
      </View>

      <TouchableOpacity style={ss.logoutBtn} onPress={async () => { await logout(); router.replace("/auth"); }}>
        <Text style={ss.logoutText}>Sign Out</Text>
      </TouchableOpacity>
      <View style={{ height:40 }} />
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:56, paddingBottom:20 },
  greeting: { fontSize:20, fontWeight:"900", color:"#fff" },
  greetingSub: { fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 },
  coinBadge: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(255,184,0,0.15)", borderRadius:20, paddingHorizontal:12, paddingVertical:7 },
  coinBadgeText: { fontSize:13, fontWeight:"900", color:"#FFB800" },
  statsGrid: { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:12, gap:12, marginBottom:12 },
  statCard: { width:"47%", backgroundColor:"rgba(255,255,255,0.05)", borderRadius:20, padding:16, borderWidth:1, borderColor:"rgba(255,255,255,0.05)" },
  statIcon: { width:38, height:38, borderRadius:12, alignItems:"center", justifyContent:"center", marginBottom:10 },
  statValue: { fontSize:26, fontWeight:"900", color:"#fff" },
  statLabel: { fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:"600", marginTop:2 },
  revenueCard: { marginHorizontal:16, backgroundColor:"rgba(255,184,0,0.08)", borderRadius:20, padding:20, flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:4, borderWidth:1, borderColor:"rgba(255,184,0,0.15)" },
  revenueLabel: { fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:"600" },
  revenueAmount: { fontSize:28, fontWeight:"900", color:"#FFB800", marginTop:2 },
  viewBtn: { flexDirection:"row", alignItems:"center", gap:4 },
  viewBtnText: { fontSize:13, fontWeight:"700", color:"#FFB800" },
  section: { paddingHorizontal:16, marginTop:20 },
  sectionTitle: { fontSize:15, fontWeight:"800", color:"#fff", marginBottom:12 },
  sectionRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  seeAll: { fontSize:12, fontWeight:"700", color:"#FFB800" },
  actionsGrid: { flexDirection:"row", flexWrap:"wrap", gap:12 },
  actionCard: { width:"47%", backgroundColor:"rgba(255,255,255,0.05)", borderRadius:18, padding:16, alignItems:"center", gap:10 },
  actionIcon: { width:44, height:44, borderRadius:14, alignItems:"center", justifyContent:"center" },
  actionLabel: { fontSize:12, fontWeight:"700", color:"rgba(255,255,255,0.8)", textAlign:"center" },
  orderRow: { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.05)", borderRadius:14, padding:14, marginBottom:8 },
  orderBuyer: { fontSize:13, fontWeight:"700", color:"#fff" },
  orderMeta: { fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 },
  orderStatus: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  orderStatusText: { fontSize:11, fontWeight:"700", textTransform:"capitalize" },
  emptyText: { color:"rgba(255,255,255,0.3)", fontSize:13, textAlign:"center", paddingVertical:16 },
  logoutBtn: { marginHorizontal:16, marginTop:24, paddingVertical:14, alignItems:"center", borderRadius:18, borderWidth:1, borderColor:"rgba(255,255,255,0.1)" },
  logoutText: { fontSize:14, fontWeight:"700", color:"rgba(255,255,255,0.4)" },
});
