import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
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
  const { user, activeOrg, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (!user) return null;

  const licenseExpiry = new Date(user.license_expiry);
  const isLicenseExpiringSoon =
    licenseExpiry.getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar / Identity Block */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>
              {user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.driverName}>{user.name}</Text>
          <Text style={styles.driverRole}>Fleet Driver</Text>
          {activeOrg && (
            <Text style={styles.orgName}>{activeOrg.organisation_name}</Text>
          )}
        </View>

        {/* Driver Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Details</Text>
          <InfoRow label="Phone" value={user.phone} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Driver ID" value={user.id} />
        </Card>

        {/* License */}
        <Card style={[styles.section, isLicenseExpiringSoon && styles.sectionWarning]}>
          <Text style={styles.sectionTitle}>
            License Information {isLicenseExpiringSoon ? '⚠️' : ''}
          </Text>
          <InfoRow label="License No." value={user.license_number} />
          <InfoRow
            label="Expiry"
            value={new Date(user.license_expiry).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
          {isLicenseExpiringSoon && (
            <Text style={styles.warningText}>
              License expires within 90 days — contact your fleet manager for renewal.
            </Text>
          )}
        </Card>

        {/* Assigned Vehicle */}
        {user.assigned_vehicle_reg && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Vehicle</Text>
            <View style={styles.vehicleReg}>
              <Text style={styles.vehicleRegText}>{user.assigned_vehicle_reg}</Text>
            </View>
          </Card>
        )}

        {/* Duty Status */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.dutyStatusRow}>
            <View style={[styles.statusDot, user.is_on_duty ? styles.dotActive : styles.dotInactive]} />
            <Text style={styles.statusText}>
              {user.is_on_duty ? 'On Duty' : 'Off Duty'}
            </Text>
          </View>
          {user.active_duty_id && (
            <Text style={styles.activeDutyRef}>
              Active Duty: {user.active_duty_id}
            </Text>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Sign Out"
            variant="danger"
            onPress={handleLogout}
            size="lg"
          />
          <Text style={styles.versionNote}>
            Zolexora TMS Mobile  ·  v0.1.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },

  avatarBlock: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
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
  driverRole: { fontSize: 14, color: theme.colors.primaryLight, marginTop: 2, fontWeight: '600' },
  orgName: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

  section: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  sectionWarning: { borderColor: theme.colors.warning },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: theme.spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle },
  infoLabel: { fontSize: 13, color: theme.colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  warningText: { fontSize: 12, color: theme.colors.warning, marginTop: theme.spacing.sm },

  vehicleReg: { alignSelf: 'center', backgroundColor: theme.colors.surfaceSubtle, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  vehicleRegText: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 2 },

  dutyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { backgroundColor: theme.colors.success },
  dotInactive: { backgroundColor: theme.colors.textMuted },
  statusText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  activeDutyRef: { fontSize: 12, color: theme.colors.textMuted, marginTop: theme.spacing.xs },

  actions: { marginTop: theme.spacing.md },
  versionNote: { textAlign: 'center', fontSize: 11, color: theme.colors.textMuted, marginTop: theme.spacing.lg },
});
