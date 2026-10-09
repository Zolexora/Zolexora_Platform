import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddTransactionModal from "@/components/AddTransactionModal";
import AppHeader from "@/components/AppHeader";
import Currency from "@/components/Currency";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import FitnessScreen from "@/components/FitnessScreen";
import LifestyleScreen from "@/components/LifestyleScreen";
import { useMoney } from "@/context/MoneyContext";
import { useSection } from "@/context/SectionContext";
import { useColors } from "@/hooks/useColors";
import CategoryIcon from "@/components/CategoryIcon";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function groupByDay(txns: ReturnType<typeof useMoney>["transactions"]) {
  const groups: { dateKey: string; label: string; txns: typeof txns }[] = [];
  const map = new Map<string, typeof txns>();
  for (const t of txns) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  for (const [key, items] of map) {
    const d = new Date(items[0].date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const label = isToday
      ? "Today"
      : `${SHORT_DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
    groups.push({ dateKey: key, label, txns: items });
  }
  return groups.sort((a, b) => new Date(b.txns[0].date).getTime() - new Date(a.txns[0].date).getTime());
}

export default function RecordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeSection } = useSection();
  const { transactions, deleteTransaction, getMonthData, settings, updateSettings } = useMoney();

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [modalVisible, setModalVisible] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);

  const monthTxns = useMemo(() =>
    transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === selYear && d.getMonth() === selMonth;
    }), [transactions, selYear, selMonth]);

  const { income, expense, balance } = useMemo(
    () => getMonthData(selYear, selMonth),
    [getMonthData, selYear, selMonth, transactions, settings.carryOver]
  );

  const groups = useMemo(() => groupByDay(monthTxns), [monthTxns]);

  const goNext = () => {
    if (selYear === now.getFullYear() && selMonth === now.getMonth()) return;
    if (selMonth === 11) { setSelMonth(0); setSelYear((y) => y + 1); }
    else setSelMonth((m) => m + 1);
  };
  const goPrev = () => {
    if (selMonth === 0) { setSelMonth(11); setSelYear((y) => y - 1); }
    else setSelMonth((m) => m - 1);
  };

  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
  const tabH = Platform.OS === "web" ? 72 : 60;

  if (activeSection === "Lifestyle") {
    return <LifestyleScreen />;
  }

  if (activeSection === "Fitness") {
    return <FitnessScreen />;
  }

  if (activeSection !== "Finance") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AppHeader rightIcon="search" />
        <SectionPlaceholder section={activeSection} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader rightIcon="search" />

      {/* Month navigation */}
      <View style={[styles.monthNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goPrev} style={styles.navBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>
          {MONTH_NAMES[selMonth]}, {selYear}
        </Text>
        <TouchableOpacity onPress={goNext} style={styles.navBtn} activeOpacity={0.7} disabled={isCurrentMonth}>
          <Feather name="chevron-right" size={22} color={isCurrentMonth ? colors.mutedForeground : colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDisplayOptions(true)} style={styles.filterBtn} activeOpacity={0.7}>
          <Feather name="align-justify" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>EXPENSE</Text>
          <Currency amount={expense} style={[styles.summaryValue, { color: colors.expense }]} />
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>INCOME</Text>
          <Currency amount={income} style={[styles.summaryValue, { color: colors.income }]} />
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>BALANCE</Text>
          <Currency amount={balance} style={[styles.summaryValue, { color: balance >= 0 ? colors.income : colors.expense }]} />
        </View>
      </View>

      {/* Transaction list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: tabH + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="file-text" size={48} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No record in this month. Tap + to add new expense or income.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.dateKey}>
              <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>{group.label}</Text>
                <View style={styles.dayTotals}>
                  <Currency
                    amount={group.txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)}
                    style={[styles.dayTotal, { color: colors.income }]}
                    signed
                    type="income"
                  />
                  <Currency
                    amount={group.txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)}
                    style={[styles.dayTotal, { color: colors.expense }]}
                    signed
                    type="expense"
                  />
                </View>
              </View>
              {group.txns.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.txRow, { borderBottomColor: colors.border }]}
                  onLongPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deleteTransaction(t.id);
                  }}
                  activeOpacity={0.7}
                >
                  <CategoryIcon category={t.category} size={18} />
                  <View style={styles.txInfo}>
                    <Text style={[styles.txCategory, { color: colors.foreground }]}>{t.category}</Text>
                    {t.description ? (
                      <Text style={[styles.txDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{t.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.txRight}>
                    <Currency
                      amount={t.amount}
                      signed
                      type={t.type}
                      style={[styles.txAmount, { color: t.type === "income" ? colors.income : colors.expense }]}
                    />
                    <Text style={[styles.txAccount, { color: colors.mutedForeground }]}>{t.account}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: tabH + 16 }]}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>

      <AddTransactionModal visible={modalVisible} onClose={() => setModalVisible(false)} />

      {/* Display Options Modal */}
      <Modal visible={showDisplayOptions} transparent animationType="fade" onRequestClose={() => setShowDisplayOptions(false)}>
        <TouchableOpacity style={styles.optOverlay} activeOpacity={1} onPress={() => setShowDisplayOptions(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.optSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.optTitle, { color: colors.foreground }]}>Display options</Text>

            <View style={styles.optRow}>
              <Text style={[styles.optLabel, { color: colors.foreground }]}>View mode:</Text>
              <View style={styles.optChoices}>
                {(["daily", "weekly", "monthly"] as const).map((m) => (
                  <TouchableOpacity key={m} style={styles.optChoice} onPress={() => updateSettings({ viewMode: m })}>
                    {settings.viewMode === m && <Feather name="check" size={14} color={colors.primary} style={styles.optCheck} />}
                    <Text style={[styles.optChoiceText, { color: settings.viewMode === m ? colors.primary : colors.foreground }]}>
                      {m.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.optDivider, { backgroundColor: colors.border }]} />

            <View style={styles.optRow}>
              <Text style={[styles.optLabel, { color: colors.foreground }]}>Show total:</Text>
              <View style={styles.optChoices}>
                {([true, false] as const).map((v) => (
                  <TouchableOpacity key={String(v)} style={styles.optChoice} onPress={() => updateSettings({ showTotal: v })}>
                    {settings.showTotal === v && <Feather name="check" size={14} color={colors.primary} style={styles.optCheck} />}
                    <Text style={[styles.optChoiceText, { color: settings.showTotal === v ? colors.primary : colors.foreground }]}>
                      {v ? "YES" : "NO"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.optDivider, { backgroundColor: colors.border }]} />

            <View style={styles.optRow}>
              <Text style={[styles.optLabel, { color: colors.foreground }]}>Carry over:</Text>
              <View style={styles.optChoices}>
                {([true, false] as const).map((v) => (
                  <TouchableOpacity key={String(v)} style={styles.optChoice} onPress={() => updateSettings({ carryOver: v })}>
                    {settings.carryOver === v && <Feather name="check" size={14} color={colors.primary} style={styles.optCheck} />}
                    <Text style={[styles.optChoiceText, { color: settings.carryOver === v ? colors.primary : colors.foreground }]}>
                      {v ? "ON" : "OFF"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.optHint, { color: colors.mutedForeground }]}>
              With Carry over enabled, monthly surplus will be added to the next month.
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  navBtn: { padding: 8 },
  monthLabel: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  filterBtn: { padding: 8 },
  summaryBar: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  summaryDivider: { width: 1 },
  scroll: { paddingTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100, paddingHorizontal: 40, gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dayTotals: { flexDirection: "row", gap: 12 },
  dayTotal: { fontSize: 13, fontFamily: "Inter_500Medium" },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txInfo: { flex: 1, gap: 2 },
  txCategory: { fontSize: 15, fontFamily: "Inter_500Medium" },
  txDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txRight: { alignItems: "flex-end", gap: 2 },
  txAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  txAccount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 32 },
  optSheet: { borderRadius: 16, padding: 24, gap: 4 },
  optTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16, textAlign: "center" },
  optRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 4, gap: 8 },
  optLabel: { width: 100, fontSize: 15, fontFamily: "Inter_500Medium", paddingTop: 4 },
  optChoices: { flex: 1, gap: 6 },
  optChoice: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  optCheck: { width: 18 },
  optChoiceText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  optDivider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  optHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 8 },
});
