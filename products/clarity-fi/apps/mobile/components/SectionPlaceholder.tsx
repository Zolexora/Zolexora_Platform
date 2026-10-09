import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { type AppSection } from "@/context/SectionContext";

const SECTION_META: Record<
  Exclude<AppSection, "Finance">,
  { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; items: string[] }
> = {
  Fitness: {
    icon: "activity",
    title: "Fitness Tracker",
    subtitle: "Track your workouts, calories & health goals",
    items: ["Steps & cardio logs", "Workout routines", "Calorie counter", "Sleep tracker"],
  },
  Lifestyle: {
    icon: "sun",
    title: "Lifestyle Planner",
    subtitle: "Organize habits, goals & daily routines",
    items: ["Daily habits", "Goal setting", "Mood journal", "Productivity tracker"],
  },
};

export default function SectionPlaceholder({ section }: { section: Exclude<AppSection, "Finance"> }) {
  const colors = useColors();
  const meta = SECTION_META[section];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name={meta.icon} size={48} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>{meta.title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{meta.subtitle}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>COMING SOON</Text>
        {meta.items.map((item) => (
          <View key={item} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 0,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rowText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
