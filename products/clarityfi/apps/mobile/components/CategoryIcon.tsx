import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

export interface CategoryDef {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bg: string;
  type: "expense" | "income" | "both";
}

export const CATEGORIES: CategoryDef[] = [
  { label: "Awards", icon: "award", color: "#C9A840", bg: "#3A3520", type: "income" },
  { label: "Coupons", icon: "tag", color: "#F97316", bg: "#3A2E1E", type: "income" },
  { label: "Grants", icon: "dollar-sign", color: "#5B8DD9", bg: "#1E2A3A", type: "income" },
  { label: "Lottery", icon: "star", color: "#F59E0B", bg: "#3A321A", type: "income" },
  { label: "Refunds", icon: "refresh-ccw", color: "#06B6D4", bg: "#1A333A", type: "income" },
  { label: "Rental", icon: "home", color: "#8B5CF6", bg: "#2A1E3A", type: "income" },
  { label: "Salary", icon: "briefcase", color: "#71BB7B", bg: "#1A2E1E", type: "income" },
  { label: "Sale", icon: "percent", color: "#D46B6B", bg: "#3A1E1E", type: "income" },
  { label: "Baby", icon: "heart", color: "#EC4899", bg: "#3A1E2E", type: "expense" },
  { label: "Beauty", icon: "scissors", color: "#D946EF", bg: "#321E3A", type: "expense" },
  { label: "Bills", icon: "file-text", color: "#F97316", bg: "#3A2E1E", type: "expense" },
  { label: "Car", icon: "truck", color: "#3B82F6", bg: "#1E253A", type: "expense" },
  { label: "Clothing", icon: "shopping-bag", color: "#8B5CF6", bg: "#2A1E3A", type: "expense" },
  { label: "EMI Interest", icon: "credit-card", color: "#D46B6B", bg: "#3A1E1E", type: "expense" },
  { label: "Education", icon: "book", color: "#F59E0B", bg: "#3A321A", type: "expense" },
  { label: "Electronics", icon: "smartphone", color: "#0EA5E9", bg: "#1A2E3A", type: "expense" },
  { label: "Entertainment", icon: "film", color: "#7C3AED", bg: "#25183A", type: "expense" },
  { label: "Food", icon: "coffee", color: "#F97316", bg: "#3A2E1E", type: "expense" },
  { label: "Health", icon: "activity", color: "#EF4444", bg: "#3A1C1C", type: "expense" },
  { label: "Home", icon: "home", color: "#14B8A6", bg: "#1A3230", type: "expense" },
  { label: "Insurance", icon: "shield", color: "#3B82F6", bg: "#1E253A", type: "expense" },
  { label: "Other", icon: "grid", color: "#78716C", bg: "#2E2C28", type: "expense" },
  { label: "Shopping", icon: "shopping-cart", color: "#EC4899", bg: "#3A1E2E", type: "expense" },
  { label: "Social", icon: "users", color: "#71BB7B", bg: "#1A2E1E", type: "expense" },
  { label: "Sport", icon: "target", color: "#F97316", bg: "#3A2E1E", type: "expense" },
  { label: "Tax", icon: "file-minus", color: "#78716C", bg: "#2E2C28", type: "expense" },
  { label: "Telephone", icon: "phone", color: "#3B82F6", bg: "#1E253A", type: "expense" },
  { label: "Transportation", icon: "navigation", color: "#3B82F6", bg: "#1E253A", type: "expense" },
];

export function getCategoryDef(label: string): CategoryDef {
  return (
    CATEGORIES.find((c) => c.label === label) ?? {
      label,
      icon: "circle",
      color: "#8A8060",
      bg: "#3F3C2A",
      type: "both",
    }
  );
}

interface Props {
  category: string;
  size?: number;
}

export default function CategoryIcon({ category, size = 20 }: Props) {
  const def = getCategoryDef(category);
  const boxSize = size + 16;
  return (
    <View
      style={[
        styles.box,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: boxSize / 2,
          backgroundColor: def.bg,
        },
      ]}
    >
      <Feather name={def.icon} size={size} color={def.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
});
