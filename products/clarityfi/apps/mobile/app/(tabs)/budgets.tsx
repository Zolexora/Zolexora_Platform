import { Feather } from "@expo/vector-icons";
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

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function BudgetsScreen() {
  const colors = useColors();
  const { activeSection } = useSection();
  const { expenseCategories, budgets, transactions, setBudget, removeBudget, copyBudgetsFromLastMonth } = useMoney();

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());

  const monthKey = `${selYear}-${String(selMonth + 1).padStart(2, "0")}`;

  const [budgetModal, setBudgetModal] = useState<{ catName: string; current: number } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  const monthTxns = useMemo(() =>
    transactions.filter((t) => {
      const d = new Date(t.date);
      return t.type === "expense" && d.getFullYear() === selYear && d.getMonth() === selMonth;
    }), [transactions, selYear, selMonth]);

  const totalBudget = budgets.filter((b) => b.month === monthKey).reduce((s, b) => s + b.limit, 0);
  const totalSpent = monthTxns.reduce((s, t) => s + t.amount, 0);

  const budgeted = expenseCategories.filter((c) =>
    budgets.some((b) => b.categoryName === c.name && b.month === monthKey)
  );
  const notBudgeted = expenseCategories.filter((c) =>
    !budgets.some((b) => b.categoryName === c.name && b.month === monthKey)
  );

  const getSpent = (catName: string) =>
    monthTxns.filter((t) => t.category === catName).reduce((s, t) => s + t.amount, 0);

  const getBudgetLimit = (catName: string) =>
    budgets.find((b) => b.categoryName === catName && b.month === monthKey)?.limit ?? 0;

  if (activeSection !== "Finance") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader />
        <SectionPlaceholder section={activeSection} />
      </View>
    );
  }

  const openBudgetModal = (catName: string) => {
    const cur = getBudgetLimit(catName);
    setBudgetModal({ catName, current: cur });
    setBudgetInput(cur > 0 ? String(cur) : "");
  };

  const handleSaveBudget = async () => {
    if (!budgetModal) return;
    const val = parseFloat(budgetInput);
    if (!val || val <= 0) return;
    await setBudget(budgetModal.catName, monthKey, val);
    setBudgetModal(null);
  };

  const goNext = () => {
    if (selMonth === 11) { setSelMonth(0); setSelYear((y) => y + 1); }
    else setSelMonth((m) => m + 1);
  };
  const goPrev = () => {
    if (selMonth === 0) { setSelMonth(11); setSelYear((y) => y - 1); }
    else setSelMonth((m) => m - 1);
  };

  const tabH = Platform.OS === "web" ? 72 : 60;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />

      {/* Budget summary */}
      <View style={[styles.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.summaryCenter}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>TOTAL BUDGET</Text>
              <Currency amount={totalBudget} style={[styles.summaryValue, { color: colors.foreground }]} />
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>TOTAL SPENT</Text>
              <Currency amount={totalSpent} style={[styles.summaryValue, { color: colors.expense }]} />
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={goNext} style={styles.navBtn}>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: tabH + 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Budgeted categories: {MONTH_NAMES[selMonth]}, {selYear}
          </Text>
          {totalBudget === 0 && (
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Currently, no budget is applied for this month. Set budget-limits for this month, or copy your budget-limits from past months.
            </Text>
          )}
        </View>

        {/* Budgeted categories */}
        {budgeted.length > 0 && (
          <View>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Budgeted this month</Text>
            {budgeted.map((cat) => {
              const limit = getBudgetLimit(cat.name);
              const spent = getSpent(cat.name);
              const pct = limit > 0 ? Math.min(spent / limit, 1) : 0;
              const overBudget = spent > limit;
              return (
                <View key={cat.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.catIcon, { backgroundColor: cat.color + "22" }]}>
                    <Feather name={cat.icon as any} size={18} color={cat.color} />
                  </View>
                  <View style={styles.catInfo}>
                    <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
                    <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                      <View style={[styles.progressBar, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? colors.expense : colors.primary }]} />
                    </View>
                    <Text style={[styles.catSub, { color: colors.mutedForeground }]}>
                      ₹{spent.toFixed(0)} / ₹{limit.toFixed(0)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.setBudgetBtn, { borderColor: colors.border }]}
                    onPress={() => openBudgetModal(cat.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.setBudgetText, { color: colors.foreground }]}>EDIT</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Not budgeted */}
        {notBudgeted.length > 0 && (
          <View>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Not budgeted this month</Text>
            {notBudgeted.map((cat) => (
              <View key={cat.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.catIcon, { backgroundColor: cat.color + "22" }]}>
                  <Feather name={cat.icon as any} size={18} color={cat.color} />
                </View>
                <Text style={[styles.catName, { color: colors.foreground, flex: 1 }]}>{cat.name}</Text>
                <TouchableOpacity
                  style={[styles.setBudgetBtn, { borderColor: colors.border }]}
                  onPress={() => openBudgetModal(cat.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.setBudgetText, { color: colors.foreground }]}>SET BUDGET</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* SET FROM PAST MONTHS */}
        <TouchableOpacity
          style={[styles.pastMonthsBtn, { borderColor: colors.border }]}
          onPress={() => {
            Alert.alert("Copy budgets", "Copy budget limits from last month?", [
              { text: "Cancel", style: "cancel" },
              { text: "Copy", onPress: () => copyBudgetsFromLastMonth(monthKey) },
            ]);
          }}
          activeOpacity={0.8}
        >
          <Feather name="copy" size={16} color={colors.foreground} />
          <Text style={[styles.pastMonthsText, { color: colors.foreground }]}>SET FROM PAST MONTHS</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Budget input modal */}
      <Modal visible={!!budgetModal} transparent animationType="slide" onRequestClose={() => setBudgetModal(null)}>
        <View style={styles.budgetOverlay}>
          <View style={[styles.budgetSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.budgetTitle, { color: colors.foreground }]}>
              Set budget for {budgetModal?.catName}
            </Text>
            <View style={[styles.budgetInputRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.budgetSymbol, { color: colors.primary }]}>₹</Text>
              <TextInput
                style={[styles.budgetInput, { color: colors.foreground }]}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>
            <View style={styles.budgetButtons}>
              <TouchableOpacity style={[styles.budgetCancelBtn, { borderColor: colors.border }]} onPress={() => setBudgetModal(null)} activeOpacity={0.7}>
                <Text style={[styles.budgetCancelText, { color: colors.foreground }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.budgetSaveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveBudget} activeOpacity={0.8}>
                <Text style={[styles.budgetSaveText, { color: colors.primaryForeground }]}>SAVE</Text>
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
  summaryBar: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  navBtn: { padding: 10 },
  summaryCenter: { flex: 1 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  summaryValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionHeader: { padding: 16, gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  groupLabel: { fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, letterSpacing: 0.5 },
  catRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  catInfo: { flex: 1, gap: 4 },
  catName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  catSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressBar: { height: 4, borderRadius: 2 },
  setBudgetBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
  setBudgetText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  pastMonthsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 16, paddingVertical: 14, borderRadius: 8, borderWidth: 1, gap: 8,
  },
  pastMonthsText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  budgetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 32 },
  budgetSheet: { borderRadius: 16, padding: 24, gap: 16 },
  budgetTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  budgetInputRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingBottom: 8 },
  budgetSymbol: { fontSize: 28, fontFamily: "Inter_700Bold", marginRight: 4 },
  budgetInput: { flex: 1, fontSize: 40, fontFamily: "Inter_700Bold", padding: 0 },
  budgetButtons: { flexDirection: "row", gap: 12 },
  budgetCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  budgetCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  budgetSaveBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  budgetSaveText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
