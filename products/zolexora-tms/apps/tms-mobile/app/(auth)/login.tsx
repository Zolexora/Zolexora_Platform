import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { theme } from '../../src/lib/theme';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Card } from '../../src/components/Card';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginDemo, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('rajesh.kumar@zolexora-fleet.com');
  const [orgId, setOrgId] = useState('org-demo-01');
  const [password, setPassword] = useState('••••••••');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError('Please enter your mobile number or email');
      return;
    }
    setError(null);
    try {
      await login(identifier, orgId);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check credentials.');
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    try {
      await loginDemo();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Failed to start demo session');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>ZOLEXORA TMS</Text>
          <Text style={styles.appTagline}>Driver & Fleet Operations</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Driver Sign In</Text>
          <Text style={styles.cardSubtitle}>
            Access your assigned duties, trips, and vehicle logs
          </Text>

          {error && <Text style={styles.errorBanner}>{error}</Text>}

          <Input
            label="Email or Mobile Number"
            placeholder="e.g. driver@zolexora.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Password / Access Code"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Input
            label="Organization ID"
            placeholder="org-demo-01"
            value={orgId}
            onChangeText={setOrgId}
            autoCapitalize="none"
          />

          <Button
            title="Sign In to Fleet"
            onPress={handleLogin}
            loading={isLoading}
            size="lg"
            style={styles.loginBtn}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR QUICK DEMO</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Test Drive as Demo Driver"
            variant="outline"
            onPress={handleDemoLogin}
            disabled={isLoading}
            size="md"
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zolexora Transportation Management System</Text>
          <Text style={styles.versionText}>v0.1.0 (Expo New Architecture)</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    letterSpacing: 1.5,
  },
  appTagline: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    padding: theme.spacing.xl,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerMuted,
    color: theme.colors.danger,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  loginBtn: {
    marginTop: theme.spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: theme.spacing.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  versionText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
});
