import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../lib/theme';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — catches render-time errors in screen trees.
 * Wrap individual tab screens in app/(tabs)/_layout.tsx.
 * Shows a friendly retry screen instead of a blank white crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ hasError: false, errorMessage: '' });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{this.props.fallbackLabel ?? 'Something went wrong'}</Text>
          <Text style={styles.msg} numberOfLines={3}>{this.state.errorMessage}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.md, backgroundColor: theme.colors.background },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  msg: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
  btn: { marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
