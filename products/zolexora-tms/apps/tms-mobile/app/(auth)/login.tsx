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
import { TurnstileWebView } from '../../src/components/TurnstileWebView';
import { config } from '../../src/lib/config';
import { isValidZolexoraOrgId } from '@zolexora/utils/zolexora-id';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error: sessionError } = useAuth();
  const [orgId, setOrgId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  let siteKey = '';
  let authUrl = '';
  try {
    siteKey = config.turnstileSiteKey();
    authUrl = config.authServiceUrl();
  } catch (e: any) {
    return (
      <View style={[styles.container, styles.scrollContent]}>
        <Text style={styles.errorBanner}>{e.message}</Text>
      </View>
    );
  }

  const handleLogin = async () => {
    if (!isValidZolexoraOrgId(orgId.trim().toUpperCase())) {
      setError('Organisation ID must look like ZX-ORG-XXXX-XXXX-XXXX');
      return;
    }
    if (!identifier.trim() || !password) {
      setError('Enter your user ID or email and password');
      return;
    }
    setError(null);
    try {
      await login({ orgId, userIdOrEmail: identifier, password, turnstileToken });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please check your details.');
      // A Turnstile token is single-use: get a fresh one for the next attempt
      setTurnstileToken('');
      setTurnstileKey((k) => k + 1);
    }
  };

  const shownError = error || sessionError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
            Use the Zolexora login your organisation gave you
          </Text>

          {shownError && <Text style={styles.errorBanner}>{shownError}</Text>}

          <Input
            label="Organisation ID"
            placeholder="ZX-ORG-XXXX-XXXX-XXXX"
            value={orgId}
            onChangeText={(v) => setOrgId(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Input
            label="User ID or Email"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TurnstileWebView
            key={turnstileKey}
            siteKey={siteKey}
            action="track2-employee-login"
            baseUrl={authUrl}
            onToken={setTurnstileToken}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            disabled={!turnstileToken}
            size="lg"
            style={styles.loginBtn}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zolexora Transportation Management System</Text>
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
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
