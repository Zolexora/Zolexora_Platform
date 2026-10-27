import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, highlight = false }) => {
  return (
    <View
      style={[
        styles.card,
        highlight && styles.highlight,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  highlight: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceSubtle,
  },
});
