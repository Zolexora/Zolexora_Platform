import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Check } from "lucide-react-native";
import { productsApi } from "../../src/lib/api";
import Toast from "react-native-toast-message";

const CATS = ["Electronics","Fashion","Home & Living","Beauty","Sports","Food","Other"];

export default function ProductFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; data?: string }>();
  const existing = params.data ? JSON.parse(params.data) : null;

  const [form, setForm] = useState({
    title: existing?.title || "",
    description: existing?.description || "",
    price: existing?.price?.toString() || "",
    original_price: existing?.original_price?.toString() || "",
    discount_percent: existing?.discount_percent?.toString() || "",
    category: existing?.category || "Other",
    stock: existing?.stock?.toString() || "100",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const price = Number.parseFloat(form.price);
    const originalPrice = Number.parseFloat(form.original_price);
    const discountPercent = Number.parseFloat(form.discount_percent);
    const stock = Number.parseInt(form.stock, 10);

    if (!form.title.trim() || !form.description.trim()) {
      Toast.show({ type: "error", text1: "Title, price and description are required" });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      Toast.show({ type: "error", text1: "Valid price required" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price,
        original_price: Number.isFinite(originalPrice) ? originalPrice : undefined,
        discount_percent: Number.isFinite(discountPercent) ? discountPercent : undefined,
        stock: Number.isFinite(stock) ? stock : 100,
      };
      if (existing?.id) {
        await productsApi.update(existing.id, payload);
        Toast.show({ type: "success", text1: "Product updated!" });
      } else {
        await productsApi.create(payload);
        Toast.show({ type: "success", text1: "Product created!" });
      }
      router.back();
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.response?.data?.detail || "Failed to save" });
    } finally { setSaving(false); }
  };

  const ic = ss.input;
  const lc = ss.label;

  return (
    <KeyboardAvoidingView style={ss.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={ss.header}>
        <TouchableOpacity onPress={() => router.back()} style={ss.closeBtn}>
          <X size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <Text style={ss.title}>{existing ? "Edit Product" : "New Product"}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={ss.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#111" /> : <Check size={18} color="#111" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={ss.section}>
          <Text style={lc}>Product Title *</Text>
          <TextInput style={ic} value={form.title} onChangeText={set("title")} placeholder="e.g. Wireless Headphones Pro" placeholderTextColor="rgba(255,255,255,0.2)" />
        </View>

        <View style={ss.section}>
          <Text style={lc}>Description *</Text>
          <TextInput style={[ic, ss.textArea]} value={form.description} onChangeText={set("description")}
            placeholder="Describe your product..." placeholderTextColor="rgba(255,255,255,0.2)" multiline numberOfLines={4} />
        </View>

        <View style={ss.row}>
          <View style={ss.half}>
            <Text style={lc}>Price (₹) *</Text>
            <TextInput style={ic} value={form.price} onChangeText={set("price")} placeholder="999" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="decimal-pad" />
          </View>
          <View style={ss.half}>
            <Text style={lc}>Original Price (₹)</Text>
            <TextInput style={ic} value={form.original_price} onChangeText={set("original_price")} placeholder="1499" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={ss.row}>
          <View style={ss.half}>
            <Text style={lc}>Discount %</Text>
            <TextInput style={ic} value={form.discount_percent} onChangeText={set("discount_percent")} placeholder="33" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="decimal-pad" />
          </View>
          <View style={ss.half}>
            <Text style={lc}>Stock</Text>
            <TextInput style={ic} value={form.stock} onChangeText={set("stock")} placeholder="100" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="number-pad" />
          </View>
        </View>

        <View style={ss.section}>
          <Text style={lc}>Category</Text>
          <View style={ss.catGrid}>
            {CATS.map(c => (
              <TouchableOpacity key={c} style={[ss.catBtn, form.category === c && ss.catBtnActive]} onPress={() => setForm(f => ({ ...f, category: c }))}>
                <Text style={[ss.catText, form.category === c && ss.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={ss.submitBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#111" /> : <Text style={ss.submitText}>{existing ? "Update Product" : "Create Product"}</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: "#fff" },
  saveBtn: { width: 36, height: 36, backgroundColor: "#FFB800", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20 },
  section: { marginBottom: 18 },
  row: { flexDirection: "row", gap: 12, marginBottom: 18 },
  half: { flex: 1 },
  label: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingHorizontal: 14, height: 48, fontSize: 15, color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  textArea: { height: 96, paddingTop: 14, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1.5, borderColor: "transparent" },
  catBtnActive: { backgroundColor: "rgba(255,184,0,0.12)", borderColor: "#FFB800" },
  catText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.5)" },
  catTextActive: { color: "#FFB800" },
  submitBtn: { marginTop: 8, backgroundColor: "#FFB800", borderRadius: 18, height: 54, alignItems: "center", justifyContent: "center" },
  submitText: { fontSize: 15, fontWeight: "900", color: "#111" },
});
