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

const ACCOUNT_EMOJIS = ["💵","💳","🐷","🏦","💼","🪙","💰","🏠","📈","🎁"];
const ACCOUNT_COLORS = ["#71BB7B","#5B8DD9","#D46B6B","#C9A840","#D946EF","#F97316","#06B6D4","#8B5CF6","#EC4899","#F59E0B"];

export default function AccountsScreen() {
  const colors = useColors();
  const { activeSection } = useSection();
  const { accounts, transactions, addAccount, deleteAccount } = useMoney();

  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("💵");
  const [newColor, setNewColor] = useState(ACCOUNT_COLORS[0]);

  const totalBalance = useMemo(() =>
    accounts.reduce((sum, acc) => {
      const bal = transactions
        .filter((t) => t.account === acc.id)
        .reduce((s, t) => (t.type === "income" ? s + t.amount : s - t.amount), 0);
      return sum + bal;
    }, 0), [accounts, transactions]);

  const totalExpense = useMemo(() =>
    transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [transactions]);

  const totalIncome = useMemo(() =>
    transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [transactions]);

  const getAccountBalance = (accId: string) =>
    transactions
      .filter((t) => t.account === accId)
      .reduce((s, t) => (t.type === "income" ? s + t.amount : s - t.amount), 0);

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
    await addAccount({ name: newName.trim(), emoji: newEmoji, color: newColor });
    setAddModal(false);
    setNewName("");
    setNewEmoji("💵");
    setNewColor(ACCOUNT_COLORS[0]);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Account", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteAccount(id) },
    ]);
  };

  const tabH = Platform.OS === "web" ? 72 : 60;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />

      {/* Overall balance banner */}
      <View style={[styles.banner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
          [ All Accounts <Currency amount={totalBalance} style={[styles.bannerBalance, { color: totalBalance >= 0 ? colors.income : colors.expense }]} /> ]
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

      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: tabH + 20 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accounts</Text>

        {accounts.map((acc) => {
          const bal = getAccountBalance(acc.id);
          return (
            <View key={acc.id} style={[styles.accCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.accIconBox, { backgroundColor: acc.color + "22" }]}>
                <Text style={styles.accEmoji}>{acc.emoji}</Text>
              </View>
              <View style={styles.accInfo}>
                <Text style={[styles.accName, { color: colors.foreground }]}>{acc.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.accBalLabel, { color: colors.mutedForeground }]}>Balance: </Text>
                  <Currency amount={bal} style={[styles.accBalance, { color: bal >= 0 ? colors.income : colors.expense }]} />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(acc.id, acc.name)}
                style={styles.moreBtn}
                activeOpacity={0.7}
              >
                <Feather name="more-horizontal" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ADD NEW ACCOUNT */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={() => setAddModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={18} color={colors.foreground} />
          <Text style={[styles.addBtnText, { color: colors.foreground }]}>ADD NEW ACCOUNT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Account</Text>

            <TextInput
              style={[styles.nameInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Account name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />

            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>Icon</Text>
            <View style={styles.emojiPicker}>
              {ACCOUNT_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, newEmoji === e && { backgroundColor: colors.primary + "33", borderColor: colors.primary, borderWidth: 1.5 }]}
                  onPress={() => setNewEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>Color</Text>
            <View style={styles.colorPicker}>
              {ACCOUNT_COLORS.map((c) => (
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
  bannerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  bannerBalance: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bannerRow: { flexDirection: "row", justifyContent: "space-around" },
  bannerItem: { alignItems: "center", gap: 2 },
  bannerLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  bannerVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 16, marginBottom: 12 },
  accCard: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 12,
  },
  accIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  accEmoji: { fontSize: 24 },
  accInfo: { flex: 1, gap: 4 },
  accName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  accBalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  accBalance: { fontSize: 14, fontFamily: "Inter_700Bold" },
  moreBtn: { padding: 8 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  addBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 24 },
  modalSheet: { borderRadius: 16, padding: 24, gap: 14 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  nameInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Inter_400Regular" },
  pickerLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emojiPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 22 },
  colorPicker: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  colorSelected: { transform: [{ scale: 1.2 }] },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
