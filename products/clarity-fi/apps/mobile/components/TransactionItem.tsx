import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Transaction } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";
import CategoryIcon from "./CategoryIcon";
import Currency from "./Currency";

interface Props {
  transaction: Transaction;
  onDelete?: (id: string) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TransactionItem({ transaction, onDelete }: Props) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLongPress = () => {
    if (!onDelete) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onDelete(transaction.id));
  };

  const amountColor =
    transaction.type === "income" ? colors.income : colors.expense;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={handleLongPress}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <CategoryIcon category={transaction.category} size={20} />
        <View style={styles.info}>
          <Text style={[styles.category, { color: colors.foreground }]} numberOfLines={1}>
            {transaction.category}
          </Text>
          {transaction.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
              {transaction.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <Currency
            amount={transaction.amount}
            signed
            type={transaction.type}
            style={[styles.amount, { color: amountColor }]}
          />
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(transaction.date)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  category: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
