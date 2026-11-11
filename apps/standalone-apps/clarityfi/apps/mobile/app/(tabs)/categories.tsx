import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppHeader from "@/components/AppHeader";
import Currency from "@/components/Currency";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { useMoney } from "@/context/MoneyContext";
import { useSection } from "@/context/SectionContext";
import { useColors } from "@/hooks/useColors";

const ICON_OPTIONS: string[] = [
  "award","tag","dollar-sign","star","refresh-ccw","home","briefcase","percent",
  "heart","scissors","file-text","truck","shopping-bag","credit-card","book",
  "smartphone","film","coffee","activity","shield","grid","shopping-cart",
  "users","target","file-minus","phone","navigation","zap","gift","sun",
];

const COLOR_OPTIONS = [
  "#C9A840","#71BB7B","#D46B6B","#5B8DD9","#D946EF","#F97316",
  "#06B6D4","#8B5CF6","#EC4899","#F59E0B","#EF4444","#14B8A6",
];

export default function CategoriesScreen() {
  const colors = useColors();
  const { activeSection } = useSection();
  const { incomeCategories, expenseCategories, transactions, addCategory, deleteCategory } = useMoney();

  const [addModal, setAddModal] = useState(false);
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("grid");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);

  const totalExpense = useMemo(() =>
    transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]);
  const totalIncome = useMemo(() =>
    transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]);
  const totalBalance = totalIncome - totalExpense;

  if (activeSection !== "Finance") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader rightIcon="plus" />
        <SectionPlaceholder section={activeSection} />
      </View>
    );
  }

  const handleAdd = async () => {
    if (!newName.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addCategory({ name: newName.trim(), type: newType, icon: newIcon, color: newColor });
    setAddModal(false);
    setNewName("");
    setNewIcon("grid");
    setNewColor(COLOR_OPTIONS[0]);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Category", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  const tabH = Platform.OS === "web" ? 72 : 60;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />

      {/* Balance banner */}
      <View style={[styles.banner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.bannerBalance, { color: totalBalance >= 0 ? colors.income : colors.expense }]}>
          [ All Accounts{" "}
          <Text>₹{Math.abs(totalBalance).toFixed(2)}</Text>
          {" "}]
        </Text>
        <View style={styles.bannerRow}>
          <View style={styles.bannerItem}>
            <Text style={[styles.bannerLabel, { color: colors.mutedForeground }]}>EXPENSE SO FAR</Text>
            <Currency amount={totalExpense} style={[styles.bannerVal, { color: colors.expense }]} />
          </View>
          <View style={styles.bannerItem}>
            <Text style={[styles.bannerLabel, { color: colors.mutedForeground }]}>INCOME SO FAR</Text>
            <Currency amount={totalIncome} style={[styles.bannerVal, { color: colors.income }]} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: tabH + 20 }} showsVerticalScrollIndicator={false}>
        {/* Income categories */}
        <Text style={[styles.sectionHeader, { color: colors.foreground }]}>Income categories</Text>
        {incomeCategories.map((cat) => (
          <View key={cat.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.catIcon, { backgroundColor: cat.color + "22" }]}>
              <Feather name={cat.icon as any} size={18} color={cat.color} />
            </View>
            <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(cat.id, cat.name)} style={styles.moreBtn} activeOpacity={0.7}>
              <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Expense categories */}
        <Text style={[styles.sectionHeader, { color: colors.foreground }]}>Expense categories</Text>
        {expenseCategories.map((cat) => (
          <View key={cat.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.catIcon, { backgroundColor: cat.color + "22" }]}>
              <Feather name={cat.icon as any} size={18} color={cat.color} />
            </View>
            <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(cat.id, cat.name)} style={styles.moreBtn} activeOpacity={0.7}>
              <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}

        {/* ADD NEW CATEGORY */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={() => setAddModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={18} color={colors.foreground} />
          <Text style={[styles.addBtnText, { color: colors.foreground }]}>ADD NEW CATEGORY</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Category</Text>

            {/* Type toggle */}
            <View style={[styles.toggle, { backgroundColor: colors.muted }]}>
              {(["expense", "income"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, newType === t && { backgroundColor: colors.primary }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.toggleText, { color: newType === t ? colors.primaryForeground : colors.mutedForeground }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.nameInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Category name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />

            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconPicker}>
              {ICON_OPTIONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconBtn, newIcon === icon && { backgroundColor: newColor + "33", borderColor: newColor, borderWidth: 1.5 }]}
                  onPress={() => setNewIcon(icon)}
                >
                  <Feather name={icon as any} size={18} color={newIcon === icon ? newColor : colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>Color</Text>
            <View style={styles.colorPicker}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSelected]}
                  onPress={() => setNewColor(c)}
                >
                  {newColor === c && <Feather name="check" size={12} color="#FFF" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAddModal(false)} activeOpacity={0.7}>
                <Text style={[styles.cancelText, { color: colors.foreground }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd} activeOpacity={0.8}>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  bannerBalance: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  bannerRow: { flexDirection: "row", justifyContent: "space-around" },
  bannerItem: { alignItems: "center", gap: 2 },
  bannerLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  bannerVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionHeader: { fontSize: 16, fontFamily: "Inter_700Bold", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  catRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  catName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  moreBtn: { padding: 8 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 16, paddingVertical: 14, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  addBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  toggle: { flexDirection: "row", borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: "center" },
  toggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  nameInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular" },
  pickerLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  iconPicker: { gap: 8, paddingRight: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  colorPicker: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  colorSelected: { transform: [{ scale: 1.2 }] },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
