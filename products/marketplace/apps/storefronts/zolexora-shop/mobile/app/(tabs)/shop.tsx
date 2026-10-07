import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, FlatList, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Search, X, SlidersHorizontal } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { productsApi } from "../../src/lib/api";
import { useAuthStore, useCartStore } from "../../src/store";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const CATS = ["All","Electronics","Fashion","Home & Living","Beauty","Sports","Food"];
const SORTS = [{ value:"newest",label:"Newest" },{ value:"price_asc",label:"Price ↑" },{ value:"price_desc",label:"Price ↓" },{ value:"popular",label:"Popular" }];

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const { user } = useAuthStore();
  const { increment } = useCartStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(params.q || "");
  const [activeSearch, setActiveSearch] = useState(params.q || "");
  const [category, setCategory] = useState(params.category || "All");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 16;

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const skip = reset ? 0 : page * LIMIT;
    try {
      const p: any = { limit:LIMIT, skip, sort };
      if (category !== "All") p.category = category;
      if (activeSearch) p.search = activeSearch;
      const data = await productsApi.list(p);
      setProducts(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === LIMIT);
      if (reset) setPage(1); else setPage(p => p + 1);
    } catch {}
    finally { setLoading(false); setLoadingMore(false); }
  }, [category, sort, activeSearch]);

  useEffect(() => { load(true); }, [category, sort, activeSearch]);

  const handleAddToCart = async (product: any) => {
    if (!user) { router.push("/auth"); return; }
    try {
      const { cartApi } = await import("../../src/lib/api");
      await cartApi.add(product.id);
      increment();
      Toast.show({ type:"success", text1:"Added!", text2:product.title, visibilityTime:1800 });
    } catch {}
  };

  const renderProduct = ({ item, index }: any) => {
    const disc = item.discount_percent ? Math.round(item.discount_percent) : null;
    return (
      <Animated.View entering={FadeInDown.delay((index % LIMIT) * 40)} style={ss.card}>
        <TouchableOpacity onPress={() => router.push(`/product/${item.id}`)} activeOpacity={0.9}>
          <View style={ss.imgBox}>
            {item.images?.[0]
              ? <Image source={{ uri:item.images[0] }} style={ss.img} />
              : <Text style={{ fontSize:32 }}>📦</Text>}
            {disc && <View style={ss.badge}><Text style={ss.badgeText}>-{disc}%</Text></View>}
          </View>
          <View style={ss.info}>
            <Text style={ss.catText}>{item.category}</Text>
            <Text style={ss.titleText} numberOfLines={2}>{item.title}</Text>
            <Text style={ss.priceText}>₹{item.price?.toLocaleString("en-IN")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={ss.addBtn} onPress={() => handleAddToCart(item)}>
          <Text style={ss.addBtnText}>+ Cart</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={ss.container}>
      {/* Header */}
      <View style={ss.header}>
        <Text style={ss.title}>Shop</Text>
        <Text style={ss.count}>{products.length} products</Text>
      </View>

      {/* Search */}
      <View style={ss.searchRow}>
        <View style={ss.searchBox}>
          <Search size={16} color="#999" />
          <TextInput value={search} onChangeText={setSearch}
            onSubmitEditing={() => setActiveSearch(search)}
            placeholder="Search products..." placeholderTextColor="#BBB"
            style={ss.searchInput} returnKeyType="search" />
          {activeSearch ? (
            <TouchableOpacity onPress={() => { setSearch(""); setActiveSearch(""); }}>
              <X size={16} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.catScroll}>
        {CATS.map(c => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[ss.catPill, category===c && ss.catPillActive]}>
            <Text style={[ss.catPillText, category===c && ss.catPillTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.sortScroll}>
        {SORTS.map(s => (
          <TouchableOpacity key={s.value} onPress={() => setSort(s.value)} style={[ss.sortPill, sort===s.value && ss.sortPillActive]}>
            <Text style={[ss.sortText, sort===s.value && ss.sortTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products */}
      {loading ? (
        <View style={ss.loadingBox}><ActivityIndicator color="#FFB800" size="large" /></View>
      ) : products.length === 0 ? (
        <View style={ss.emptyBox}>
          <Text style={{ fontSize:40, marginBottom:12 }}>🔍</Text>
          <Text style={ss.emptyTitle}>No products found</Text>
          <Text style={ss.emptySub}>Try a different search or category</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={ss.row}
          contentContainerStyle={ss.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (hasMore && !loadingMore) load(false); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#FFB800" style={{ marginVertical:20 }} /> : null}
        />
      )}
    </View>
  );
}

const CARD = (width - 44) / 2;
const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#FAFAF8" },
  header: { flexDirection:"row", alignItems:"baseline", gap:8, paddingHorizontal:20, paddingTop:56, paddingBottom:12, backgroundColor:"#fff" },
  title: { fontSize:22, fontWeight:"900", color:"#111" },
  count: { fontSize:12, color:"#AAA", fontWeight:"600" },
  searchRow: { paddingHorizontal:16, paddingBottom:12, backgroundColor:"#fff" },
  searchBox: { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#F5F5F3", borderRadius:14, paddingHorizontal:14, height:44 },
  searchInput: { flex:1, fontSize:14, color:"#111" },
  catScroll: { paddingHorizontal:16, paddingBottom:12, gap:8, backgroundColor:"#fff" },
  catPill: { paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:"#F5F5F3", borderWidth:1.5, borderColor:"transparent" },
  catPillActive: { backgroundColor:"#111", borderColor:"#111" },
  catPillText: { fontSize:12, fontWeight:"700", color:"#666" },
  catPillTextActive: { color:"#fff" },
  sortScroll: { paddingHorizontal:16, paddingBottom:8, gap:6 },
  sortPill: { paddingHorizontal:12, paddingVertical:5, borderRadius:16, backgroundColor:"#F5F5F3" },
  sortPillActive: { backgroundColor:"#FFB800" },
  sortText: { fontSize:11, fontWeight:"700", color:"#666" },
  sortTextActive: { color:"#111" },
  list: { paddingHorizontal:16, paddingTop:12, paddingBottom:100 },
  row: { justifyContent:"space-between", marginBottom:12 },
  card: { width:CARD, backgroundColor:"#fff", borderRadius:18, overflow:"hidden" },
  imgBox: { width:"100%", aspectRatio:1, backgroundColor:"#F5F5F5", alignItems:"center", justifyContent:"center" },
  img: { width:"100%", height:"100%", resizeMode:"cover" },
  badge: { position:"absolute", top:8, left:8, backgroundColor:"#EF4444", borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  badgeText: { fontSize:9, fontWeight:"900", color:"#fff" },
  info: { padding:10, gap:2 },
  catText: { fontSize:10, color:"#AAA", fontWeight:"700", textTransform:"uppercase" },
  titleText: { fontSize:12, fontWeight:"700", color:"#111", lineHeight:16 },
  priceText: { fontSize:14, fontWeight:"900", color:"#111", marginTop:2 },
  addBtn: { marginHorizontal:10, marginBottom:10, backgroundColor:"#FFB800", borderRadius:10, paddingVertical:7, alignItems:"center" },
  addBtnText: { fontSize:12, fontWeight:"800", color:"#111" },
  loadingBox: { flex:1, alignItems:"center", justifyContent:"center" },
  emptyBox: { flex:1, alignItems:"center", justifyContent:"center", paddingBottom:80 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"#555" },
  emptySub: { fontSize:13, color:"#AAA", marginTop:4 },
});
