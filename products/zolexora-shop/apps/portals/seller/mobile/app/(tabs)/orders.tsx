import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { ChevronDown, ChevronUp, Package } from "lucide-react-native";
import { ordersApi } from "../../src/lib/api";
import Toast from "react-native-toast-message";

const S: Record<string,any> = {
  pending:    { label:"Pending",    c:"#D97706", bg:"rgba(217,119,6,0.1)" },
  processing: { label:"Processing", c:"#2563EB", bg:"rgba(37,99,235,0.1)" },
  shipped:    { label:"Shipped",    c:"#7C3AED", bg:"rgba(124,58,237,0.1)" },
  delivered:  { label:"Delivered",  c:"#16A34A", bg:"rgba(22,163,74,0.1)" },
  cancelled:  { label:"Cancelled",  c:"#DC2626", bg:"rgba(220,38,38,0.1)" },
};
const NEXT: Record<string,string[]> = { pending:["processing","cancelled"], processing:["shipped","cancelled"], shipped:["delivered"], delivered:[], cancelled:[] };

export default function SellerOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [updating, setUpdating] = useState<string|null>(null);

  useEffect(() => { ordersApi.seller().then(setOrders).finally(() => setLoading(false)); }, []);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      await ordersApi.updateStatus(orderId, status);
      setOrders(os => os.map(o => o.id===orderId ? { ...o, status } : o));
      Toast.show({ type:"success", text1:`Marked as ${status}` });
    } catch { Toast.show({ type:"error", text1:"Update failed" }); }
    finally { setUpdating(null); }
  };

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <View style={ss.container}>
      <View style={ss.header}>
        <Text style={ss.title}>Orders</Text>
        <Text style={ss.count}>{orders.length} total</Text>
      </View>
      {orders.length === 0 ? (
        <View style={ss.empty}><Package size={40} color="rgba(255,255,255,0.1)" /><Text style={ss.emptyTitle}>No orders yet</Text></View>
      ) : (
        <FlatList data={orders} keyExtractor={o=>o.id} contentContainerStyle={ss.list} showsVerticalScrollIndicator={false}
          renderItem={({ item:o }) => {
            const cfg = S[o.status] || S.pending;
            const exp = expanded === o.id;
            const next = NEXT[o.status] || [];
            return (
              <View style={ss.card}>
                <TouchableOpacity style={ss.cardHead} onPress={() => setExpanded(exp?null:o.id)} activeOpacity={0.8}>
                  <View style={[ss.statusDot, { backgroundColor:cfg.c }]} />
                  <View style={{ flex:1 }}>
                    <Text style={ss.buyer}>{o.buyer_name}</Text>
                    <Text style={ss.meta}>#{o.id.slice(0,8).toUpperCase()} · {o.items?.length} items · ₹{o.total_paid?.toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={[ss.badge, { backgroundColor:cfg.bg }]}><Text style={[ss.badgeText, { color:cfg.c }]}>{cfg.label}</Text></View>
                  {exp ? <ChevronUp size={15} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={15} color="rgba(255,255,255,0.3)" />}
                </TouchableOpacity>
                {exp && (
                  <View style={ss.cardBody}>
                    {o.items?.map((item: any) => (
                      <View key={item.product_id} style={ss.itemRow}>
                        {item.image && <Image source={{ uri:item.image }} style={ss.itemImg} />}
                        <View style={{ flex:1 }}>
                          <Text style={ss.itemTitle} numberOfLines={1}>{item.product_title}</Text>
                          <Text style={ss.itemMeta}>Qty {item.quantity} × ₹{item.price?.toLocaleString("en-IN")}</Text>
                        </View>
                        <Text style={ss.itemTotal}>₹{(item.price*item.quantity)?.toLocaleString("en-IN")}</Text>
                      </View>
                    ))}
                    {next.length > 0 && (
                      <View style={ss.actRow}>
                        <Text style={ss.actLabel}>Update to:</Text>
                        {next.map(s => (
                          <TouchableOpacity key={s} style={[ss.actBtn, s==="cancelled" && ss.actBtnRed]} onPress={() => updateStatus(o.id, s)} disabled={updating===o.id}>
                            <Text style={[ss.actBtnText, s==="cancelled" && { color:"#EF4444" }]}>{updating===o.id?"...":s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  header: { flexDirection:"row", alignItems:"baseline", gap:8, paddingHorizontal:20, paddingTop:56, paddingBottom:16 },
  title: { fontSize:22, fontWeight:"900", color:"#fff" },
  count: { fontSize:12, color:"rgba(255,255,255,0.3)", fontWeight:"600" },
  list: { padding:16, gap:10 },
  card: { backgroundColor:"rgba(255,255,255,0.05)", borderRadius:18, overflow:"hidden", borderWidth:1, borderColor:"rgba(255,255,255,0.05)" },
  cardHead: { flexDirection:"row", alignItems:"center", gap:10, padding:14 },
  statusDot: { width:8, height:8, borderRadius:4 },
  buyer: { fontSize:14, fontWeight:"700", color:"#fff" },
  meta: { fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:1 },
  badge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  badgeText: { fontSize:10, fontWeight:"800" },
  cardBody: { paddingHorizontal:14, paddingBottom:14, gap:10, borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.05)" },
  itemRow: { flexDirection:"row", alignItems:"center", gap:10, paddingTop:10 },
  itemImg: { width:40, height:40, borderRadius:10, resizeMode:"cover", backgroundColor:"rgba(255,255,255,0.05)" },
  itemTitle: { fontSize:12, fontWeight:"600", color:"#fff" },
  itemMeta: { fontSize:10, color:"rgba(255,255,255,0.3)" },
  itemTotal: { fontSize:13, fontWeight:"900", color:"#FFB800" },
  actRow: { flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:8, paddingTop:8, borderTopWidth:1, borderTopColor:"rgba(255,255,255,0.05)" },
  actLabel: { fontSize:11, color:"rgba(255,255,255,0.3)", marginRight:2 },
  actBtn: { paddingHorizontal:14, paddingVertical:7, backgroundColor:"rgba(255,184,0,0.12)", borderRadius:10 },
  actBtnRed: { backgroundColor:"rgba(239,68,68,0.08)" },
  actBtnText: { fontSize:12, fontWeight:"800", color:"#FFB800", textTransform:"capitalize" },
  empty: { flex:1, alignItems:"center", justifyContent:"center", gap:10 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"rgba(255,255,255,0.3)" },
});
