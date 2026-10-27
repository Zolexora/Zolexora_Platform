import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
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
import { Duty, DutyStatus } from '../../src/types/tms';

const FILTER_OPTIONS: Array<{ label: string; value: DutyStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: DutyStatus.DRIVER_ACCEPTANCE_PENDING },
  { label: 'Active', value: DutyStatus.IN_TRANSIT },
  { label: 'Completed', value: DutyStatus.DUTY_COMPLETED },
];

function DutyCard({ duty, onPress }: { duty: Duty; onPress: () => void }) {
  const scheduledDate = new Date(duty.scheduled_start_time);
  const timeStr = scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = scheduledDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card style={styles.dutyCard}>
        <View style={styles.dutyCardHeader}>
          <View>
            <Text style={styles.dutyNumber}>{duty.duty_number}</Text>
            <Text style={styles.dutyDate}>{dateStr}  {timeStr}</Text>
          </View>
          <StatusBadge status={duty.status} />
        </View>

        {duty.booking && (
          <View style={styles.routeContainer}>
            <View style={styles.routeRow}>
              <Text style={styles.routeIcon}>📍</Text>
              <Text style={styles.routeText} numberOfLines={1}>{duty.booking.pickup_address}</Text>
            </View>
            <View style={styles.routeDivider} />
            <View style={styles.routeRow}>
              <Text style={styles.routeIcon}>🏁</Text>
              <Text style={styles.routeText} numberOfLines={1}>{duty.booking.drop_address}</Text>
            </View>
          </View>
        )}

        {duty.booking?.cargo_description && (
          <View style={styles.cargoRow}>
            <Text style={styles.cargoIcon}>📦</Text>
            <Text style={styles.cargoText} numberOfLines={1}>
              {duty.booking.cargo_description}
              {duty.booking.cargo_weight_kg ? `  ·  ${duty.booking.cargo_weight_kg} kg` : ''}
            </Text>
          </View>
        )}

        {duty.vehicle && (
          <Text style={styles.vehicleText}>
            🚛  {duty.vehicle.registration_number}
            {duty.vehicle.make ? `  ·  ${duty.vehicle.make} ${duty.vehicle.model || ''}` : ''}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default function DutiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<DutyStatus | 'ALL'>('ALL');

  const { data: duties = [], refetch, isLoading } = useQuery({
    queryKey: ['duties', user?.id],
    queryFn: () => dutiesService.getDuties({ driver_id: user?.id }),
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const filtered = activeFilter === 'ALL'
    ? duties
    : duties.filter((d) => d.status === activeFilter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Duties</Text>
        <Text style={styles.count}>{filtered.length} shown</Text>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterPill, activeFilter === opt.value && styles.filterPillActive]}
            onPress={() => setActiveFilter(opt.value)}
          >
            <Text style={[styles.filterText, activeFilter === opt.value && styles.filterTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DutyCard
            duty={item}
            onPress={() => router.push(`/duty/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.primaryLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyTitle}>No duties found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== 'ALL' ? 'Try a different filter' : 'Duties assigned to you will appear here'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  count: { fontSize: 12, color: theme.colors.textMuted },

  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  filterPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  filterPillActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  filterTextActive: { color: theme.colors.primaryLight },

  list: { padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xxxl },

  dutyCard: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  dutyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  dutyNumber: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  dutyDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  routeContainer: { marginBottom: theme.spacing.sm },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeIcon: { fontSize: 12, marginTop: 2 },
  routeText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  routeDivider: { height: 8, width: 1, backgroundColor: theme.colors.border, marginLeft: 5, marginVertical: 2 },

  cargoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.xs },
  cargoIcon: { fontSize: 12 },
  cargoText: { flex: 1, fontSize: 12, color: theme.colors.textMuted },

  vehicleText: { fontSize: 12, color: theme.colors.textMuted, marginTop: theme.spacing.xs },

  empty: { alignItems: 'center', paddingVertical: theme.spacing.xxxl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  emptySubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xxxl },
});
