import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/lib/api';
import { PERSONA_META } from '../../src/lib/personas';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import type { Duty, VehicleDetails } from '../../src/types/tms';

interface BookingSummary {
  id: string;
  booking_number: string;
  pickup_address?: string;
  drop_address?: string;
  status: string;
}

interface PayableSummary {
  id: string;
  reference_number?: string | null;
  vendor_id?: string | null;
  driver_id?: string | null;
  net_amount?: string | number;
  status: string;
}

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  total_amount?: string | number;
  status: string;
}

interface DispatchBoardSummary {
  total_active: number;
  lanes: Record<string, Duty[]>;
}

export default function WorkspaceScreen() {
  const router = useRouter();
  const { activeMode, vendor, driver, activeOrg } = useAuth();
  const meta = PERSONA_META[activeMode];

  const isVendorView = activeMode === 'vendor' || activeMode === 'driver_vendor';
  const isDispatchView = activeMode === 'supervisor' || activeMode === 'owner_ops';
  const isFleetView = activeMode === 'fleet_manager' || isVendorView || activeMode === 'owner_ops';
  const isFinanceView = activeMode === 'finance_manager' || activeMode === 'owner_ops' || isVendorView;
  const isBookingView = activeMode === 'owner_ops' || activeMode === 'client';

  const vehiclesQuery = useQuery({
    queryKey: ['mobile-vehicles', activeOrg?.organisation_id],
    queryFn: () => apiClient<VehicleDetails[]>('/api/v1/vehicles?limit=50'),
    enabled: isFleetView,
  });

  const dispatchQuery = useQuery({
    queryKey: ['mobile-dispatch-board', activeOrg?.organisation_id],
    queryFn: () => apiClient<DispatchBoardSummary>('/api/v1/dispatch/board'),
    enabled: isDispatchView,
  });

  const bookingsQuery = useQuery({
    queryKey: ['mobile-bookings', activeOrg?.organisation_id],
    queryFn: () => apiClient<BookingSummary[]>('/api/v1/bookings?limit=20'),
    enabled: isBookingView,
  });

  const payablesQuery = useQuery({
    queryKey: ['mobile-payables', activeOrg?.organisation_id],
    queryFn: () => apiClient<PayableSummary[]>('/api/v1/payables'),
    enabled: isFinanceView,
  });

  const invoicesQuery = useQuery({
    queryKey: ['mobile-invoices', activeOrg?.organisation_id],
    queryFn: () => apiClient<InvoiceSummary[]>('/api/v1/invoices'),
    enabled: activeMode === 'finance_manager' || activeMode === 'owner_ops' || activeMode === 'client',
  });

  const myVehicles = isVendorView && vendor
    ? (vehiclesQuery.data ?? []).filter((v) => v.vendor_id === vendor.id)
    : (vehiclesQuery.data ?? []);

  const myPayables = isVendorView
    ? (payablesQuery.data ?? []).filter(
        (p) => (vendor && p.vendor_id === vendor.id) || (driver && p.driver_id === driver.id),
      )
    : (payablesQuery.data ?? []);

  const refreshing =
    vehiclesQuery.isFetching ||
    dispatchQuery.isFetching ||
    bookingsQuery.isFetching ||
    payablesQuery.isFetching ||
    invoicesQuery.isFetching;

  const refreshAll = () => {
    if (isFleetView) vehiclesQuery.refetch();
    if (isDispatchView) dispatchQuery.refetch();
    if (isBookingView) bookingsQuery.refetch();
    if (isFinanceView) payablesQuery.refetch();
    if (invoicesQuery.isEnabled) invoicesQuery.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.colors.primaryLight} />
        }
      >
        <View style={styles.hero}>
          <Text style={[styles.badge, { color: meta.accentColor }]}>{meta.shortLabel.toUpperCase()} WORKSPACE</Text>
          <Text style={styles.title}>{meta.workspaceTabTitle}</Text>
          <Text style={styles.subtitle}>{meta.tagline}</Text>
        </View>

        {isDispatchView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Dispatch Lanes ({dispatchQuery.data?.total_active ?? 0} active)</Text>
            {Object.entries(dispatchQuery.data?.lanes ?? {}).map(([lane, items]) => (
              <View key={lane} style={styles.rowBetween}>
                <Text style={styles.rowLabel}>{lane.replace(/_/g, ' ')}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{items.length}</Text>
                </View>
              </View>
            ))}
            {Object.values(dispatchQuery.data?.lanes ?? {})
              .flat()
              .slice(0, 5)
              .map((duty) => (
                <TouchableOpacity
                  key={duty.id}
                  style={styles.listItem}
                  onPress={() => router.push(`/duty/${duty.id}`)}
                >
                  <View style={styles.listItemLeft}>
                    <Text style={styles.itemTitle}>{duty.duty_number}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(duty.scheduled_start_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <StatusBadge status={duty.status} />
                </TouchableOpacity>
              ))}
          </Card>
        )}

        {isFleetView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isVendorView ? `My Attached Vehicles (${myVehicles.length})` : `Fleet Vehicles (${myVehicles.length})`}
            </Text>
            {myVehicles.length === 0 ? (
              <Text style={styles.emptyText}>No vehicles linked yet.</Text>
            ) : (
              myVehicles.slice(0, 8).map((v) => (
                <View key={v.id} style={styles.rowBetween}>
                  <View>
                    <Text style={styles.itemTitle}>{v.registration_number}</Text>
                    <Text style={styles.itemSub}>
                      {[v.make, v.model, v.vehicle_type].filter(Boolean).join(' · ') || 'Vehicle'}
                    </Text>
                  </View>
                  <StatusBadge status={v.status || 'ACTIVE'} />
                </View>
              ))
            )}
          </Card>
        )}

        {isBookingView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {activeMode === 'client' ? `My Bookings (${bookingsQuery.data?.length ?? 0})` : `Recent Bookings (${bookingsQuery.data?.length ?? 0})`}
            </Text>
            {(bookingsQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No bookings found.</Text>
            ) : (
              (bookingsQuery.data ?? []).slice(0, 6).map((b) => (
                <View key={b.id} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.itemTitle}>{b.booking_number}</Text>
                    {(b.pickup_address || b.drop_address) && (
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {b.pickup_address || '—'} → {b.drop_address || '—'}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={b.status} />
                </View>
              ))
            )}
          </Card>
        )}

        {isFinanceView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isVendorView ? `My Payables & Settlements (${myPayables.length})` : `Payables (${myPayables.length})`}
            </Text>
            {myPayables.length === 0 ? (
              <Text style={styles.emptyText}>No payables recorded yet.</Text>
            ) : (
              myPayables.slice(0, 6).map((p) => (
                <View key={p.id} style={styles.rowBetween}>
                  <View>
                    <Text style={styles.itemTitle}>{p.reference_number || p.id.slice(0, 8)}</Text>
                    {p.net_amount !== undefined && (
                      <Text style={styles.itemSub}>₹{p.net_amount}</Text>
                    )}
                  </View>
                  <StatusBadge status={p.status} />
                </View>
              ))
            )}
          </Card>
        )}

        {(activeMode === 'finance_manager' || activeMode === 'owner_ops' || activeMode === 'client') && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Invoices ({invoicesQuery.data?.length ?? 0})</Text>
            {(invoicesQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No invoices found.</Text>
            ) : (
              (invoicesQuery.data ?? []).slice(0, 6).map((inv) => (
                <View key={inv.id} style={styles.rowBetween}>
                  <View>
                    <Text style={styles.itemTitle}>{inv.invoice_number}</Text>
                    {inv.total_amount !== undefined && (
                      <Text style={styles.itemSub}>₹{inv.total_amount}</Text>
                    )}
                  </View>
                  <StatusBadge status={inv.status} />
                </View>
              ))
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl },
  hero: { marginBottom: theme.spacing.lg },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  section: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  rowLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  countPill: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryLight },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.sm,
  },
  listItemLeft: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  itemSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted },
});
