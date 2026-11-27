import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../lib/theme';
import { storage } from '../lib/storage';

/**
 * OfflineBanner — detects connectivity loss using periodic fetch probes
 * and displays pending offline GPS ping count from storage.
 */
const PROBE_URL = 'https://www.google.com/generate_204';
const PROBE_INTERVAL_MS = 10_000;

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    const probe = async () => {
      const queued = await storage.getQueuedGpsPings().catch(() => []);
      if (mounted) setQueuedCount(queued.length);

      try {
        const res = await fetch(PROBE_URL, { method: 'HEAD', cache: 'no-store' });
        if (!mounted) return;
        if (res.status < 400) {
          setIsOffline(false);
          if (queued.length === 0) {
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
          } else {
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          }
        } else {
          setIsOffline(true);
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
      } catch {
        if (!mounted) return;
        setIsOffline(true);
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    };

    probe();
    const timer = setInterval(probe, PROBE_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [opacity]);

  if (!isOffline && queuedCount === 0) return null;

  return (
    <Animated.View style={[styles.banner, !isOffline && styles.bannerSyncing, { opacity }]}>
      <Text style={styles.text}>
        {isOffline
          ? `📡  Offline — ${queuedCount} GPS ${queuedCount === 1 ? 'ping' : 'pings'} queued`
          : `🔄  Syncing ${queuedCount} buffered GPS ${queuedCount === 1 ? 'ping' : 'pings'}...`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.danger,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  bannerSyncing: {
    backgroundColor: theme.colors.warning,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
