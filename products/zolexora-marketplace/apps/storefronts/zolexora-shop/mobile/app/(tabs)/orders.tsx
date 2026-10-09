import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { Package, ChevronDown, ChevronUp, CheckCircle, Truck, Clock, XCircle } from "lucide-react-native";
import { ordersApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";

const S: Record<string,any> = {
  pending:    { label:"Pending",    bg:"#FFF7ED", tc:"#D97706", icon:Clock },
  processing: { label:"Processing", bg:"#EFF6FF", tc:"#2563EB", icon:Package },
  shipped:    { label:"Shipped",    bg:"#F5F3FF", tc:"#7C3AED", icon:Truck },
  delivered:  { label:"Delivered",  bg:"#F0FDF4", tc:"#16A34A", icon:CheckCircle },
  cancelled:  { label:"Cancelled",  bg:"#FEF2F2", tc:"#DC2626", icon:XCircle },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string|null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    ordersApi.my().then(setOrders).finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <View style={ss.centered}>
      <Package size={48} color="#E0E0E0" />
      <Text style={ss.emptyTitle}>Sign in to view orders</Text>
      <TouchableOpacity style={ss.signInBtn} onPress={() => router.push("/auth")}>
        <Text style={ss.signInText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  if (orders.length === 0) return (
    <View style={ss.centered}>
      <Package size={48} color="#E0E0E0" />
      <Text style={ss.emptyTitle}>No orders yet</Text>
      <TouchableOpacity style={ss.shopBtn} onPress={() => router.push("/(tabs)/shop")}>
        <Text style={ss.shopBtnText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={ss.container} showsVerticalScrollIndicator={false}>
      <View style={ss.header}><Text style={ss.title}>My Orders</Text></View>
      <View style={ss.list}>
        {orders.map(order => {
          const cfg = S[order.status] || S.pending;
          const Icon = cfg.icon;
          const exp = expanded === order.id;
          return (
            <View key={order.id} style={ss.card}>
              <TouchableOpacity style={ss.cardHeader} onPress={() => setExpanded(exp ? null : order.id)} activeOpacity={0.8}>
                <View style={[ss.statusIcon, { backgroundColor: cfg.bg }]}>
                  <Icon size={18} color={cfg.tc} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={ss.orderId}>#{order.id.slice(0,8).toUpperCase()}</Text>
                  <Text style={ss.orderMeta}>{order.items?.length} item{order.items?.length!==1?"s":""} · ₹{order.total_paid?.toLocaleString("en-IN")} · {new Date(order.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</Text>
                </View>
                <View style={[ss.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[ss.statusText, { color: cfg.tc }]}>{cfg.label}</Text>
                </View>
                {exp ? <ChevronUp size={16} color="#AAA" /> : <ChevronDown size={16} color="#AAA" />}
              </TouchableOpacity>

              {exp && (
                <View style={ss.cardBody}>
                  {order.items?.map((item: any) => (
                    <View key={item.product_id} style={ss.itemRow}>
                      {item.image && <Image source={{ uri:item.image }} style={ss.itemImg} />}
                      <View style={{ flex:1 }}>
                        <Text style={ss.itemTitle} numberOfLines={1}>{item.product_title}</Text>
                        <Text style={ss.itemMeta}>Qty {item.quantity} × ₹{item.price?.toLocaleString("en-IN")}</Text>
                      </View>
                      <Text style={ss.itemTotal}>₹{(item.price*item.quantity)?.toLocaleString("en-IN")}</Text>
                    </View>
                  ))}
                  {order.coins_discount > 0 && (
                    <View style={ss.summaryRow}>
                      <Text style={ss.summaryLabel}>Coin discount</Text>
                      <Text style={[ss.summaryVal,{color:"#22C55E"}]}>-₹{order.coins_discount}</Text>
                    </View>
                  )}
                  <View style={ss.summaryRow}>
                    <Text style={[ss.summaryLabel,{fontWeight:"800",color:"#111"}]}>Total paid</Text>
                    <Text style={[ss.summaryVal,{fontWeight:"900",color:"#111"}]}>₹{order.total_paid?.toLocaleString("en-IN")}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <View style={{ height:40 }} />
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#FAFAF8" },
  header: { paddingHorizontal:20, paddingTop:56, paddingBottom:14, backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#F0F0F0" },
  title: { fontSize:22, fontWeight:"900", color:"#111" },
  list: { padding:16, gap:12 },
  card: { backgroundColor:"#fff", borderRadius:20, overflow:"hidden" },
  cardHeader: { flexDirection:"row", alignItems:"center", gap:10, padding:14 },
  statusIcon: { width:42, height:42, borderRadius:14, alignItems:"center", justifyContent:"center" },
  orderId: { fontSize:13, fontWeight:"800", color:"#111" },
  orderMeta: { fontSize:11, color:"#888", marginTop:1 },
  statusBadge: { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  statusText: { fontSize:11, fontWeight:"700" },
  cardBody: { paddingHorizontal:14, paddingBottom:14, gap:10, borderTopWidth:1, borderTopColor:"#F5F5F5" },
  itemRow: { flexDirection:"row", alignItems:"center", gap:10, paddingTop:10 },
  itemImg: { width:44, height:44, borderRadius:12, resizeMode:"cover", backgroundColor:"#F5F5F5" },
  itemTitle: { fontSize:13, fontWeight:"600", color:"#111" },
  itemMeta: { fontSize:11, color:"#AAA", marginTop:1 },
  itemTotal: { fontSize:13, fontWeight:"800", color:"#111" },
  summaryRow: { flexDirection:"row", justifyContent:"space-between", paddingTop:8, borderTopWidth:1, borderTopColor:"#F5F5F5" },
  summaryLabel: { fontSize:13, color:"#888" },
  summaryVal: { fontSize:13, fontWeight:"700", color:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", gap:12 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"#555" },
  shopBtn: { backgroundColor:"#FFB800", borderRadius:16, paddingHorizontal:24, paddingVertical:12 },
  shopBtnText: { fontSize:14, fontWeight:"800", color:"#111" },
  signInBtn: { backgroundColor:"#111", borderRadius:16, paddingHorizontal:24, paddingVertical:12 },
  signInText: { fontSize:14, fontWeight:"800", color:"#fff" },
});
