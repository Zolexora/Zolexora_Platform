import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Pencil, Trash2, Eye, EyeOff, Package, Search } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { productsApi } from "../../src/lib/api";
import Toast from "react-native-toast-message";

export default function SellerProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string|null>(null);

  useEffect(() => { productsApi.my().then(setProducts).finally(() => setLoading(false)); }, []);

  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = async (p: any) => {
    try {
      await productsApi.update(p.id, { is_active: !p.is_active } as any);
      setProducts(ps => ps.map(x => x.id===p.id ? { ...x, is_active:!p.is_active } : x));
      Toast.show({ type:"success", text1:p.is_active?"Product hidden":"Product listed" });
    } catch { Toast.show({ type:"error", text1:"Failed" }); }
  };

  const handleDelete = (p: any) => {
    Alert.alert("Delete Product", `Delete "${p.title}"?`, [
      { text:"Cancel", style:"cancel" },
      { text:"Delete", style:"destructive", onPress: async () => {
        await productsApi.delete(p.id);
        setProducts(ps => ps.filter(x => x.id!==p.id));
        Toast.show({ type:"success", text1:"Deleted" });
      }},
    ]);
  };

  const handleAddImage = async (productId: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaTypeOptions.Images, quality:0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(productId);
    try {
      const uploaded = await productsApi.uploadImage(productId, res.assets[0].uri);
      setProducts(ps => ps.map(p => p.id===productId ? { ...p, images:[...(p.images||[]), uploaded.image_url] } : p));
      Toast.show({ type:"success", text1:"Image uploaded" });
    } catch { Toast.show({ type:"error", text1:"Upload failed" }); }
    finally { setUploading(null); }
  };

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;

  return (
    <View style={ss.container}>
      <View style={ss.header}>
        <Text style={ss.title}>Products</Text>
        <TouchableOpacity style={ss.addBtn} onPress={() => router.push("/product-form")}>
          <Plus size={18} color="#111" />
          <Text style={ss.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={ss.searchBox}>
        <Search size={15} color="rgba(255,255,255,0.3)" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor="rgba(255,255,255,0.2)"
          style={ss.searchInput} />
      </View>

      {filtered.length === 0 ? (
        <View style={ss.empty}>
          <Package size={40} color="rgba(255,255,255,0.1)" />
          <Text style={ss.emptyTitle}>{search ? "No matches" : "No products yet"}</Text>
          {!search && <TouchableOpacity style={ss.createBtn} onPress={() => router.push("/product-form")}><Text style={ss.createBtnText}>Add First Product</Text></TouchableOpacity>}
        </View>
      ) : (
        <FlatList data={filtered} keyExtractor={i=>i.id} contentContainerStyle={ss.list} showsVerticalScrollIndicator={false}
          renderItem={({ item:p, index }) => (
            <Animated.View entering={FadeInDown.delay(index*50)} style={[ss.card, !p.is_active && ss.cardInactive]}>
              <View style={ss.cardLeft}>
                {p.images?.[0]
                  ? <Image source={{ uri:p.images[0] }} style={ss.img} />
                  : <View style={[ss.img, ss.imgPlaceholder]}><Text style={{ fontSize:24 }}>📦</Text></View>}
                <TouchableOpacity style={ss.imgUploadBtn} onPress={() => handleAddImage(p.id)} disabled={uploading===p.id}>
                  <Text style={{ fontSize:12 }}>{uploading===p.id?"⏳":"📷"}</Text>
                </TouchableOpacity>
              </View>
              <View style={ss.cardInfo}>
                <Text style={ss.cardTitle} numberOfLines={2}>{p.title}</Text>
                <Text style={ss.cardCat}>{p.category}</Text>
                <View style={ss.priceRow}>
                  <Text style={ss.price}>₹{p.price?.toLocaleString("en-IN")}</Text>
                  {p.original_price > p.price && <Text style={ss.origPrice}>₹{p.original_price?.toLocaleString("en-IN")}</Text>}
                </View>
                <Text style={ss.stock}>{p.stock} in stock</Text>
              </View>
              <View style={ss.cardActions}>
                <TouchableOpacity style={ss.actionBtn} onPress={() => router.push({ pathname:"/product-form", params:{ id:p.id, data:JSON.stringify(p) }})}>
                  <Pencil size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
                <TouchableOpacity style={ss.actionBtn} onPress={() => handleToggle(p)}>
                  {p.is_active ? <EyeOff size={14} color="#D97706" /> : <Eye size={14} color="#16A34A" />}
                </TouchableOpacity>
                <TouchableOpacity style={ss.actionBtn} onPress={() => handleDelete(p)}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#111" },
  centered: { flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:56, paddingBottom:16 },
  title: { fontSize:22, fontWeight:"900", color:"#fff" },
  addBtn: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FFB800", borderRadius:14, paddingHorizontal:14, paddingVertical:8 },
  addBtnText: { fontSize:13, fontWeight:"900", color:"#111" },
  searchBox: { flexDirection:"row", alignItems:"center", gap:10, marginHorizontal:16, backgroundColor:"rgba(255,255,255,0.06)", borderRadius:14, paddingHorizontal:14, height:44, marginBottom:12 },
  searchInput: { flex:1, fontSize:14, color:"#fff" },
  list: { padding:16, gap:12 },
  card: { flexDirection:"row", gap:12, backgroundColor:"rgba(255,255,255,0.05)", borderRadius:18, padding:12, borderWidth:1, borderColor:"rgba(255,255,255,0.06)" },
  cardInactive: { opacity:0.5 },
  cardLeft: { position:"relative" },
  img: { width:72, height:72, borderRadius:14, resizeMode:"cover" },
  imgPlaceholder: { backgroundColor:"rgba(255,255,255,0.06)", alignItems:"center", justifyContent:"center" },
  imgUploadBtn: { position:"absolute", bottom:-4, right:-4, width:24, height:24, backgroundColor:"#FFB800", borderRadius:8, alignItems:"center", justifyContent:"center" },
  cardInfo: { flex:1, gap:2 },
  cardTitle: { fontSize:13, fontWeight:"700", color:"#fff", lineHeight:17 },
  cardCat: { fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:"600", textTransform:"uppercase" },
  priceRow: { flexDirection:"row", alignItems:"center", gap:6, marginTop:2 },
  price: { fontSize:15, fontWeight:"900", color:"#FFB800" },
  origPrice: { fontSize:11, color:"rgba(255,255,255,0.25)", textDecorationLine:"line-through" },
  stock: { fontSize:10, color:"rgba(255,255,255,0.25)" },
  cardActions: { gap:6, justifyContent:"center" },
  actionBtn: { width:32, height:32, backgroundColor:"rgba(255,255,255,0.06)", borderRadius:10, alignItems:"center", justifyContent:"center" },
  empty: { flex:1, alignItems:"center", justifyContent:"center", gap:12 },
  emptyTitle: { fontSize:16, fontWeight:"800", color:"rgba(255,255,255,0.3)" },
  createBtn: { backgroundColor:"#FFB800", borderRadius:16, paddingHorizontal:20, paddingVertical:10 },
  createBtnText: { fontSize:13, fontWeight:"800", color:"#111" },
});
