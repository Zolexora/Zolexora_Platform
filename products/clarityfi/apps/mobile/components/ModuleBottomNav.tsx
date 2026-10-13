import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomNavMetrics } from "@/constants/navigation";
import { useColors } from "@/hooks/useColors";

export interface ModuleBottomNavItem<T extends string> {
  key: T;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

interface Props<T extends string> {
  items: ModuleBottomNavItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
}

export default function ModuleBottomNav<T extends string>({
  items,
  activeKey,
  onChange,
}: Props<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const metrics = getBottomNavMetrics(insets.bottom);

  return (
    <View
      style={[
        styles.bar,
        metrics,
        { backgroundColor: colors.tabBar, borderTopColor: colors.border },
      ]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const color = active ? colors.primary : colors.mutedForeground;

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => onChange(item.key)}
            activeOpacity={0.7}
          >
            <Feather name={item.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
            {active ? <View style={[styles.indicator, { backgroundColor: colors.primary }]} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
  },
});
