import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { dutiesService } from '../../src/services/dutiesService';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { DutyStatus } from '../../src/types/tms';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeOrg, isOnDuty, toggleDutyStatus } = useAuth();

  const { data: duties = [], refetch, isLoading } = useQuery({
    queryKey: ['duties', user?.id],
    queryFn: () => dutiesService.getDuties({ driver_id: user?.id }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const activeDuty = duties.find(
    (d) =>
      d.status !== DutyStatus.DUTY_COMPLETED && d.status !== DutyStatus.CANCELLED
  );

  const pendingDuties = duties.filter(
    (d) => d.status === DutyStatus.DRIVER_ACCEPTANCE_PENDING
  );

  const todayCompleted = duties.filter(
    (d) => d.status === DutyStatus.DUTY_COMPLETED
  ).length;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primaryLight}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.driverName}>{user?.name ?? 'Driver'}</Text>
            {activeOrg && (
              <Text style={styles.orgName}>{activeOrg.organisation_name}</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.statusToggle, isOnDuty && styles.statusToggleActive]}
            onPress={toggleDutyStatus}
          >
            <Text style={styles.statusToggleText}>
              {isOnDuty ? '🟢  On Duty' : '⚫  Off Duty'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{duties.length}</Text>
            <Text style={styles.statLabel}>Duties Today</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{todayCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, pendingDuties.length > 0 && styles.statValueAlert]}>
              {pendingDuties.length}
            </Text>
            <Text style={styles.statLabel}>Pending Accept</Text>
          </Card>
        </View>

        {/* Active Duty Card */}
        {activeDuty && (
          <TouchableOpacity onPress={() => router.push(`/duty/${activeDuty.id}`)}>
            <Card style={styles.activeDutyCard} highlight>
              <View style={styles.activeDutyHeader}>
                <Text style={styles.activeDutyTitle}>🚚  Active Duty</Text>
                <StatusBadge status={activeDuty.status} />
              </View>
              <Text style={styles.dutyNumber}>{activeDuty.duty_number}</Text>
              {activeDuty.booking && (
                <>
                  <View style={styles.addressRow}>
                    <Text style={styles.addressIcon}>📍</Text>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {activeDuty.booking.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.addressArrow} />
                  <View style={styles.addressRow}>
                    <Text style={styles.addressIcon}>🏁</Text>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {activeDuty.booking.drop_address}
                    </Text>
                  </View>
                </>
              )}
              <Text style={styles.tapHint}>Tap to manage duty →</Text>
            </Card>
          </TouchableOpacity>
        )}

        {/* Pending Acceptance Alerts */}
        {pendingDuties.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>⚠️  Requires Your Response</Text>
            {pendingDuties.map((duty) => (
              <TouchableOpacity
                key={duty.id}
                onPress={() => router.push(`/duty/${duty.id}`)}
              >
                <Card style={styles.pendingCard}>
                  <View style={styles.pendingRow}>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingDutyNumber}>{duty.duty_number}</Text>
                      {duty.booking && (
                        <Text style={styles.pendingRoute} numberOfLines={1}>
                          {duty.booking.pickup_address} → {duty.booking.drop_address}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.pendingArrow}>›</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Vehicle Info */}
        {user?.assigned_vehicle_reg && (
          <Card style={styles.vehicleCard}>
            <Text style={styles.sectionTitle}>🚗  Assigned Vehicle</Text>
            <Text style={styles.vehicleReg}>{user.assigned_vehicle_reg}</Text>
          </Card>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: 'All Duties', icon: '📋', route: '/duties' },
            { label: 'Log Expense', icon: '💰', route: '/duties' },
            { label: 'Fleet Info', icon: '🔧', route: '/profile' },
            { label: 'Contact Dispatch', icon: '📞', route: '/profile' },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => router.push(action.route as any)}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  greeting: { fontSize: 14, color: theme.colors.textSecondary },
  driverName: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  orgName: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  statusToggle: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusToggleActive: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successMuted,
  },
  statusToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  statValueAlert: { color: theme.colors.warning },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },

  activeDutyCard: { marginBottom: theme.spacing.xl, padding: theme.spacing.xl },
  activeDutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  activeDutyTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.primaryLight },
  dutyNumber: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  addressIcon: { fontSize: 14, marginTop: 2 },
  addressText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  addressArrow: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4, marginLeft: 22 },
  tapHint: { fontSize: 12, color: theme.colors.primaryLight, marginTop: theme.spacing.md, textAlign: 'right' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: theme.spacing.md, marginTop: theme.spacing.sm },

  pendingCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderColor: theme.colors.warning },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingInfo: { flex: 1 },
  pendingDutyNumber: { fontSize: 14, fontWeight: '700', color: theme.colors.warning },
  pendingRoute: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  pendingArrow: { fontSize: 22, color: theme.colors.textMuted, marginLeft: 8 },

  vehicleCard: { marginBottom: theme.spacing.xl, padding: theme.spacing.lg },
  vehicleReg: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 1 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  actionCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
});
