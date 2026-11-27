/**
 * OpsToastBanner – lightweight banner that shows real-time WebSocket event toasts.
 *
 * Mount once inside the root layout. Subscribes to the ops toast bus from
 * useOpsWebSocket and auto-dismisses after 4 seconds.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { onOpsToast } from '../lib/useOpsWebSocket';
import { theme } from '../lib/theme';

export function OpsToastBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3600),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    const unsub = onOpsToast(show);
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!message) return null;

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
