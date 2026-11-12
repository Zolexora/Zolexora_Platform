import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddTransactionModal from "@/components/AddTransactionModal";
import TransactionItem from "@/components/TransactionItem";
import { Transaction, useMoney } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";

type FilterType = "all" | "income" | "expense";

function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = [];
  const map = new Map<string, Transaction[]>();

  for (const t of transactions) {
    const d = new Date(t.date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let key: string;
    if (d.toDateString() === today.toDateString()) key = "Today";
    else if (d.toDateString() === yesterday.toDateString()) key = "Yesterday";
    else
      key = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });

    if (!map.has(key)) {
      map.set(key, []);
      groups.push({ date: key, items: map.get(key)! });
    }
    map.get(key)!.push(t);
  }
  return groups;
}

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, deleteTransaction } = useMoney();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== "all") list = list.filter((t) => t.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, filter, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const openModal = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  type ListItem =
    | { type: "header"; date: string; key: string }
    | { type: "item"; transaction: Transaction; key: string };

  const flatData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    for (const g of groups) {
      items.push({ type: "header", date: g.date, key: `h-${g.date}` });
      for (const t of g.items) {
        items.push({ type: "item", transaction: t, key: t.id });
      }
    }
    return items;
  }, [groups]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: colors.background,
            paddingTop: topPad + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search transactions..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {(["all", "income", "expense"] as FilterType[]).map((f) => {
            const active = filter === f;
            const activeColor =
              f === "income"
                ? colors.income
                : f === "expense"
                ? colors.expense
                : colors.primary;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? activeColor : colors.muted,
                    borderColor: active ? activeColor : colors.border,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {flatData.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="inbox" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search || filter !== "all" ? "No matches found" : "No transactions yet"}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            {search || filter !== "all"
              ? "Try a different search or filter"
              : "Add your first transaction with the + button"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <Text
                  style={[styles.dateHeader, { color: colors.mutedForeground }]}
                >
                  {item.date}
                </Text>
              );
            }
            return (
              <TransactionItem
                transaction={item.transaction}
                onDelete={deleteTransaction}
              />
            );
          }}
          contentContainerStyle={{
            paddingBottom:
              Platform.OS === "web" ? 120 : insets.bottom + 84 + 16,
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!flatData.length}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom:
              Platform.OS === "web"
                ? insets.bottom + 34 + 16
                : insets.bottom + 84 + 16,
          },
        ]}
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  dateHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
