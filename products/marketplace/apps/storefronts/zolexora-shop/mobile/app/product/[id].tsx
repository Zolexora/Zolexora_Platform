import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ShoppingCart, Zap, Star, Shield, Truck, RefreshCw, Plus, Minus } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { productsApi } from "../../src/lib/api";
import { useAuthStore, useCartStore } from "../../src/store";
import Toast from "react-native-toast-message";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { increment } = useCartStore();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => { productsApi.get(id).then(setProduct).finally(() => setLoading(false)); }, [id]);

  const handleAddToCart = async () => {
    if (!user) { router.push("/auth"); return; }
    setAdding(true);
    try {
      const { cartApi } = await import("../../src/lib/api");
      await cartApi.add(product.id, qty);
      increment();
      Toast.show({ type: "success", text1: "Added to cart!", text2: product.title, visibilityTime: 2000 });
    } catch { Toast.show({ type: "error", text1: "Failed" }); }
    finally { setAdding(false); }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    router.push("/(tabs)/cart");
  };

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large" /></View>;
  if (!product) return null;

  const disc = product.discount_percent ? Math.round(product.discount_percent) : null;
  const w = Dimensions.get("window").width;

  return (
    <View style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={ss.imgContainer}>
          <Image source={{ uri: product.images?.[activeImg] || "" }} style={[ss.mainImg, { width: w }]} resizeMode="contain" />
          {disc && <View style={ss.discBadge}><Text style={ss.discText}>-{disc}%</Text></View>}
          <TouchableOpacity style={ss.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={20} color="#111" />
          </TouchableOpacity>
          {product.images?.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.thumbs}>
              {product.images.map((img: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => setActiveImg(i)} style={[ss.thumb, activeImg === i && ss.thumbActive]}>
                  <Image source={{ uri: img }} style={ss.thumbImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={ss.info}>
          <Text style={ss.category}>{product.category}</Text>
          <Text style={ss.title}>{product.title}</Text>
          {product.seller_name && <Text style={ss.seller}>by {product.seller_name}</Text>}

          {product.rating > 0 && (
            <View style={ss.ratingRow}>
              <View style={ss.ratingBadge}>
                <Star size={12} color="#fff" fill="#fff" />
                <Text style={ss.ratingText}>{product.rating.toFixed(1)}</Text>
              </View>
              <Text style={ss.ratingCount}>{product.reviews_count} ratings</Text>
            </View>
          )}

          <View style={ss.priceRow}>
            <Text style={ss.price}>₹{product.price?.toLocaleString("en-IN")}</Text>
            {product.original_price > product.price && (
              <>
                <Text style={ss.origPrice}>₹{product.original_price?.toLocaleString("en-IN")}</Text>
                <View style={ss.saveBadge}><Text style={ss.saveText}>{disc}% off</Text></View>
              </>
            )}
          </View>

          <Text style={ss.desc}>{product.description}</Text>

          {/* Trust badges */}
          <View style={ss.trustRow}>
            {[{ icon: Truck, text: "Fast Delivery" }, { icon: Shield, text: "Buyer Protection" }, { icon: RefreshCw, text: "Easy Returns" }].map(({ icon: Icon, text }) => (
              <View key={text} style={ss.trustItem}>
                <Icon size={14} color="#FFB800" />
                <Text style={ss.trustText}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Quantity */}
          <View style={ss.qtyRow}>
            <Text style={ss.qtyLabel}>Qty:</Text>
            <View style={ss.qtyControl}>
              <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={ss.qtyBtn}>
                <Minus size={14} color="#111" />
              </TouchableOpacity>
              <Text style={ss.qtyNum}>{qty}</Text>
              <TouchableOpacity onPress={() => setQty(Math.min(product.stock || 10, qty + 1))} style={ss.qtyBtn}>
                <Plus size={14} color="#111" />
              </TouchableOpacity>
            </View>
            <Text style={ss.stock}>{product.stock} in stock</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA bar */}
      <Animated.View entering={FadeIn} style={ss.ctaBar}>
        <TouchableOpacity style={ss.addToCartBtn} onPress={handleAddToCart} disabled={adding}>
          <ShoppingCart size={16} color="#111" />
          <Text style={ss.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ss.buyNowBtn} onPress={handleBuyNow}>
          <Zap size={16} color="#111" />
          <Text style={ss.buyNowText}>Buy Now</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  imgContainer: { backgroundColor: "#fff", position: "relative" },
  mainImg: { height: 320, backgroundColor: "#F5F5F5" },
  discBadge: { position: "absolute", top: 56, right: 16, backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  discText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  backBtn: { position: "absolute", top: 48, left: 16, width: 36, height: 36, backgroundColor: "#fff", borderRadius: 12, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  thumbs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  thumbActive: { borderColor: "#FFB800" },
  thumbImg: { width: "100%", height: "100%", resizeMode: "cover" },
  info: { padding: 20, gap: 8 },
  category: { fontSize: 11, color: "#AAA", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: "900", color: "#111", lineHeight: 26 },
  seller: { fontSize: 12, color: "#888" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22C55E", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ratingText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  ratingCount: { fontSize: 12, color: "#888" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F0F0F0" },
  price: { fontSize: 26, fontWeight: "900", color: "#111" },
  origPrice: { fontSize: 16, color: "#BBB", textDecorationLine: "line-through" },
  saveBadge: { backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { fontSize: 11, fontWeight: "700", color: "#EF4444" },
  desc: { fontSize: 13, color: "#666", lineHeight: 20 },
  trustRow: { flexDirection: "row", gap: 8 },
  trustItem: { flex: 1, flexDirection: "column", alignItems: "center", gap: 4, backgroundColor: "#FAFAF8", borderRadius: 14, padding: 10 },
  trustText: { fontSize: 10, fontWeight: "600", color: "#555", textAlign: "center" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyLabel: { fontSize: 14, fontWeight: "700", color: "#111" },
  qtyControl: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: 12, overflow: "hidden" },
  qtyBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  qtyNum: { width: 36, textAlign: "center", fontSize: 15, fontWeight: "800", color: "#111" },
  stock: { fontSize: 11, color: "#AAA", marginLeft: "auto" },
  ctaBar: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 32, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  addToCartBtn: { flex: 1, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderColor: "#111", borderRadius: 16 },
  addToCartText: { fontSize: 14, fontWeight: "900", color: "#111" },
  buyNowBtn: { flex: 1, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFB800", borderRadius: 16 },
  buyNowText: { fontSize: 14, fontWeight: "900", color: "#111" },
});
