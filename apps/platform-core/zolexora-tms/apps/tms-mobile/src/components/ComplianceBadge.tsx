import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';
import { getExpiryInfo, type ExpiryColor } from '../lib/compliance';

interface ComplianceBadgeProps {
  label: string;
  expiry?: string | null;   // ISO date string e.g. "2026-03-15"
  daysWarn?: number;        // days before expiry to show warning (default 30)
}

const COLOR_MAP: Record<ExpiryColor, { bg: string; text: string; border: string }> = {
  success: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  warning: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  danger:  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  muted:   { bg: theme.colors.surfaceSubtle, text: theme.colors.textMuted, border: theme.colors.border },
};

export function ComplianceBadge({ label, expiry, daysWarn = 30 }: ComplianceBadgeProps) {
  const { color, text } = getExpiryInfo(expiry, daysWarn);
  const palette = COLOR_MAP[color];

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.badgeText, { color: palette.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: { fontSize: 13, color: theme.colors.textSecondary },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
