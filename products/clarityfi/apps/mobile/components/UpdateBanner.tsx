/**
 * UpdateBanner — ClarityFi in-app update notification
 *
 * A slim, non-intrusive banner that slides in from the bottom when a newer
 * version of ClarityFi is available on GitHub Releases.
 *
 * Design principles:
 * - Never blocks the user or shows a modal
 * - Fully dismissible with a swipe or the × button
 * - Respects the dark olive theme (#3B3828 / #C9A840)
 * - Links directly to the APK download
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useUpdateCheck } from "@/hooks/useUpdateCheck";

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 56;
const GOLD = "#C9A840";
const DARK_BG = "#2A2818";
const MUTED = "#9A9070";

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpdateBanner() {
  const update = useUpdateCheck();
  const [dismissed, setDismissed] = useState(false);

  // Slide-up animation
  const slideY = useRef(new Animated.Value(BANNER_HEIGHT)).current;

  useEffect(() => {
    if (update?.available && !dismissed) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    }
  }, [update?.available, dismissed, slideY]);

  function handleDismiss() {
    Animated.timing(slideY, {
      toValue: BANNER_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  }

  function handleUpdate() {
    if (update?.downloadUrl) {
      Linking.openURL(update.downloadUrl).catch(() => {
        // Fallback to release page if APK link fails
        Linking.openURL(update!.releasePageUrl);
      });
    }
    handleDismiss();
  }

  if (!update?.available || dismissed) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideY }] }]}
      accessibilityRole="alert"
      accessibilityLabel={`ClarityFi v${update.version} is available. Tap to update.`}
    >
      {/* Left: update icon + text */}
      <View style={styles.left}>
        <Text style={styles.icon}>↑</Text>
        <View>
          <Text style={styles.title}>
            v{update.version} available
          </Text>
          <Text style={styles.subtitle}>Tap to download the latest build</Text>
        </View>
      </View>

      {/* Right: CTA + dismiss */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleUpdate}
          style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Update Now"
        >
          <Text style={styles.ctaText}>Update</Text>
        </Pressable>

        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss update notification"
        >
          <Text style={styles.dismiss}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    backgroundColor: DARK_BG,
    borderTopWidth: 1,
    borderTopColor: "rgba(201,168,64,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  icon: {
    color: GOLD,
    fontSize: 18,
    fontWeight: "700",
    width: 22,
    textAlign: "center",
  },
  title: {
    color: GOLD,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  subtitle: {
    color: MUTED,
    fontSize: 11,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ctaBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ctaBtnPressed: {
    opacity: 0.8,
  },
  ctaText: {
    color: "#1A1A0F",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dismiss: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
});
