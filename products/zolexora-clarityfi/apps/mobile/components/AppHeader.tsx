import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";
import { useColors } from "@/hooks/useColors";
import { type AppSection, useSection } from "@/context/SectionContext";

const SECTIONS: AppSection[] = ["Finance", "Fitness", "Lifestyle"];

interface Props {
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
}

export default function AppHeader({ rightIcon, onRightPress, rightLabel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openDrawer } = useDrawer();
  const { activeSection, setActiveSection } = useSection();
  const topPad = Platform.OS === "web" ? 12 : insets.top;

  const selectSection = (section: AppSection) => {
    if (section === activeSection) return;
    setActiveSection(section);
    router.replace("/");
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={openDrawer} style={styles.iconBtn} activeOpacity={0.7}>
          <Feather name="menu" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.primary }]}>ClarityFi</Text>

        <TouchableOpacity
          onPress={onRightPress}
          style={styles.iconBtn}
          activeOpacity={0.7}
          disabled={!onRightPress}
        >
          {rightIcon ? (
            <Feather name={rightIcon} size={22} color={colors.foreground} />
          ) : rightLabel ? (
            <Text style={[styles.rightLabel, { color: colors.mutedForeground }]}>{rightLabel}</Text>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionBar}>
        {SECTIONS.map((s) => {
          const active = s === activeSection;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => selectSection(s)}
              activeOpacity={0.7}
              style={[
                styles.pill,
                active
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.muted },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  rightLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  sectionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
