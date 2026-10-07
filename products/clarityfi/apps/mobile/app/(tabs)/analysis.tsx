import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AppHeader from "@/components/AppHeader";
import Currency from "@/components/Currency";
import SectionPlaceholder from "@/components/SectionPlaceholder";
import { useMoney } from "@/context/MoneyContext";
import { useSection } from "@/context/SectionContext";
import { useColors } from "@/hooks/useColors";

const VIEW_TYPES = [
  "Expense overview",
  "Income overview",
  "Expense flow",
  "Income flow",
  "Account analysis",
] as const;
type ViewType = typeof VIEW_TYPES[number];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getLast6Months() {
  const months: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString("en-US", { month: "short" }), year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

export default function AnalysisScreen() {
  const colors = useColors();
  const { activeSection } = useSection();
  const { transactions, accounts } = useMoney();

  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [viewType, setViewType] = useState<ViewType>("Expense overview");
  const [showDropdown, setShowDropdown] = useState(false);

  const monthTxns = useMemo(() =>
    transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === selYear && d.getMonth() === selMonth;
    }), [transactions, selYear, selMonth]);

  if (activeSection !== "Finance") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader />
        <SectionPlaceholder section={activeSection} />
      </View>
    );
  }

  const expenses = monthTxns.filter((t) => t.type === "expense");
  const incomes = monthTxns.filter((t) => t.type === "income");
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);

  const buildCatStats = (txns: typeof transactions, total: number) => {
    const map = new Map<string, number>();
    for (const t of txns) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ cat, amount, pct: total > 0 ? amount / total : 0 }));
  };

  const expCatStats = useMemo(() => buildCatStats(expenses, totalExp), [expenses, totalExp]);
  const incCatStats = useMemo(() => buildCatStats(incomes, totalInc), [incomes, totalInc]);

  const last6 = getLast6Months();
  const flowData = useMemo(() =>
    last6.map((m) => {
      const txns = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      });
      return {
        ...m,
        income: txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    }), [transactions]);

  const accStats = useMemo(() =>
    accounts.map((acc) => {
      const accTxns = monthTxns.filter((t) => t.account === acc.id);
      return {
        acc,
        income: accTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: accTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    }), [accounts, monthTxns]);

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

  const hasData =
    (viewType === "Expense overview" && expCatStats.length > 0) ||
    (viewType === "Income overview" && incCatStats.length > 0) ||
    (viewType === "Expense flow" || viewType === "Income flow") ||
    (viewType === "Account analysis" && accStats.some((a) => a.income + a.expense > 0));

  const CAT_COLORS = ["#C9A840","#71BB7B","#D46B6B","#5B8DD9","#D946EF","#F97316","#06B6D4","#8B5CF6","#EC4899","#F59E0B"];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader rightIcon="search" />

      {/* Month nav */}
      <View style={[styles.monthNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goPrev} style={styles.navBtn}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>
          {MONTH_NAMES[selMonth]}, {selYear}
        </Text>
        <TouchableOpacity onPress={goNext} style={styles.navBtn} disabled={isCurrentMonth}>
          <Feather name="chevron-right" size={22} color={isCurrentMonth ? colors.mutedForeground : colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: tabH + 20 }} showsVerticalScrollIndicator={false}>
        {/* View type dropdown */}
        <TouchableOpacity
          style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowDropdown(true)}
          activeOpacity={0.8}
        >
          <Feather name="chevron-down" size={16} color={colors.foreground} />
          <Text style={[styles.dropdownText, { color: colors.foreground }]}>{viewType.toUpperCase()}</Text>
        </TouchableOpacity>

        {!hasData ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No analysis for this month</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 16 }}>
            {/* Expense / Income overview */}
            {(viewType === "Expense overview" || viewType === "Income overview") && (() => {
              const stats = viewType === "Expense overview" ? expCatStats : incCatStats;
              const total = viewType === "Expense overview" ? totalExp : totalInc;
              return (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                    {viewType === "Expense overview" ? "Expenses" : "Income"} by category
                  </Text>
                  <Currency amount={total} style={[styles.cardTotal, { color: viewType === "Expense overview" ? colors.expense : colors.income }]} />
                  {/* Color bar */}
                  <View style={[styles.colorBar, { backgroundColor: colors.muted }]}>
                    {stats.map((s, i) => (
                      <View key={s.cat} style={{ flex: s.pct, backgroundColor: CAT_COLORS[i % CAT_COLORS.length], minWidth: 4 }} />
                    ))}
                  </View>
                  {stats.map((s, i) => (
                    <View key={s.cat} style={styles.statRow}>
                      <View style={[styles.statDot, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                      <Text style={[styles.statCat, { color: colors.foreground }]}>{s.cat}</Text>
                      <Text style={[styles.statPct, { color: colors.mutedForeground }]}>{(s.pct * 100).toFixed(0)}%</Text>
                      <Currency amount={s.amount} style={[styles.statAmt, { color: colors.foreground }]} />
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Flow charts */}
            {(viewType === "Expense flow" || viewType === "Income flow") && (() => {
              const key = viewType === "Expense flow" ? "expense" : "income";
              const max = Math.max(...flowData.map((m) => m[key]), 1);
              const barColor = key === "expense" ? colors.expense : colors.income;
              return (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{viewType} — Last 6 months</Text>
                  <View style={styles.chartArea}>
                    {flowData.map((m) => (
                      <View key={`${m.year}-${m.month}`} style={styles.barGroup}>
                        <View style={styles.barTrack}>
                          <View style={[styles.bar, { height: Math.max((m[key] / max) * 100, m[key] > 0 ? 6 : 0), backgroundColor: barColor }]} />
                        </View>
                        <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Account analysis */}
            {viewType === "Account analysis" && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>By account</Text>
                {accStats.map((a) => (
                  <View key={a.acc.id} style={styles.accRow}>
                    <Text style={styles.accEmoji}>{a.acc.emoji}</Text>
                    <Text style={[styles.accName, { color: colors.foreground }]}>{a.acc.name}</Text>
                    <View style={styles.accTotals}>
                      <Currency amount={a.income} style={[styles.accAmt, { color: colors.income }]} />
                      <Currency amount={a.expense} style={[styles.accAmt, { color: colors.expense }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Dropdown modal */}
      <Modal visible={showDropdown} transparent animationType="fade" onRequestClose={() => setShowDropdown(false)}>
        <TouchableOpacity style={styles.dropOverlay} activeOpacity={1} onPress={() => setShowDropdown(false)}>
          <View style={[styles.dropMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {VIEW_TYPES.map((v) => (
              <TouchableOpacity
                key={v}
                style={styles.dropItem}
                onPress={() => { setViewType(v); setShowDropdown(false); }}
                activeOpacity={0.7}
              >
                {viewType === v && <Feather name="check" size={14} color={colors.primary} />}
                <Text style={[styles.dropItemText, { color: viewType === v ? colors.primary : colors.foreground, paddingLeft: viewType === v ? 6 : 20 }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  monthNav: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1 },
  navBtn: { padding: 8 },
  monthLabel: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  dropdown: { flexDirection: "row", alignItems: "center", alignSelf: "center", marginTop: 16, gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  dropdownText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 14, padding: 18, borderWidth: 1, gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardTotal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  colorBar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statDot: { width: 10, height: 10, borderRadius: 5 },
  statCat: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  statPct: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statAmt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chartArea: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, paddingTop: 8 },
  barGroup: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { borderRadius: 4, width: "100%" },
  barLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  accRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  accEmoji: { fontSize: 20 },
  accName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  accTotals: { gap: 2, alignItems: "flex-end" },
  accAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dropOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-start", alignItems: "center", paddingTop: 160 },
  dropMenu: { width: 260, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  dropItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#514D3C" },
  dropItemText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
