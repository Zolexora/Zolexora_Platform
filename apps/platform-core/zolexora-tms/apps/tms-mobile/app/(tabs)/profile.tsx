import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { PERSONA_META } from '../../src/lib/personas';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const {
    driver,
    vendor,
    me,
    organisation,
    activeOrg,
    activeMode,
    availableModes,
    setActiveMode,
    businesses,
    hasPersonalSession,
    switchBusiness,
    logout,
  } = useAuth();
  const [switchingOrg, setSwitchingOrg] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleSwitchBusiness = async (zxOrgId: string) => {
    setSwitchingOrg(true);
    try {
      await switchBusiness(zxOrgId);
    } catch (e: any) {
      Alert.alert('Unable to switch workspace', e?.message || 'Try signing in again.');
    } finally {
      setSwitchingOrg(false);
    }
  };

  if (!me) return null;

  const displayName = me.full_name || driver?.name || vendor?.name || me.email || 'Zolexora User';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'ZX';

  const meta = PERSONA_META[activeMode];
  const isLicenseExpiringSoon =
    !!driver?.license_expiry &&
    new Date(driver.license_expiry).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity Header */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.driverName}>{displayName}</Text>
          <Text style={[styles.driverRole, { color: meta.accentColor }]}>{meta.title}</Text>
          {activeOrg && (
            <Text style={styles.orgName}>
              {activeOrg.organisation_name}  ·  {organisation?.workspace_type ?? 'SERVICE_PROVIDER'}
            </Text>
          )}
        </View>

        {/* Role / Interface Switcher */}
        {availableModes.length > 1 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Interface Mode</Text>
            <View style={styles.chipWrap}>
              {availableModes.map((mode) => {
                const selected = mode === activeMode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setActiveMode(mode)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {PERSONA_META[mode].shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Account & Workspace Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Zolexora Account</Text>
          <InfoRow label="Zolexora ID" value={me.zolexora_id || me.id} />
          <InfoRow label="Email" value={me.email || '—'} />
          <InfoRow label="Phone" value={me.phone_number || driver?.phone || vendor?.phone || '—'} />
          <InfoRow label="Role" value={me.role_code || (me.is_commander ? 'owner' : 'member')} />
          <InfoRow label="Workspace ID" value={me.zolexora_org_id || activeOrg?.organisation_id || '—'} />
        </Card>

        {/* Driver Section (only when linked to a Driver record) */}
        {driver && (
          <Card style={[styles.section, isLicenseExpiringSoon && styles.sectionWarning]}>
            <Text style={styles.sectionTitle}>
              Driver & License {isLicenseExpiringSoon ? '⚠️' : ''}
            </Text>
            <InfoRow label="License No." value={driver.license_number} />
            <InfoRow
              label="Expiry"
              value={
                driver.license_expiry
                  ? new Date(driver.license_expiry).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            {isLicenseExpiringSoon && (
              <Text style={styles.warningText}>
                License expires within 90 days — contact your fleet manager for renewal.
              </Text>
            )}
          </Card>
        )}

        {/* Vendor Section (only when linked to a Vendor record) */}
        {vendor && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Vendor Profile</Text>
            <InfoRow label="Vendor Name" value={vendor.name} />
            <InfoRow label="Type" value={vendor.vendor_type.replace(/_/g, ' ')} />
            <InfoRow label="GSTIN" value={vendor.gstin || '—'} />
            <InfoRow label="Bank" value={vendor.bank_name || '—'} />
            <InfoRow label="Status" value={vendor.status} />
          </Card>
        )}

        {/* Workspace Switcher for Track 1 Multi-Org Accounts */}
        {hasPersonalSession && businesses.length > 1 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Switch Business Workspace</Text>
            {businesses.map((b) => {
              const current = b.zolexora_org_id === me.zolexora_org_id;
              return (
                <TouchableOpacity
                  key={b.zolexora_org_id}
                  style={styles.infoRow}
                  disabled={current || switchingOrg}
                  onPress={() => handleSwitchBusiness(b.zolexora_org_id)}
                >
                  <Text style={styles.infoLabel}>{b.name}</Text>
                  <Text style={[styles.infoValue, current && { color: theme.colors.success }]}>
                    {current ? 'Active' : 'Switch ›'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        <View style={styles.actions}>
          <Button title="Sign Out" variant="danger" onPress={handleLogout} size="lg" />
          <Text style={styles.versionNote}>Zolexora TMS Mobile · v0.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },

  avatarBlock: { alignItems: 'center', paddingVertical: theme.spacing.xl, marginBottom: theme.spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarInitials: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  driverName: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  driverRole: { fontSize: 14, marginTop: 2, fontWeight: '700' },
  orgName: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' },

  section: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  sectionWarning: { borderColor: theme.colors.warning },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primaryLight },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  infoLabel: { fontSize: 13, color: theme.colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  warningText: { fontSize: 12, color: theme.colors.warning, marginTop: theme.spacing.sm },
  actions: { marginTop: theme.spacing.md },
  versionNote: { textAlign: 'center', fontSize: 11, color: theme.colors.textMuted, marginTop: theme.spacing.lg },
});
