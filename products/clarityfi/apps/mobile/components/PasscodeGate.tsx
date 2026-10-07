import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSecurity } from "@/context/AppSecurityContext";

const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["bio", "0", "del"],
];

interface Props {
  mode?: "unlock" | "setup" | "confirm";
  onSuccess?: (code: string) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}

export function PasscodeInput({
  mode = "unlock",
  onSuccess,
  onCancel,
  title,
  subtitle,
}: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const { unlock, unlockWithBiometric, biometricEnabled, biometricAvailable } =
    useAppSecurity();
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = useCallback(
    async (key: string) => {
      if (key === "del") {
        setDigits((d) => d.slice(0, -1));
        setError(false);
        return;
      }
      if (key === "bio") {
        const ok = await unlockWithBiometric();
        if (!ok && Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return;
      }
      if (digits.length >= 4) return;
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const next = [...digits, key];
      setDigits(next);

      if (next.length === 4) {
        const code = next.join("");
        if (mode === "unlock") {
          const ok = unlock(code);
          if (!ok) {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            shake();
            setError(true);
            setTimeout(() => {
              setDigits([]);
              setError(false);
            }, 600);
          }
        } else {
          onSuccess?.(code);
          setDigits([]);
        }
      }
    },
    [digits, mode, unlock, unlockWithBiometric, onSuccess]
  );

  useEffect(() => {
    if (mode === "unlock" && biometricEnabled && biometricAvailable) {
      const t = setTimeout(() => unlockWithBiometric(), 300);
      return () => clearTimeout(t);
    }
  }, [mode, biometricEnabled, biometricAvailable]);

  const showBio =
    (mode === "unlock" && biometricEnabled && biometricAvailable) ||
    false;

  return (
    <View style={[styles.inputRoot, { paddingBottom: insets.bottom + 20 }]}>
      {/* Title */}
      <View style={styles.headerArea}>
        <View style={styles.logoBox}>
          <Feather name="shield" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>{title ?? "Enter Passcode"}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {/* Dot indicators */}
      <Animated.View
        style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              digits.length > i
                ? error
                  ? styles.dotError
                  : styles.dotFilled
                : styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {error ? (
        <Text style={styles.errorText}>Incorrect passcode</Text>
      ) : (
        <View style={{ height: 20 }} />
      )}

      {/* Number pad */}
      <View style={styles.pad}>
        {DIGITS.map((row, ri) => (
          <View key={ri} style={styles.padRow}>
            {row.map((key) => {
              const isBio = key === "bio";
              const isDel = key === "del";
              const isHidden = isBio && !showBio;

              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.padKey, (isBio || isDel) && styles.padKeyAlt]}
                  onPress={() => !isHidden && handleDigit(key)}
                  activeOpacity={isHidden ? 1 : 0.6}
                  disabled={isHidden}
                >
                  {isBio && showBio ? (
                    <Feather name="aperture" size={24} color="#FFFFFF" />
                  ) : isDel ? (
                    <Feather name="delete" size={22} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.padDigit}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {onCancel && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PasscodeGate() {
  const { isLocked, isLoaded } = useAppSecurity();
  if (!isLoaded || !isLocked) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <PasscodeInput mode="unlock" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#1A1B2E",
    zIndex: 9999,
    justifyContent: "center",
  },
  inputRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 40,
    gap: 10,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  dotFilled: {
    backgroundColor: "#6366F1",
  },
  dotError: {
    backgroundColor: "#F43F5E",
  },
  errorText: {
    color: "#F43F5E",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    height: 20,
  },
  pad: {
    marginTop: 32,
    gap: 12,
    width: "100%",
    maxWidth: 300,
  },
  padRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  padKey: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  padKeyAlt: {
    backgroundColor: "transparent",
  },
  padDigit: {
    color: "#FFFFFF",
    fontSize: 26,
    fontFamily: "Inter_400Regular",
  },
  cancelBtn: {
    marginTop: 32,
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
