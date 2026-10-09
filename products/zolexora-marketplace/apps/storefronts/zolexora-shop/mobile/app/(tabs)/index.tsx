import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Image, Dimensions, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, Sparkles, ArrowRight, Coins } from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { productsApi } from "../../src/lib/api";
import { useAuthStore, useCartStore } from "../../src/store";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const CATS = [
  { name:"Electronics", emoji:"⚡", bg:"#EFF6FF" },
  { name:"Fashion", emoji:"👗", bg:"#FDF2F8" },
  { name:"Home & Living", emoji:"🏡", bg:"#F0FDF4" },
  { name:"Beauty", emoji:"✨", bg:"#FAF5FF" },
  { name:"Sports", emoji:"🏃", bg:"#FFF7ED" },
  { name:"Food", emoji:"☕", bg:"#FFFBEB" },
];

function ProductCard({ item, index, onAddToCart }: any) {
  const router = useRouter();
  const disc = item.discount_percent ? Math.round(item.discount_percent) : null;
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <TouchableOpacity style={ss.productCard} onPress={() => router.push(`/product/${item.id}`)} activeOpacity={0.92}>
        <View style={ss.productImgBox}>
          {item.images?.[0]
            ? <Image source={{ uri: item.images[0] }} style={ss.productImg} />
            : <Text style={{ fontSize:28 }}>📦</Text>}
          {disc && <View style={ss.discBadge}><Text style={ss.discText}>-{disc}%</Text></View>}
        </View>
        <View style={ss.productInfo}>
          <Text style={ss.productCat} numberOfLines={1}>{item.category}</Text>
          <Text style={ss.productTitle} numberOfLines={2}>{item.title}</Text>
          <View style={ss.priceRow}>
            <Text style={ss.price}>₹{item.price?.toLocaleString("en-IN")}</Text>
            {item.original_price > item.price && (
              <Text style={ss.originalPrice}>₹{item.original_price?.toLocaleString("en-IN")}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={ss.addBtn} onPress={() => onAddToCart(item)} activeOpacity={0.8}>
          <Text style={ss.addBtnText}>Add</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { increment } = useCartStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await productsApi.list({ limit: 20, sort: "newest" });
      setProducts(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleAddToCart = async (product: any) => {
    if (!user) { router.push("/auth"); return; }
    try {
      const { cartApi } = await import("../../src/lib/api");
      await cartApi.add(product.id);
      increment();
      Toast.show({ type:"success", text1:"Added to cart", text2:product.title, visibilityTime:2000 });
    } catch { Toast.show({ type:"error", text1:"Failed to add" }); }
  };

  const handleSearch = () => {
    if (search.trim()) router.push(`/(tabs)/shop?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <View style={ss.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FFB800" />}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)} style={ss.header}>
          <View>
            <Text style={ss.greeting}>Hello{user ? `, ${user.name?.split(" ")[0]}` : ""} 👋</Text>
            <Text style={ss.subGreeting}>What are you shopping for?</Text>
          </View>
          {user && (
            <TouchableOpacity style={ss.coinPill} onPress={() => router.push("/(tabs)/wallet")}>
              <Coins size={14} color="#111" />
              <Text style={ss.coinText}>{user.coin_balance}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Search bar */}
        <Animated.View entering={FadeInDown.delay(100)} style={ss.searchBox}>
          <Search size={17} color="#999" style={{ marginRight:8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            placeholder="Search products..."
            placeholderTextColor="#BBB"
            style={ss.searchInput}
            returnKeyType="search"
          />
        </Animated.View>

        {/* Hero Banner */}
        <Animated.View entering={FadeInDown.delay(150)} style={ss.heroBanner}>
          <View style={ss.heroContent}>
            <View style={ss.heroBadge}><Sparkles size={11} color="#FFB800" /><Text style={ss.heroBadgeText}>New Arrivals</Text></View>
            <Text style={ss.heroTitle}>Electronics{"\n"}Reimagined</Text>
            <Text style={ss.heroSub}>Up to 40% off today</Text>
            <TouchableOpacity style={ss.heroCta} onPress={() => router.push("/(tabs)/shop")}>
              <Text style={ss.heroCtaText}>Shop Now</Text>
              <ArrowRight size={14} color="#111" />
            </TouchableOpacity>
          </View>
          <Image source={{ uri:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" }}
            style={ss.heroImg} />
        </Animated.View>

        {/* Categories */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Shop by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:10 }}>
            {CATS.map((c, i) => (
              <Animated.View key={c.name} entering={FadeInDown.delay(200 + i*40)}>
                <TouchableOpacity style={[ss.catChip, { backgroundColor: c.bg }]}
                  onPress={() => router.push(`/(tabs)/shop?category=${c.name}`)}>
                  <Text style={{ fontSize:20 }}>{c.emoji}</Text>
                  <Text style={ss.catLabel}>{c.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </ScrollView>
        </View>

        {/* Earn coins banner */}
        <Animated.View entering={FadeInDown.delay(300)} style={ss.earnBanner}>
          <View>
            <Text style={ss.earnTitle}>Earn Coins 🪙</Text>
            <Text style={ss.earnSub}>Watch reels & earn up to 150 coins/day. Use them for discounts!</Text>
          </View>
        </Animated.View>

        {/* Products */}
        <View style={ss.section}>
          <View style={ss.sectionRow}>
            <Text style={ss.sectionTitle}>Featured Products</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/shop")}>
              <Text style={ss.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={ss.productsGrid}>
              {Array.from({length:6}).map((_,i) => (
                <View key={i} style={[ss.productCard, { backgroundColor:"#F0F0F0" }]}>
                  <View style={[ss.productImgBox, { backgroundColor:"#E0E0E0" }]} />
                  <View style={{ padding:10, gap:6 }}>
                    <View style={{ height:10, backgroundColor:"#E0E0E0", borderRadius:5, width:"60%" }} />
                    <View style={{ height:14, backgroundColor:"#E0E0E0", borderRadius:5 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={ss.productsGrid}>
              {products.map((p, i) => (
                <ProductCard key={p.id} item={p} index={i} onAddToCart={handleAddToCart} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height:32 }} />
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#FAFAF8" },
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:56, paddingBottom:16, backgroundColor:"#fff" },
  greeting: { fontSize:20, fontWeight:"800", color:"#111" },
  subGreeting: { fontSize:13, color:"#888", marginTop:2 },
  coinPill: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"#FFB800", paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  coinText: { fontSize:13, fontWeight:"800", color:"#111" },
  searchBox: { flexDirection:"row", alignItems:"center", marginHorizontal:16, marginBottom:16, backgroundColor:"#fff", borderRadius:14, paddingHorizontal:14, height:46, borderWidth:1.5, borderColor:"#F0F0F0" },
  searchInput: { flex:1, fontSize:14, color:"#111" },
  heroBanner: { marginHorizontal:16, backgroundColor:"#1C1C1C", borderRadius:22, padding:22, flexDirection:"row", alignItems:"center", overflow:"hidden", marginBottom:8 },
  heroContent: { flex:1 },
  heroBadge: { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"rgba(255,184,0,0.15)", paddingHorizontal:10, paddingVertical:4, borderRadius:20, alignSelf:"flex-start", marginBottom:10 },
  heroBadgeText: { fontSize:11, fontWeight:"700", color:"#FFB800" },
  heroTitle: { fontSize:24, fontWeight:"900", color:"#fff", lineHeight:28, marginBottom:6 },
  heroSub: { fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:14 },
  heroCta: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FFB800", paddingHorizontal:16, paddingVertical:9, borderRadius:12, alignSelf:"flex-start" },
  heroCtaText: { fontSize:12, fontWeight:"800", color:"#111" },
  heroImg: { width:90, height:90, borderRadius:16, resizeMode:"cover" },
  section: { paddingHorizontal:16, marginTop:20 },
  sectionTitle: { fontSize:16, fontWeight:"800", color:"#111", marginBottom:12 },
  sectionRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  seeAll: { fontSize:13, fontWeight:"700", color:"#FFB800" },
  catChip: { alignItems:"center", justifyContent:"center", width:72, height:72, borderRadius:18, gap:4 },
  catLabel: { fontSize:10, fontWeight:"700", color:"#333" },
  earnBanner: { marginHorizontal:16, marginTop:20, backgroundColor:"#FFF8E1", borderRadius:18, padding:16, borderWidth:1.5, borderColor:"#FFE082" },
  earnTitle: { fontSize:15, fontWeight:"800", color:"#111", marginBottom:4 },
  earnSub: { fontSize:12, color:"#666", lineHeight:17 },
  productsGrid: { flexDirection:"row", flexWrap:"wrap", gap:12 },
  productCard: { width:(width-44)/2, backgroundColor:"#fff", borderRadius:18, overflow:"hidden" },
  productImgBox: { width:"100%", aspectRatio:1, backgroundColor:"#F5F5F5", alignItems:"center", justifyContent:"center" },
  productImg: { width:"100%", height:"100%", resizeMode:"cover" },
  discBadge: { position:"absolute", top:8, left:8, backgroundColor:"#EF4444", borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  discText: { fontSize:10, fontWeight:"800", color:"#fff" },
  productInfo: { padding:10, gap:2 },
  productCat: { fontSize:10, color:"#AAA", fontWeight:"600", textTransform:"uppercase" },
  productTitle: { fontSize:13, fontWeight:"700", color:"#111", lineHeight:17 },
  priceRow: { flexDirection:"row", alignItems:"center", gap:6, marginTop:2 },
  price: { fontSize:14, fontWeight:"900", color:"#111" },
  originalPrice: { fontSize:11, color:"#BBB", textDecorationLine:"line-through" },
  addBtn: { marginHorizontal:10, marginBottom:10, backgroundColor:"#FFB800", borderRadius:10, paddingVertical:8, alignItems:"center" },
  addBtnText: { fontSize:12, fontWeight:"800", color:"#111" },
});
