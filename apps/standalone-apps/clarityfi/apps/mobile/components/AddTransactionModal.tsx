import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMoney } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";
import Currency from "./Currency";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addTransaction, accounts, incomeCategories, expenseCategories } = useMoney();
  const slideAnim = useRef(new Animated.Value(600)).current;

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState(accounts[0]?.id ?? "cash");

  const cats = type === "income" ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (visible) {
      setType("expense");
      setAmount("");
      setCategory("");
      setDescription("");
      setAccount(accounts[0]?.id ?? "cash");
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 700, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => { setCategory(""); }, [type]);

  const handleSave = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || !category) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addTransaction({
      type,
      amount: parsed,
      category,
      description: description.trim(),
      date: new Date().toISOString(),
      account,
    });
    onClose();
  };

  const isValid = parseFloat(amount) > 0 && !!category;
  const accentColor = type === "income" ? colors.income : colors.expense;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Add Transaction</Text>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Type toggle */}
            <View style={[styles.toggle, { backgroundColor: colors.muted }]}>
              {(["expense", "income"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, type === t && { backgroundColor: t === "income" ? colors.income : colors.expense }]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.toggleText, { color: type === t ? "#FFF" : colors.mutedForeground, fontFamily: type === t ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {t === "income" ? "Income" : "Expense"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <View style={[styles.amountRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.currency, { color: accentColor }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: accentColor }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.border}
                autoFocus={visible}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {/* Account selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountScroll}>
              {accounts.map((acc) => {
                const sel = account === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountChip, { backgroundColor: sel ? acc.color + "33" : colors.muted, borderColor: sel ? acc.color : colors.border }]}
                    onPress={() => setAccount(acc.id)}
                  >
                    <Text style={styles.accountEmoji}>{acc.emoji}</Text>
                    <Text style={[styles.accountName, { color: sel ? acc.color : colors.mutedForeground }]}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Category grid */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll} keyboardShouldPersistTaps="handled">
              {cats.map((cat) => {
                const selected = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, { backgroundColor: selected ? cat.color + "33" : colors.muted, borderColor: selected ? cat.color : colors.border }]}
                    onPress={() => setCategory(cat.name)}
                  >
                    <Feather name={cat.icon as any} size={13} color={selected ? cat.color : colors.mutedForeground} />
                    <Text style={[styles.catLabel, { color: selected ? cat.color : colors.mutedForeground }]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Description */}
            <TextInput
              style={[styles.descInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: isValid ? accentColor : colors.muted }]}
              onPress={handleSave}
              disabled={!isValid}
            >
              <Text style={[styles.saveBtnText, { color: isValid ? "#FFF" : colors.mutedForeground }]}>Save Transaction</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  toggleText: { fontSize: 15 },
  amountRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, marginBottom: 16, paddingBottom: 8 },
  currency: { fontSize: 32, fontFamily: "Inter_700Bold", marginRight: 4 },
  amountInput: { flex: 1, fontSize: 48, fontFamily: "Inter_700Bold", padding: 0 },
  accountScroll: { gap: 8, paddingRight: 8, marginBottom: 12 },
  accountChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  accountEmoji: { fontSize: 14 },
  accountName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  catScroll: { gap: 8, paddingRight: 8, marginBottom: 16 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  descInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1, marginBottom: 16 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
