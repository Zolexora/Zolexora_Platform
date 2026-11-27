import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { dutiesService } from '../../src/services/dutiesService';
import { apiClient } from '../../src/lib/api';
import { PERSONA_META } from '../../src/lib/personas';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { DutyStatus } from '../../src/types/tms';

export default function DashboardScreen() {
  const router = useRouter();
  const {
    user,
    driver,
    vendor,
    me,
    activeOrg,
    activeMode,
    availableModes,
    setActiveMode,
  } = useAuth();

  const meta = PERSONA_META[activeMode];
  const isDriverScoped = activeMode === 'driver' || activeMode === 'driver_vendor';

  const { data: duties = [], refetch, isLoading } = useQuery({
    queryKey: ['duties', activeOrg?.organisation_id, activeMode, driver?.id],
    queryFn: () => dutiesService.getDuties(isDriverScoped && driver?.id ? { driver_id: driver.id } : undefined),
    enabled: !!activeOrg?.organisation_id && (!isDriverScoped || !!driver?.id),
    refetchInterval: 30_000,
  });

  const dispatchQuery = useQuery({
    queryKey: ['dashboard-dispatch', activeOrg?.organisation_id],
    queryFn: () => apiClient<{ total_active: number }>('/api/v1/dispatch/board'),
    enabled: activeMode === 'supervisor' || activeMode === 'owner_ops',
  });

  const activeDuty = duties.find(
    (d) => d.status !== DutyStatus.DUTY_COMPLETED && d.status !== DutyStatus.CANCELLED,
  );
  const pendingDuties = duties.filter(
    (d) => d.status === DutyStatus.DRIVER_ACCEPTANCE_PENDING || d.status === DutyStatus.UNASSIGNED,
  );
  const completedCount = duties.filter((d) => d.status === DutyStatus.DUTY_COMPLETED).length;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName =
    me?.full_name || driver?.name || vendor?.name || me?.email || 'Team Member';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || dispatchQuery.isFetching}
            onRefresh={() => {
              refetch();
              if (dispatchQuery.isEnabled) dispatchQuery.refetch();
            }}
            tintColor={theme.colors.primaryLight}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.driverName}>{displayName}</Text>
            {activeOrg && <Text style={styles.orgName}>{activeOrg.organisation_name}</Text>}
          </View>
          <View style={[styles.rolePill, { backgroundColor: meta.badgeBg }]}>
            <Text style={[styles.rolePillText, { color: meta.accentColor }]}>{meta.shortLabel}</Text>
          </View>
        </View>

        {/* Multi-Role / Driver-cum-Vendor Interface Switcher */}
        {availableModes.length > 1 && (
          <View style={styles.modeSection}>
            <Text style={styles.modeLabel}>Active Interface</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
              {availableModes.map((mode) => {
                const selected = mode === activeMode;
                const modeMeta = PERSONA_META[mode];
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeChip, selected && styles.modeChipActive]}
                    onPress={() => setActiveMode(mode)}
                  >
                    <Text style={[styles.modeChipText, selected && styles.modeChipTextActive]}>
                      {modeMeta.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Vendor / Driver-Cum-Vendor Identity Card */}
        {(activeMode === 'vendor' || activeMode === 'driver_vendor') && vendor && (
          <Card style={styles.vendorCard}>
            <Text style={styles.vendorTitle}>🏭  {vendor.name}</Text>
            <Text style={styles.vendorSub}>
              {vendor.vendor_type.replace(/_/g, ' ')}  ·  Status: {vendor.status}
            </Text>
          </Card>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>
              {activeMode === 'supervisor' || activeMode === 'owner_ops'
                ? dispatchQuery.data?.total_active ?? duties.length
                : duties.length}
            </Text>
            <Text style={styles.statLabel}>
              {activeMode === 'client' ? 'Active Trips' : isDriverScoped ? 'My Duties' : 'Total Duties'}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, pendingDuties.length > 0 && styles.statValueAlert]}>
              {pendingDuties.length}
            </Text>
            <Text style={styles.statLabel}>
              {isDriverScoped ? 'Pending Accept' : 'Needs Action'}
            </Text>
          </Card>
        </View>

        {/* Active Duty Card */}
        {activeDuty && (
          <TouchableOpacity onPress={() => router.push(`/duty/${activeDuty.id}`)}>
            <Card style={styles.activeDutyCard} highlight>
              <View style={styles.activeDutyHeader}>
                <Text style={styles.activeDutyTitle}>🚚  Live Duty</Text>
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
              <Text style={styles.tapHint}>Tap to view & update →</Text>
            </Card>
          </TouchableOpacity>
        )}

        {/* Pending Alerts */}
        {pendingDuties.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>⚠️  Attention Required</Text>
            {pendingDuties.slice(0, 4).map((duty) => (
              <TouchableOpacity key={duty.id} onPress={() => router.push(`/duty/${duty.id}`)}>
                <Card style={styles.pendingCard}>
                  <View style={styles.pendingRow}>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingDutyNumber}>{duty.duty_number}</Text>
                      <Text style={styles.pendingRoute} numberOfLines={1}>
                        {duty.booking
                          ? `${duty.booking.pickup_address} → ${duty.booking.drop_address}`
                          : duty.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <Text style={styles.pendingArrow}>›</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            ...(meta.showDutiesTab ? [{ label: 'Duties', icon: '🚚', route: '/duties' }] : []),
            ...(meta.showWorkspaceTab
              ? [{ label: meta.workspaceTabTitle, icon: meta.workspaceTabIcon, route: '/workspace' }]
              : []),
            { label: 'Account & Role', icon: '👤', route: '/profile' },
            ...(user ? [{ label: 'Driver License', icon: '🪪', route: '/profile' }] : []),
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
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 14, color: theme.colors.textSecondary },
  driverName: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  orgName: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rolePill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
  },
  rolePillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  modeSection: { marginBottom: theme.spacing.lg },
  modeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs + 2,
  },
  modeRow: { gap: theme.spacing.sm },
  modeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modeChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  modeChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  modeChipTextActive: { color: theme.colors.primaryLight },

  vendorCard: { marginBottom: theme.spacing.lg, padding: theme.spacing.md },
  vendorTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  vendorSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  statCard: { flex: 1, alignItems: 'center', padding: theme.spacing.md },
  statValue: { fontSize: 26, fontWeight: '900', color: theme.colors.textPrimary },
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

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },

  pendingCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderColor: theme.colors.warning },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingInfo: { flex: 1 },
  pendingDutyNumber: { fontSize: 14, fontWeight: '700', color: theme.colors.warning },
  pendingRoute: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  pendingArrow: { fontSize: 22, color: theme.colors.textMuted, marginLeft: 8 },

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
