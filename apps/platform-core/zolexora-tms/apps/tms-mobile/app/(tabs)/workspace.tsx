import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/lib/api';
import { getVehicleComplianceIssues } from '../../src/lib/compliance';
import { PERSONA_META } from '../../src/lib/personas';
import { dutiesService } from '../../src/services/dutiesService';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import type { Duty, VehicleDetails } from '../../src/types/tms';

interface BookingSummary {
  id: string;
  booking_number: string;
  pickup_address?: string;
  drop_address?: string;
  status: string;
  pickup_datetime?: string;
}

interface BookingRequestSummary {
  id: string;
  request_number: string;
  pickup_address: string;
  drop_address: string;
  status: string;
  pickup_datetime: string;
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

interface ExpenseSummary {
  id: string;
  category: string;
  amount: string | number;
  notes?: string | null;
  expense_date: string;
}

interface DispatchBoardSummary {
  total_active: number;
  lanes: Record<string, Duty[]>;
}

const LANE_KEYS = ['ALLOCATED', 'DISPATCHED', 'ARRIVED_PICKUP', 'IN_TRANSIT', 'ARRIVED_DROP', 'DUTY_COMPLETED'] as const;

export default function WorkspaceScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeMode, vendor, driver, activeOrg } = useAuth();
  const meta = PERSONA_META[activeMode];
  const [selectedLane, setSelectedLane] = useState<string>('ALL');
  const [dispatchSearch, setDispatchSearch] = useState('');

  const isVendorView = activeMode === 'vendor' || activeMode === 'driver_vendor';
  const isDispatchView = activeMode === 'supervisor' || activeMode === 'owner_ops';
  const isFleetView = activeMode === 'fleet_manager' || isVendorView || activeMode === 'owner_ops';
  const isFinanceView = activeMode === 'finance_manager' || activeMode === 'owner_ops' || isVendorView;
  const isBookingView = activeMode === 'owner_ops' || activeMode === 'client';
  const canFinanceMutate = activeMode === 'finance_manager' || activeMode === 'owner_ops';
  const isInvoiceView = activeMode === 'finance_manager' || activeMode === 'owner_ops' || activeMode === 'client';

  const vehiclesQuery = useQuery({
    queryKey: ['mobile-vehicles', activeOrg?.organisation_id],
    queryFn: () => apiClient<VehicleDetails[]>('/api/v1/vehicles?limit=50'),
    enabled: isFleetView,
  });

  const vendorDutiesQuery = useQuery({
    queryKey: ['mobile-vendor-duties', activeOrg?.organisation_id, vendor?.id],
    queryFn: () => dutiesService.getDuties({ vendor_id: vendor!.id }),
    enabled: isVendorView && !!vendor?.id,
  });

  const dispatchQuery = useQuery({
    queryKey: ['mobile-dispatch-board', activeOrg?.organisation_id],
    queryFn: () => apiClient<DispatchBoardSummary>('/api/v1/dispatch/board'),
    enabled: isDispatchView,
  });

  const rostersQuery = useQuery({
    queryKey: ['mobile-rosters', activeOrg?.organisation_id],
    queryFn: () => dutiesService.listRosters(),
    enabled: isDispatchView,
  });

  const generateRosterMutation = useMutation({
    mutationFn: (rosterId: string) => dutiesService.generateRosterDuties(rosterId, 7),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
      qc.invalidateQueries({ queryKey: ['duties'] });
      Alert.alert('Roster Generated', `Created ${res.created_count} duties (${res.skipped_count} already existed).`);
    },
    onError: (err: Error) => Alert.alert('Generate Failed', err.message),
  });

  const clientDutiesQuery = useQuery({
    queryKey: ['mobile-client-duties', activeOrg?.organisation_id],
    queryFn: () => dutiesService.getDuties(),
    enabled: activeMode === 'client',
  });

  const bookingsQuery = useQuery({
    queryKey: ['mobile-bookings', activeOrg?.organisation_id],
    queryFn: () => apiClient<BookingSummary[]>('/api/v1/bookings?limit=20'),
    enabled: isBookingView,
  });

  const bookingRequestsQuery = useQuery({
    queryKey: ['mobile-booking-requests', activeOrg?.organisation_id],
    queryFn: () => apiClient<BookingRequestSummary[]>('/api/v1/booking-requests?limit=20'),
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
    enabled: isInvoiceView,
  });

  const expensesQuery = useQuery({
    queryKey: ['mobile-expenses', activeOrg?.organisation_id],
    queryFn: () => apiClient<ExpenseSummary[]>('/api/v1/expenses'),
    enabled: activeMode === 'finance_manager' || activeMode === 'owner_ops',
  });

  const dispatchMutation = useMutation({
    mutationFn: (dutyId: string) => dutiesService.dispatchDuty(dutyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
      qc.invalidateQueries({ queryKey: ['duties'] });
    },
    onError: (err: Error) => Alert.alert('Dispatch Error', err.message),
  });

  const confirmReqMutation = useMutation({
    mutationFn: (requestId: string) =>
      apiClient(`/api/v1/booking-requests/${requestId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-booking-requests'] });
      qc.invalidateQueries({ queryKey: ['mobile-bookings'] });
    },
    onError: (err: Error) => Alert.alert('Confirm Failed', err.message),
  });

  const createDutyFromBookingMutation = useMutation({
    mutationFn: (b: BookingSummary) => {
      const start = b.pickup_datetime || new Date(Date.now() + 3600000).toISOString();
      const end = new Date(new Date(start).getTime() + 4 * 3600000).toISOString();
      return apiClient(`/api/v1/bookings/${b.id}/create-duty`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_start_time: start,
          scheduled_end_time: end,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
      qc.invalidateQueries({ queryKey: ['duties'] });
      Alert.alert('Duty Created', 'Duty is now queued on the Dispatch Board.');
    },
    onError: (err: Error) => Alert.alert('Create Duty Failed', err.message),
  });

  const approvePayableMutation = useMutation({
    mutationFn: (payableId: string) =>
      apiClient(`/api/v1/payables/${payableId}/approve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-payables'] }),
    onError: (err: Error) => Alert.alert('Approval Failed', err.message),
  });

  const finalizeInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient(`/api/v1/invoices/${invoiceId}/finalize`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mobile-invoices'] }),
    onError: (err: Error) => Alert.alert('Finalize Failed', err.message),
  });

  const myVehicles = isVendorView && vendor
    ? (vehiclesQuery.data ?? []).filter((v) => v.vendor_id === vendor.id)
    : (vehiclesQuery.data ?? []);

  const myPayables = isVendorView
    ? (payablesQuery.data ?? []).filter(
        (p) => (vendor && p.vendor_id === vendor.id) || (driver && p.driver_id === driver.id),
      )
    : (payablesQuery.data ?? []);

  const dispatchItems = useMemo(() => {
    const base =
      selectedLane === 'ALL'
        ? Object.values(dispatchQuery.data?.lanes ?? {}).flat()
        : (dispatchQuery.data?.lanes?.[selectedLane] ?? []);
    const q = dispatchSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (d) =>
        d.duty_number.toLowerCase().includes(q) ||
        (d.vehicle?.registration_number || '').toLowerCase().includes(q) ||
        (d.driver?.full_name || '').toLowerCase().includes(q) ||
        (d.booking?.customer_name || '').toLowerCase().includes(q) ||
        (d.booking?.pickup_address || '').toLowerCase().includes(q) ||
        (d.booking?.drop_address || '').toLowerCase().includes(q),
    );
  }, [dispatchQuery.data, selectedLane, dispatchSearch]);

  const refreshing =
    vehiclesQuery.isFetching ||
    vendorDutiesQuery.isFetching ||
    dispatchQuery.isFetching ||
    clientDutiesQuery.isFetching ||
    bookingsQuery.isFetching ||
    bookingRequestsQuery.isFetching ||
    payablesQuery.isFetching ||
    invoicesQuery.isFetching ||
    expensesQuery.isFetching;

  const refreshAll = () => {
    if (isFleetView) vehiclesQuery.refetch();
    if (isVendorView && vendor?.id) vendorDutiesQuery.refetch();
    if (isDispatchView) dispatchQuery.refetch();
    if (activeMode === 'client') clientDutiesQuery.refetch();
    if (isBookingView) {
      bookingsQuery.refetch();
      bookingRequestsQuery.refetch();
    }
    if (isFinanceView) payablesQuery.refetch();
    if (isInvoiceView) invoicesQuery.refetch();
    if (expensesQuery.isEnabled) expensesQuery.refetch();
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

        {/* Client / Ops quick booking CTA */}
        {isBookingView && (
          <Button
            title={activeMode === 'client' ? '🚖  Request Cab / Trip' : '+  Create Trip Request'}
            variant="primary"
            onPress={() => router.push('/booking/new')}
            style={{ marginBottom: theme.spacing.md }}
          />
        )}

        {/* Supervisor / Ops Dispatch Board */}
        {isDispatchView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Dispatch Board ({dispatchQuery.data?.total_active ?? 0} active)</Text>
            <TextInput
              style={styles.dispatchSearchInput}
              placeholder="Search duty #, vehicle, driver, client..."
              placeholderTextColor={theme.colors.textMuted}
              value={dispatchSearch}
              onChangeText={setDispatchSearch}
              clearButtonMode="while-editing"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.laneRow}>
              <TouchableOpacity
                style={[styles.laneChip, selectedLane === 'ALL' && styles.laneChipActive]}
                onPress={() => setSelectedLane('ALL')}
              >
                <Text style={[styles.laneChipText, selectedLane === 'ALL' && styles.laneChipTextActive]}>
                  All ({dispatchQuery.data?.total_active ?? 0})
                </Text>
              </TouchableOpacity>
              {LANE_KEYS.map((lane) => {
                const count = dispatchQuery.data?.lanes?.[lane]?.length ?? 0;
                const active = selectedLane === lane;
                return (
                  <TouchableOpacity
                    key={lane}
                    style={[styles.laneChip, active && styles.laneChipActive]}
                    onPress={() => setSelectedLane(lane)}
                  >
                    <Text style={[styles.laneChipText, active && styles.laneChipTextActive]}>
                      {lane.replace(/_/g, ' ')} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {dispatchItems.length === 0 ? (
              <Text style={styles.emptyText}>No duties in this lane.</Text>
            ) : (
              dispatchItems.slice(0, 12).map((duty) => (
                <View key={duty.id} style={styles.dispatchCard}>
                  <TouchableOpacity style={styles.listItemLeft} onPress={() => router.push(`/duty/${duty.id}`)}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.itemTitle}>{duty.duty_number}</Text>
                      <StatusBadge status={duty.status} />
                    </View>
                    {duty.booking && (
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {duty.booking.pickup_address} → {duty.booking.drop_address}
                      </Text>
                    )}
                    <Text style={styles.metaText}>
                      {duty.driver ? `🧑‍✈️ ${duty.driver.full_name}` : 'Unassigned driver'}
                      {duty.vehicle ? `  ·  🚛 ${duty.vehicle.registration_number}` : ''}
                    </Text>
                  </TouchableOpacity>

                  {(duty.status === 'UNASSIGNED' ||
                    duty.status === 'ASSIGNED' ||
                    duty.status === 'DRIVER_ACCEPTANCE_PENDING' ||
                    duty.status === 'ACCEPTED') && (
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => router.push(`/dispatch/assign/${duty.id}`)}
                      >
                        <Text style={styles.smallBtnText}>{duty.driver_id ? 'Reassign' : 'Assign'}</Text>
                      </TouchableOpacity>
                      {(duty.status === 'ASSIGNED' || duty.status === 'ACCEPTED') && (
                        <TouchableOpacity
                          style={[styles.smallBtn, styles.smallBtnPrimary]}
                          onPress={() => dispatchMutation.mutate(duty.id)}
                        >
                          <Text style={styles.smallBtnPrimaryText}>Dispatch</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* ETS / Fixed Shift Rosters */}
        {isDispatchView && (rostersQuery.data?.length ?? 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🗓️ ETS / Fixed Shift Rosters ({rostersQuery.data?.length ?? 0})</Text>
            {(rostersQuery.data ?? []).slice(0, 6).map((r) => (
              <View key={r.id} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {r.route_code} · {r.route_name}
                  </Text>
                  <Text style={styles.itemSub}>
                    {r.shift_label} ({r.shift_time}){r.escort_required ? ' · 🛡️ Escort' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.smallBtnPrimary]}
                  disabled={generateRosterMutation.isPending}
                  onPress={() => generateRosterMutation.mutate(r.id)}
                >
                  <Text style={styles.smallBtnPrimaryText}>+7 Days</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Vendor Attached Duties */}
        {isVendorView && vendor && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>My Fleet Duties ({vendorDutiesQuery.data?.length ?? 0})</Text>
            {(vendorDutiesQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No duties scheduled for your vehicles or drivers yet.</Text>
            ) : (
              (vendorDutiesQuery.data ?? []).slice(0, 6).map((d) => (
                <TouchableOpacity key={d.id} style={styles.listItem} onPress={() => router.push(`/duty/${d.id}`)}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.itemTitle}>{d.duty_number}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {d.vehicle?.registration_number || 'Vehicle'} ·{' '}
                      {d.booking ? `${d.booking.pickup_address} → ${d.booking.drop_address}` : d.status}
                    </Text>
                  </View>
                  <StatusBadge status={d.status} />
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}

        {/* Client Live Cab & Trip Tracking */}
        {activeMode === 'client' && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Live Cab & Trip Tracking ({clientDutiesQuery.data?.length ?? 0})</Text>
            {(clientDutiesQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No active trips yet.</Text>
            ) : (
              (clientDutiesQuery.data ?? []).slice(0, 8).map((d) => (
                <TouchableOpacity key={d.id} style={styles.listItem} onPress={() => router.push(`/duty/${d.id}`)}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.itemTitle}>{d.booking?.booking_number || d.duty_number}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {d.booking ? `${d.booking.pickup_address} → ${d.booking.drop_address}` : d.duty_number}
                    </Text>
                    {d.vehicle && (
                      <Text style={styles.metaText}>
                        🚛 {d.vehicle.registration_number}
                        {d.driver ? ` · 🧑‍✈️ ${d.driver.full_name}` : ''}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={d.status} />
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}

        {/* Fleet Vehicles */}
        {isFleetView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isVendorView ? `My Attached Vehicles (${myVehicles.length})` : `Fleet Vehicles (${myVehicles.length})`}
            </Text>
            {myVehicles.length === 0 ? (
              <Text style={styles.emptyText}>No vehicles linked yet.</Text>
            ) : (
              myVehicles.slice(0, 10).map((v) => {
                const issues = getVehicleComplianceIssues(v);
                return (
                <TouchableOpacity
                  key={v.id}
                  style={styles.rowBetween}
                  onPress={() => router.push(`/vehicle/${v.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{v.registration_number}</Text>
                    <Text style={styles.itemSub}>
                      {[v.make, v.model, v.vehicle_type].filter(Boolean).join(' · ') || 'Vehicle'}
                    </Text>
                    {issues.expired.length > 0 ? (
                      <Text style={styles.compDangerText}>🔴 Expired: {issues.expired.join(', ')}</Text>
                    ) : issues.expiringSoon.length > 0 ? (
                      <Text style={styles.compWarnText}>🟡 Expiring: {issues.expiringSoon.join(', ')}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={v.status || 'ACTIVE'} />
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
                );
              })
            )}
          </Card>
        )}

        {/* Booking Requests */}
        {isBookingView && (bookingRequestsQuery.data?.length ?? 0) > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Requests ({bookingRequestsQuery.data?.length ?? 0})</Text>
            {(bookingRequestsQuery.data ?? []).slice(0, 6).map((req) => (
              <View key={req.id} style={styles.dispatchCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.itemTitle}>{req.request_number}</Text>
                  <StatusBadge status={req.status} />
                </View>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {req.pickup_address} → {req.drop_address}
                </Text>
                {activeMode === 'owner_ops' && req.status === 'SUBMITTED' && (
                  <View style={styles.inlineActions}>
                    <TouchableOpacity
                      style={[styles.smallBtn, styles.smallBtnPrimary]}
                      onPress={() => confirmReqMutation.mutate(req.id)}
                    >
                      <Text style={styles.smallBtnPrimaryText}>Confirm Request</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Confirmed Bookings */}
        {isBookingView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>
              {activeMode === 'client' ? `My Bookings (${bookingsQuery.data?.length ?? 0})` : `Recent Bookings (${bookingsQuery.data?.length ?? 0})`}
            </Text>
            {(bookingsQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No bookings found.</Text>
            ) : (
              (bookingsQuery.data ?? []).slice(0, 6).map((b) => (
                <View key={b.id} style={styles.dispatchCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.itemTitle}>{b.booking_number}</Text>
                    <StatusBadge status={b.status} />
                  </View>
                  {(b.pickup_address || b.drop_address) && (
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {b.pickup_address || '—'} → {b.drop_address || '—'}
                    </Text>
                  )}
                  {activeMode === 'owner_ops' && b.status === 'CONFIRMED' && (
                    <View style={styles.inlineActions}>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => createDutyFromBookingMutation.mutate(b)}
                      >
                        <Text style={styles.smallBtnText}>+ Create Duty</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* Payables & Settlements */}
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{p.reference_number || p.id.slice(0, 8)}</Text>
                    {p.net_amount !== undefined && <Text style={styles.itemSub}>₹{p.net_amount}</Text>}
                  </View>
                  {canFinanceMutate && p.status === 'DRAFT' ? (
                    <TouchableOpacity
                      style={[styles.smallBtn, styles.smallBtnPrimary]}
                      onPress={() => approvePayableMutation.mutate(p.id)}
                    >
                      <Text style={styles.smallBtnPrimaryText}>Approve</Text>
                    </TouchableOpacity>
                  ) : (
                    <StatusBadge status={p.status} />
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* Invoices */}
        {isInvoiceView && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Invoices ({invoicesQuery.data?.length ?? 0})</Text>
            {(invoicesQuery.data ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No invoices found.</Text>
            ) : (
              (invoicesQuery.data ?? []).slice(0, 6).map((inv) => (
                <View key={inv.id} style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{inv.invoice_number}</Text>
                    {inv.total_amount !== undefined && <Text style={styles.itemSub}>₹{inv.total_amount}</Text>}
                  </View>
                  {canFinanceMutate && inv.status === 'DRAFT' ? (
                    <TouchableOpacity
                      style={[styles.smallBtn, styles.smallBtnPrimary]}
                      onPress={() => finalizeInvoiceMutation.mutate(inv.id)}
                    >
                      <Text style={styles.smallBtnPrimaryText}>Finalize</Text>
                    </TouchableOpacity>
                  ) : (
                    <StatusBadge status={inv.status} />
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* Finance Expenses Overview */}
        {canFinanceMutate && (
          <Card style={styles.section}>
            <View style={styles.rowHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                Recent Expenses ({expensesQuery.data?.length ?? 0})
              </Text>
              <TouchableOpacity style={styles.smallBtn} onPress={() => router.push('/expense/log')}>
                <Text style={styles.smallBtnText}>+ Log</Text>
              </TouchableOpacity>
            </View>
            {(expensesQuery.data ?? []).length === 0 ? (
              <Text style={[styles.emptyText, { marginTop: 10 }]}>No expenses logged yet.</Text>
            ) : (
              (expensesQuery.data ?? []).slice(0, 5).map((exp) => (
                <View key={exp.id} style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{exp.category.replace(/_/g, ' ')}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {exp.notes || new Date(exp.expense_date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.amountText}>₹{exp.amount}</Text>
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
  laneRow: { gap: 8, marginBottom: theme.spacing.md },
  laneChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  laneChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
  laneChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  laneChipTextActive: { color: theme.colors.primaryLight },

  dispatchCard: {
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  inlineActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  smallBtnPrimary: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  smallBtnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: 8,
  },
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
  chevron: { fontSize: 18, color: theme.colors.textMuted, marginLeft: 4 },
  amountText: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  emptyText: { fontSize: 13, color: theme.colors.textMuted },
  dispatchSearchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSubtle,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  compDangerText: { fontSize: 11, fontWeight: '700', color: theme.colors.danger, marginTop: 2 },
  compWarnText: { fontSize: 11, fontWeight: '700', color: theme.colors.warning, marginTop: 2 },
});