import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { TrendingUp, Package, ShoppingBag, Video, IndianRupee } from "lucide-react-native";
import { ordersApi, productsApi, reelsApi } from "../../src/lib/api";

export default function SellerAnalyticsScreen() {
  const [data, setData] = useState<any>({ orders:[], products:[], reels:[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([ordersApi.seller(), productsApi.my(), reelsApi.my()])
      .then(([orders, products, reels]) => setData({ orders, products, reels }))
      .finally(() => setLoading(false));
  }, []);

  const paid = data.orders.filter((o: any) => o.payment_status === "paid");
  const revenue = paid.reduce((s: number, o: any) => s + o.total_paid, 0);
  const avgOrder = paid.length ? revenue / paid.length : 0;
  const totalViews = data.reels.reduce((s: number, r: any) => s + r.views_count, 0);
  const pendingCount = data.orders.filter((o: any) => o.status==="pending"||o.status==="processing").length;

  const statCards = [
    { label:"Total Revenue", value:`₹${revenue.toLocaleString("en-IN")}`, icon:IndianRupee, color:"#16A34A" },
    { label:"Paid Orders", value:paid.length, icon:ShoppingBag, color:"#2563EB" },
    { label:"Avg Order", value:`₹${Math.round(avgOrder).toLocaleString("en-IN")}`, icon:TrendingUp, color:"#7C3AED" },
    { label:"Pending", value:pendingCount, icon:Package, color:"#D97706" },
    { label:"Products", value:data.products.length, icon:Package, color:"#0891B2" },
    { label:"Reel Views", value:totalViews.toLocaleString(), icon:Video, color:"#DB2777" },
  ];

  const catBreakdown = data.products.reduce((acc: any, p: any) => { acc[p.category] = (acc[p.category]||0)+1; return acc; }, {});

  const productRevenue: Record<string, any> = {};
  paid.forEach((o: any) => {
    o.items?.forEach((item: any) => {
      if (!productRevenue[item.product_id]) productRevenue[item.product_id] = { title:item.product_title, revenue:0, units:0 };
      productRevenue[item.product_id].revenue += item.price * item.quantity;
      productRevenue[item.product_id].units += item.quantity;
    });
  });
  const topProducts = Object.values(productRevenue).sort((a:any,b:any) => b.revenue-a.revenue).slice(0,5);

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <ScrollView style={ss.container} showsVerticalScrollIndicator={false}>
      <View style={ss.header}><Text style={ss.title}>Analytics</Text></View>

      {/* Stat grid */}
      <View style={ss.grid}>
        {statCards.map((c,i) => (
          <View key={c.label} style={ss.statCard}>
            <View style={[ss.statIcon, { backgroundColor:`${c.color}18` }]}><c.icon size={16} color={c.color} /></View>
            <Text style={ss.statVal}>{c.value}</Text>
            <Text style={ss.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Category breakdown */}
      {Object.keys(catBreakdown).length > 0 && (
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Products by Category</Text>
          <View style={ss.catList}>
            {Object.entries(catBreakdown).map(([cat, count]:any) => (
              <View key={cat} style={ss.catRow}>
                <Text style={ss.catName}>{cat}</Text>
                <View style={ss.catBar}>
                  <View style={[ss.catBarFill, { width:`${Math.min(100, (count/data.products.length)*100)}%` }]} />
                </View>
                <Text style={ss.catCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Top Products by Revenue</Text>
          {topProducts.map((p:any, i) => (
            <View key={p.title} style={ss.topRow}>
              <Text style={ss.topRank}>{i+1}</Text>
              <View style={{ flex:1 }}>
                <Text style={ss.topTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={ss.topUnits}>{p.units} units sold</Text>
              </View>
              <Text style={ss.topRevenue}>₹{p.revenue.toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top reels */}
      {data.reels.length > 0 && (
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Reel Performance</Text>
          {data.reels.sort((a:any,b:any)=>b.views_count-a.views_count).slice(0,5).map((r:any) => (
            <View key={r.id} style={ss.reelRow}>
              <View style={[ss.reelType, r.content_type==="sponsored" && ss.reelTypeSponsored]}>
                <Text style={[ss.reelTypeText, r.content_type==="sponsored" && { color:"#111" }]}>
                  {r.content_type==="sponsored"?"S":"O"}
                </Text>
              </View>
              <Text style={ss.reelTitle} numberOfLines={1}>{r.title}</Text>
              <Text style={ss.reelViews}>{r.views_count} views</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height:60 }} />
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  header: { paddingHorizontal:20, paddingTop:56, paddingBottom:16 },
  title: { fontSize:22, fontWeight:"900", color:"#fff" },
  grid: { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:12, gap:10, marginBottom:8 },
  statCard: { width:"30.5%", backgroundColor:"rgba(255,255,255,0.05)", borderRadius:16, padding:14, borderWidth:1, borderColor:"rgba(255,255,255,0.05)" },
  statIcon: { width:34, height:34, borderRadius:10, alignItems:"center", justifyContent:"center", marginBottom:8 },
  statVal: { fontSize:18, fontWeight:"900", color:"#fff" },
  statLabel: { fontSize:9, color:"rgba(255,255,255,0.3)", fontWeight:"600", marginTop:2 },
  section: { paddingHorizontal:16, marginTop:20 },
  sectionTitle: { fontSize:14, fontWeight:"800", color:"#fff", marginBottom:12 },
  catList: { gap:8 },
  catRow: { flexDirection:"row", alignItems:"center", gap:10 },
  catName: { fontSize:12, color:"rgba(255,255,255,0.5)", width:90 },
  catBar: { flex:1, height:6, backgroundColor:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" },
  catBarFill: { height:"100%", backgroundColor:"#FFB800", borderRadius:3 },
  catCount: { fontSize:12, fontWeight:"700", color:"rgba(255,255,255,0.5)", width:20, textAlign:"right" },
  topRow: { flexDirection:"row", alignItems:"center", gap:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.05)" },
  topRank: { fontSize:18, fontWeight:"900", color:"rgba(255,255,255,0.15)", width:24 },
  topTitle: { fontSize:13, fontWeight:"600", color:"#fff" },
  topUnits: { fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 },
  topRevenue: { fontSize:13, fontWeight:"900", color:"#FFB800" },
  reelRow: { flexDirection:"row", alignItems:"center", gap:10, paddingVertical:9, borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.05)" },
  reelType: { width:26, height:26, borderRadius:8, backgroundColor:"rgba(255,255,255,0.06)", alignItems:"center", justifyContent:"center" },
  reelTypeSponsored: { backgroundColor:"rgba(255,184,0,0.2)" },
  reelTypeText: { fontSize:11, fontWeight:"900", color:"rgba(255,255,255,0.4)" },
  reelTitle: { flex:1, fontSize:13, fontWeight:"600", color:"rgba(255,255,255,0.8)" },
  reelViews: { fontSize:11, color:"rgba(255,255,255,0.3)" },
});
