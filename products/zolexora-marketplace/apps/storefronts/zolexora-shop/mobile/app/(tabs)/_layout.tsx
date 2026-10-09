import { Tabs } from "expo-router";
import { Home, Search, ShoppingCart, Coins, Package } from "lucide-react-native";
import { useCartStore } from "../../src/store";
import { View, Text, StyleSheet } from "react-native";

function TabIcon({ icon: Icon, color, focused }: any) {
  return <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />;
}

function CartIcon({ color, focused }: any) {
  const count = useCartStore(s => s.count);
  return (
    <View>
      <ShoppingCart size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position:"absolute", top:-4, right:-6, minWidth:16, height:16, backgroundColor:"#FFB800", borderRadius:8, alignItems:"center", justifyContent:"center", paddingHorizontal:2 },
  badgeText: { color:"#111", fontSize:9, fontWeight:"900" },
});

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#111111",
      tabBarInactiveTintColor: "#AAAAAA",
      tabBarStyle: { backgroundColor:"#fff", borderTopColor:"#F0F0F0", height:82, paddingBottom:24, paddingTop:10 },
      tabBarLabelStyle: { fontSize:10, fontWeight:"600", marginTop:2 },
    }}>
      <Tabs.Screen name="index" options={{ title:"Home", tabBarIcon:(p) => <TabIcon icon={Home} {...p} /> }} />
      <Tabs.Screen name="shop" options={{ title:"Shop", tabBarIcon:(p) => <TabIcon icon={Search} {...p} /> }} />
      <Tabs.Screen name="cart" options={{ title:"Cart", tabBarIcon:(p) => <CartIcon {...p} /> }} />
      <Tabs.Screen name="wallet" options={{ title:"Wallet", tabBarIcon:(p) => <TabIcon icon={Coins} {...p} /> }} />
      <Tabs.Screen name="orders" options={{ title:"Orders", tabBarIcon:(p) => <TabIcon icon={Package} {...p} /> }} />
    </Tabs>
  );
}
