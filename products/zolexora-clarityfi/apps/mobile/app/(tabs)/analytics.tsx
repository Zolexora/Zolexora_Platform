import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCategoryDef } from "@/components/CategoryIcon";
import Currency from "@/components/Currency";
import { useMoney } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";

interface CategoryStat {
  category: string;
  amount: number;
  pct: number;
  color: string;
  bg: string;
  icon: string;
}

function getLast6Months() {
  const months: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions } = useMoney();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const now = new Date();
  const thisMonthExpenses = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === "expense" &&
          new Date(t.date).getMonth() === now.getMonth() &&
          new Date(t.date).getFullYear() === now.getFullYear()
      ),
    [transactions]
  );

  const totalExpenses = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);

  const categoryStats: CategoryStat[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of thisMonthExpenses) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => {
        const def = getCategoryDef(cat);
        return {
          category: cat,
          amount,
          pct: totalExpenses > 0 ? amount / totalExpenses : 0,
          color: def.color,
          bg: def.bg,
          icon: def.icon,
        };
      });
  }, [thisMonthExpenses, totalExpenses]);

  const last6 = getLast6Months();
  const monthlyData = useMemo(
    () =>
      last6.map((m) => {
        const txns = transactions.filter((t) => {
          const d = new Date(t.date);
          return d.getMonth() === m.month && d.getFullYear() === m.year;
        });
        const income = txns
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const expense = txns
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0);
        return { ...m, income, expense };
      }),
    [transactions, last6]
  );

  const maxBar = Math.max(...monthlyData.map((m) => Math.max(m.income, m.expense)), 1);

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        Analytics
      </Text>

      {/* 6-month bar chart */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Last 6 Months
        </Text>
        <View style={styles.chartArea}>
          {monthlyData.map((m) => (
            <View key={`${m.year}-${m.month}`} style={styles.barGroup}>
              <View style={styles.bars}>
                {/* Income bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((m.income / maxBar) * 100, m.income > 0 ? 4 : 0),
                        backgroundColor: colors.income,
                      },
                    ]}
                  />
                </View>
                {/* Expense bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max((m.expense / maxBar) * 100, m.expense > 0 ? 4 : 0),
                        backgroundColor: colors.expense,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Income</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Expenses</Text>
          </View>
        </View>
      </View>

      {/* Spending by category */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Spending by Category
        </Text>
        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
          {monthLabel}
        </Text>

        {categoryStats.length === 0 ? (
          <View style={styles.emptyRow}>
            <Feather name="pie-chart" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No expenses this month
            </Text>
          </View>
        ) : (
          <>
            {/* Visual bar breakdown */}
            <View style={[styles.donutBar, { backgroundColor: colors.muted }]}>
              {categoryStats.map((s) => (
                <View
                  key={s.category}
                  style={{ flex: s.pct, backgroundColor: s.color, minWidth: 4 }}
                />
              ))}
            </View>

            {/* Category list */}
            <View style={styles.catList}>
              {categoryStats.map((s) => (
                <View key={s.category} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: s.color }]} />
                  <Text
                    style={[styles.catName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {s.category}
                  </Text>
                  <View style={styles.catRight}>
                    <Currency amount={s.amount} style={[styles.catAmt, { color: colors.foreground }]} />
                    <Text style={[styles.catPct, { color: colors.mutedForeground }]}>
                      {(s.pct * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={{ height: Platform.OS === "web" ? 50 : insets.bottom + 84 + 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 24 },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 6,
    marginBottom: 12,
    paddingTop: 8,
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 2,
  },
  barTrack: {
    flex: 1,
    height: 100,
    justifyContent: "flex-end",
  },
  bar: {
    borderRadius: 4,
    width: "100%",
  },
  barLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  emptyRow: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  donutBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  catList: {
    gap: 12,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  catRight: {
    alignItems: "flex-end",
  },
  catAmt: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  catPct: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
