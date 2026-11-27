import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
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
import type { BusinessOption } from '../../src/types/tms';

type AuthTrack = 'track2' | 'track1';
type LoginStep = 'credentials' | 'choose_business' | 'mfa';

export default function LoginScreen() {
  const router = useRouter();
  const {
    loginTrack1,
    selectTrack1Business,
    loginTrack2,
    completeTrack2Mfa,
    isLoading,
    error: sessionError,
  } = useAuth();

  const [track, setTrack] = useState<AuthTrack>('track2');
  const [step, setStep] = useState<LoginStep>('credentials');

  // Credentials
  const [orgId, setOrgId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);

  // Multi-org / MFA continuations
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [loginTicket, setLoginTicket] = useState<string | null>(null);
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [selectedTrack1Org, setSelectedTrack1Org] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
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

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileKey((k) => k + 1);
  };

  const resetFlow = (nextTrack?: AuthTrack) => {
    if (nextTrack) setTrack(nextTrack);
    setStep('credentials');
    setBusinesses([]);
    setLoginTicket(null);
    setMfaTicket(null);
    setSelectedTrack1Org(null);
    setMfaCode('');
    setError(null);
    resetTurnstile();
  };

  const handleCredentialsSubmit = async () => {
    const cleanOrg = orgId.trim().toUpperCase();
    if (track === 'track2' && cleanOrg && !isValidZolexoraOrgId(cleanOrg)) {
      setError('Organisation ID must look like ZX-ORG-XXXX-XXXX-XXXX (or leave blank)');
      return;
    }
    if (!identifier.trim() || !password) {
      setError('Enter your user ID / email / phone and password');
      return;
    }
    setError(null);

    try {
      if (track === 'track2') {
        const res = await loginTrack2({
          orgId: cleanOrg || undefined,
          identifier,
          password,
          turnstileToken,
        });
        if (res.status === 'signed_in') {
          router.replace('/(tabs)');
        } else if (res.status === 'choose_business') {
          setBusinesses(res.businesses);
          setLoginTicket(res.login_ticket);
          setStep('choose_business');
        } else if (res.status === 'mfa_required') {
          setMfaTicket(res.mfa_ticket);
          setStep('mfa');
        }
      } else {
        const orgs = await loginTrack1({ identifier, password, turnstileToken });
        if (orgs.length === 0) {
          setError('No businesses found on this Zolexora account. Create or join one on the web portal first.');
          resetTurnstile();
          return;
        }
        if (orgs.length === 1) {
          try {
            await selectTrack1Business(orgs[0].zolexora_org_id);
            router.replace('/(tabs)');
          } catch (openErr: any) {
            if (openErr?.code === 'AUTH_MFA_REQUIRED') {
              setSelectedTrack1Org(orgs[0].zolexora_org_id);
              setStep('mfa');
              setError(null);
            } else {
              throw openErr;
            }
          }
        } else {
          setBusinesses(orgs);
          setStep('choose_business');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Sign-in failed. Please check your details.');
      resetTurnstile();
    }
  };

  const handleSelectBusiness = async (zxOrgId: string) => {
    setError(null);
    try {
      if (track === 'track2') {
        if (!loginTicket) throw new Error('Login session expired. Start again.');
        const res = await loginTrack2({ orgId: zxOrgId, loginTicket });
        if (res.status === 'signed_in') {
          router.replace('/(tabs)');
        } else if (res.status === 'mfa_required') {
          setMfaTicket(res.mfa_ticket);
          setStep('mfa');
        }
      } else {
        try {
          await selectTrack1Business(zxOrgId);
          router.replace('/(tabs)');
        } catch (openErr: any) {
          if (openErr?.code === 'AUTH_MFA_REQUIRED') {
            setSelectedTrack1Org(zxOrgId);
            setStep('mfa');
            setError(null);
          } else {
            throw openErr;
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to open workspace.');
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaCode.trim()) {
      setError('Enter the 6-digit authenticator code');
      return;
    }
    setError(null);
    try {
      if (track === 'track2') {
        if (!mfaTicket) throw new Error('MFA challenge expired. Sign in again.');
        await completeTrack2Mfa(mfaTicket, mfaCode);
      } else {
        if (!selectedTrack1Org) throw new Error('Select a workspace first.');
        await selectTrack1Business(selectedTrack1Org, mfaCode.trim());
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Invalid authenticator code');
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
          <Text style={styles.appTagline}>Drivers · Vendors · Dispatch · Clients</Text>
        </View>

        <Card style={styles.card}>
          {step === 'credentials' && (
            <>
              <View style={styles.trackSwitch}>
                <TouchableOpacity
                  style={[styles.trackTab, track === 'track2' && styles.trackTabActive]}
                  onPress={() => resetFlow('track2')}
                >
                  <Text style={[styles.trackTabText, track === 'track2' && styles.trackTabTextActive]}>
                    Staff / Driver / Vendor
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.trackTab, track === 'track1' && styles.trackTabActive]}
                  onPress={() => resetFlow('track1')}
                >
                  <Text style={[styles.trackTabText, track === 'track1' && styles.trackTabTextActive]}>
                    Owner / Client
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardTitle}>
                {track === 'track2' ? 'Organisation Sign In' : 'Zolexora Account Sign In'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {track === 'track2'
                  ? 'Drivers, vendors, supervisors, and staff credentials'
                  : 'Business owners, operations heads, and client portals'}
              </Text>

              {shownError && <Text style={styles.errorBanner}>{shownError}</Text>}

              {track === 'track2' && (
                <Input
                  label="Organisation ID (Optional)"
                  placeholder="ZX-ORG-XXXX-XXXX-XXXX"
                  value={orgId}
                  onChangeText={(v) => setOrgId(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              )}

              <Input
                label={track === 'track2' ? 'ZX User ID, Email or Phone' : 'Email or Phone'}
                placeholder={track === 'track2' ? 'ZX-USR-... or email' : 'you@company.com'}
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
                action={track === 'track2' ? 'track2-employee-login' : 'track1-public-login'}
                baseUrl={authUrl}
                onToken={setTurnstileToken}
              />

              <Button
                title="Sign In"
                onPress={handleCredentialsSubmit}
                loading={isLoading}
                disabled={!turnstileToken}
                size="lg"
                style={styles.loginBtn}
              />
            </>
          )}

          {step === 'choose_business' && (
            <>
              <Text style={styles.cardTitle}>Choose Workspace</Text>
              <Text style={styles.cardSubtitle}>
                Select which business workspace to open in Zolexora TMS
              </Text>
              {shownError && <Text style={styles.errorBanner}>{shownError}</Text>}

              <View style={styles.orgList}>
                {businesses.map((b) => (
                  <TouchableOpacity
                    key={b.zolexora_org_id}
                    style={styles.orgOption}
                    onPress={() => handleSelectBusiness(b.zolexora_org_id)}
                    disabled={isLoading}
                  >
                    <View style={styles.orgOptionText}>
                      <Text style={styles.orgOptionName}>{b.name}</Text>
                      <Text style={styles.orgOptionId}>
                        {b.zolexora_org_id}
                        {b.role_name || b.role ? `  ·  ${b.role_name || b.role}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.orgArrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button title="Back" variant="outline" onPress={() => resetFlow()} style={styles.loginBtn} />
            </>
          )}

          {step === 'mfa' && (
            <>
              <Text style={styles.cardTitle}>Two-Factor Verification</Text>
              <Text style={styles.cardSubtitle}>
                Enter the 6-digit code from your authenticator app
              </Text>
              {shownError && <Text style={styles.errorBanner}>{shownError}</Text>}

              <Input
                label="Authenticator Code"
                placeholder="123456"
                value={mfaCode}
                onChangeText={setMfaCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Button
                title="Verify & Continue"
                onPress={handleMfaSubmit}
                loading={isLoading}
                size="lg"
                style={styles.loginBtn}
              />
              <Button title="Back" variant="outline" onPress={() => resetFlow()} style={styles.loginBtn} />
            </>
          )}
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
    marginBottom: theme.spacing.xl,
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
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    padding: theme.spacing.xl,
  },
  trackSwitch: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 4,
    marginBottom: theme.spacing.lg,
  },
  trackTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  trackTabActive: {
    backgroundColor: theme.colors.primaryMuted,
  },
  trackTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  trackTabTextActive: {
    color: theme.colors.primaryLight,
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
    marginBottom: theme.spacing.lg,
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
  orgList: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  orgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  orgOptionText: {
    flex: 1,
  },
  orgOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  orgOptionId: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orgArrow: {
    fontSize: 22,
    color: theme.colors.primaryLight,
    marginLeft: theme.spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
