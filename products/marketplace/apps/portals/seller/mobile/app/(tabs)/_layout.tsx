import { Tabs } from "expo-router";
import { LayoutDashboard, Package, Video, ShoppingBag, BarChart3 } from "lucide-react-native";

export default function SellerTabs() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#FFB800",
      tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
      tabBarStyle: { backgroundColor:"#111", borderTopColor:"rgba(255,255,255,0.06)", height:82, paddingBottom:24, paddingTop:10 },
      tabBarLabelStyle: { fontSize:10, fontWeight:"700", marginTop:2 },
    }}>
      <Tabs.Screen name="index"     options={{ title:"Dashboard", tabBarIcon:({color,focused}) => <LayoutDashboard size={22} color={color} strokeWidth={focused?2.5:1.8} /> }} />
      <Tabs.Screen name="products"  options={{ title:"Products",  tabBarIcon:({color,focused}) => <Package size={22} color={color} strokeWidth={focused?2.5:1.8} /> }} />
      <Tabs.Screen name="reels"     options={{ title:"Reels",     tabBarIcon:({color,focused}) => <Video size={22} color={color} strokeWidth={focused?2.5:1.8} /> }} />
      <Tabs.Screen name="orders"    options={{ title:"Orders",    tabBarIcon:({color,focused}) => <ShoppingBag size={22} color={color} strokeWidth={focused?2.5:1.8} /> }} />
      <Tabs.Screen name="analytics" options={{ title:"Analytics", tabBarIcon:({color,focused}) => <BarChart3 size={22} color={color} strokeWidth={focused?2.5:1.8} /> }} />
    </Tabs>
  );
}
