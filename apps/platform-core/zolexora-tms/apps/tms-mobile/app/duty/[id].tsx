import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dutiesService, TripRecord } from '../../src/services/dutiesService';
import { useAuth } from '../../src/context/AuthContext';
import { useDriverLocation } from '../../src/lib/useDriverLocation';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { MilestoneTracker } from '../../src/components/MilestoneTracker';
import { DutyStatus } from '../../src/types/tms';

type MilestoneAction = 'arrived-pickup' | 'in-transit' | 'arrived-drop' | 'complete';

function getNextAction(status: DutyStatus): {
  label: string;
  milestone: MilestoneAction;
  variant: 'primary' | 'success' | 'secondary';
} | null {
  switch (status) {
    case DutyStatus.DISPATCHED:
      return { label: '📍  Arrived at Pickup', milestone: 'arrived-pickup', variant: 'primary' };
    case DutyStatus.ARRIVED_PICKUP:
      return { label: '🚚  Start Transit', milestone: 'in-transit', variant: 'primary' };
    case DutyStatus.IN_TRANSIT:
      return { label: '🏁  Arrived at Drop', milestone: 'arrived-drop', variant: 'primary' };
    case DutyStatus.ARRIVED_DROP:
      return { label: '✅  Complete Duty', milestone: 'complete', variant: 'success' };
    default:
      return null;
  }
}

function InfoBlock({ label, value, full = false }: { label: string; value?: string | null; full?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.infoBlock, full && styles.infoBlockFull]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function DutyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeMode, me, permissions, driver, vendor } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  const canExecuteDriverActions = activeMode === 'driver' || activeMode === 'driver_vendor';
  const canDispatch = activeMode === 'supervisor' || activeMode === 'owner_ops';

  const { data: duty, isLoading, error } = useQuery({
    queryKey: ['duty', id],
    queryFn: () => dutiesService.getDutyById(id!),
    enabled: !!id,
  });

  // Trip from enriched duty.trip (may be null if no trip yet)
  const trip = (duty as (typeof duty & { trip?: TripRecord | null }) | undefined)?.trip ?? null;
  const isTripActive = !!trip && (trip.status === 'IN_TRANSIT' || trip.status === 'IN_PROGRESS');
  const isAssignedDriver = !!driver?.id && duty?.driver_id === driver.id;

  const canViewLiveTracking = useMemo(() => {
    if (!duty || !trip) return false;
    if (me?.is_commander) return true;
    const permSet = new Set(permissions);
    if (
      permSet.has('operations.tracking.view') ||
      permSet.has('tms:operations_tracking:view') ||
      permSet.has('operations.dispatch.view') ||
      permSet.has('tms:operations_dispatch:view')
    ) {
      return true;
    }
    if (activeMode === 'client') return true;
    if (driver?.id && duty.driver_id === driver.id) return true;
    if (vendor?.id && (duty.vehicle?.vendor_id === vendor.id || duty.driver?.vendor_id === vendor.id)) {
      return true;
    }
    return false;
  }, [activeMode, driver?.id, duty, me?.is_commander, permissions, trip, vendor?.id]);

  const { startTracking, stopTracking, isBackgroundActive } = useDriverLocation(trip?.id);

  // Ensure background tracking stays active while driver's trip is IN_TRANSIT, and stops once finished
  useEffect(() => {
    if (!canExecuteDriverActions || !isAssignedDriver) return;
    if (isTripActive && duty?.status === DutyStatus.IN_TRANSIT && trip?.id) {
      startTracking(trip.id).catch(() => {});
    } else if (
      duty?.status === DutyStatus.ARRIVED_DROP ||
      duty?.status === DutyStatus.DUTY_COMPLETED ||
      trip?.status === 'COMPLETED' ||
      trip?.status === 'CANCELLED'
    ) {
      stopTracking().catch(() => {});
    }
  }, [canExecuteDriverActions, duty?.status, isAssignedDriver, isTripActive, startTracking, stopTracking, trip?.id, trip?.status]);

  const tripEventsQuery = useQuery({
    queryKey: ['trip-events', trip?.id],
    queryFn: () => dutiesService.getTripEvents(trip!.id, { limit: 25 }),
    enabled: !!trip?.id && canViewLiveTracking,
    refetchInterval: isTripActive ? 30_000 : false,
  });

  const gpsEvents = useMemo(
    () => (tripEventsQuery.data ?? []).filter((ev) => ev.latitude != null && ev.longitude != null),
    [tripEventsQuery.data],
  );
  const latestGps = gpsEvents[0] ?? null;

  const dispatchMutation = useMutation({
    mutationFn: () => dutiesService.dispatchDuty(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duties'] });
      qc.invalidateQueries({ queryKey: ['duty', id] });
      qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
    },
    onError: (err: Error) => Alert.alert('Dispatch Failed', err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: () => dutiesService.acceptDuty(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duties'] });
      qc.invalidateQueries({ queryKey: ['duty', id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => dutiesService.rejectDuty(id!, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duties'] });
      router.back();
    },
  });

  const milestoneMutation = useMutation({
    mutationFn: (milestone: MilestoneAction) =>
      dutiesService.advanceMilestone(id!, milestone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duties'] });
      qc.invalidateQueries({ queryKey: ['duty', id] });
    },
  });

  const handleAccept = () => {
    Alert.alert('Accept Duty', `Accept ${duty?.duty_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          setActionLoading(true);
          try {
            await acceptMutation.mutateAsync();
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = () => {
    Alert.prompt
      ? Alert.prompt('Reject Duty', 'Reason for rejection (optional):', async (reason) => {
          setActionLoading(true);
          try {
            await rejectMutation.mutateAsync(reason || 'Rejected by driver');
          } finally {
            setActionLoading(false);
          }
        })
      : Alert.alert('Reject Duty', `Reject ${duty?.duty_number}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                await rejectMutation.mutateAsync('Rejected by driver');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]);
  };

  const handleMilestone = (milestone: MilestoneAction, label: string) => {
    Alert.alert('Confirm Action', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setActionLoading(true);
          try {
            await milestoneMutation.mutateAsync(milestone);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading duty...</Text>
      </View>
    );
  }

  if (error || !duty) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Duty not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const nextAction = getNextAction(duty.status);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.dutyNumber}>{duty.duty_number}</Text>
            <Text style={styles.bookingRef}>
              Booking: {duty.booking?.booking_number ?? duty.booking_id}
            </Text>
          </View>
          <StatusBadge status={duty.status} />
        </View>

        {/* Milestone Progress */}
        {duty.status !== DutyStatus.UNASSIGNED &&
          duty.status !== DutyStatus.DRIVER_ACCEPTANCE_PENDING &&
          duty.status !== DutyStatus.CANCELLED && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Trip Progress</Text>
              <MilestoneTracker currentStatus={duty.status} />
            </Card>
          )}

        {/* Booking Details */}
        {duty.booking && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📋  Booking Details</Text>
            <InfoBlock label="Customer" value={duty.booking.customer_name} />
            <InfoBlock label="Phone" value={duty.booking.customer_phone} />
            <InfoBlock label="Cargo" value={duty.booking.cargo_description} />
            {duty.booking.cargo_weight_kg && (
              <InfoBlock label="Weight" value={`${duty.booking.cargo_weight_kg} kg`} />
            )}

            <View style={styles.routeBlock}>
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.pickupDot]} />
                <View style={styles.routeText}>
                  <Text style={styles.routePointLabel}>PICKUP</Text>
                  <Text style={styles.routeAddress}>{duty.booking.pickup_address}</Text>
                  <Text style={styles.routeDateTime}>
                    {new Date(duty.booking.pickup_datetime).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.routeConnector} />
              <View style={styles.routePoint}>
                <View style={[styles.routeDot, styles.dropDot]} />
                <View style={styles.routeText}>
                  <Text style={styles.routePointLabel}>DROP</Text>
                  <Text style={styles.routeAddress}>{duty.booking.drop_address}</Text>
                </View>
              </View>
            </View>

            {duty.booking.special_instructions && (
              <View style={styles.specialInstructions}>
                <Text style={styles.specialInstructionsLabel}>⚠️  Special Instructions</Text>
                <Text style={styles.specialInstructionsText}>
                  {duty.booking.special_instructions}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Vehicle */}
        {duty.vehicle && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🚛  Vehicle</Text>
            <InfoBlock label="Registration" value={duty.vehicle.registration_number} />
            <InfoBlock
              label="Vehicle"
              value={`${duty.vehicle.make ?? ''} ${duty.vehicle.model ?? ''}`.trim() || undefined}
            />
            <InfoBlock label="Fuel Type" value={duty.vehicle.fuel_type} />
            {duty.vehicle.odometer_km && (
              <InfoBlock label="Odometer" value={`${duty.vehicle.odometer_km} km`} />
            )}
          </Card>
        )}

        {/* Driver */}
        {duty.driver && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🧑‍✈️  Assigned Driver</Text>
            <InfoBlock label="Driver Name" value={duty.driver.full_name} />
            <InfoBlock label="Contact" value={duty.driver.phone} />
          </Card>
        )}

        {/* Scheduled Times */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🕐  Schedule</Text>
          <InfoBlock
            label="Scheduled Start"
            value={new Date(duty.scheduled_start_time).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
          <InfoBlock
            label="Scheduled End"
            value={new Date(duty.scheduled_end_time).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
          {duty.start_time && (
            <InfoBlock
              label="Actual Start"
              value={new Date(duty.start_time).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {duty.end_time && (
            <InfoBlock
              label="Actual End"
              value={new Date(duty.end_time).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {duty.start_km != null && <InfoBlock label="Start KM" value={`${duty.start_km} km`} />}
          {duty.end_km != null && <InfoBlock label="End KM" value={`${duty.end_km} km`} />}
        </Card>

        {duty.notes && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📝  Notes</Text>
            <Text style={styles.notes}>{duty.notes}</Text>
          </Card>
        )}

        {/* Trip Summary Card */}
        {trip && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🗺️  Trip — {trip.trip_number}</Text>
            <View style={styles.tripRow}>
              <View style={styles.tripStat}>
                <Text style={styles.tripStatVal}>{trip.start_odometer ?? '—'}</Text>
                <Text style={styles.tripStatLbl}>Start km</Text>
              </View>
              <View style={styles.tripStatDivider} />
              <View style={styles.tripStat}>
                <Text style={styles.tripStatVal}>{trip.end_odometer ?? '—'}</Text>
                <Text style={styles.tripStatLbl}>End km</Text>
              </View>
              <View style={styles.tripStatDivider} />
              <View style={styles.tripStat}>
                <Text style={styles.tripStatVal}>
                  {trip.total_distance_km != null ? `${trip.total_distance_km}` : '—'}
                </Text>
                <Text style={styles.tripStatLbl}>Distance</Text>
              </View>
            </View>
            {(trip.toll_amount > 0 || trip.fuel_amount > 0 || trip.parking_amount > 0) && (
              <View style={styles.expenseRow}>
                {trip.toll_amount > 0 && <Text style={styles.expenseChip}>🛣️ ₹{trip.toll_amount} toll</Text>}
                {trip.fuel_amount > 0 && <Text style={styles.expenseChip}>⛽ ₹{trip.fuel_amount} fuel</Text>}
                {trip.parking_amount > 0 && <Text style={styles.expenseChip}>🅿️ ₹{trip.parking_amount} park</Text>}
              </View>
            )}
            {trip.pod_attachment_url && (
              <View style={styles.podBadge}>
                <Text style={styles.podBadgeText}>✅  POD Uploaded</Text>
              </View>
            )}
          </Card>
        )}

        {/* Permission-Gated Live GPS Tracking Card */}
        {trip && canViewLiveTracking && (
          <Card style={styles.section}>
            <View style={styles.gpsHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>📍  Live GPS Tracking</Text>
              {canExecuteDriverActions && isAssignedDriver && isTripActive && (
                <TouchableOpacity
                  style={[styles.gpsPill, isBackgroundActive ? styles.gpsPillActive : styles.gpsPillWarn]}
                  onPress={() => startTracking(trip.id)}
                >
                  <Text style={styles.gpsPillText}>
                    {isBackgroundActive ? '● Background GPS On' : 'Enable Background GPS'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {latestGps ? (
              <View style={styles.gpsBody}>
                <Text style={styles.gpsCoords}>
                  {latestGps.latitude!.toFixed(5)}, {latestGps.longitude!.toFixed(5)}
                </Text>
                <Text style={styles.gpsMeta}>
                  Last ping: {new Date(latestGps.timestamp).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })} · {gpsEvents.length} recorded {gpsEvents.length === 1 ? 'point' : 'points'}
                </Text>
                <TouchableOpacity
                  style={styles.mapsBtn}
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${latestGps.latitude},${latestGps.longitude}`,
                    )
                  }
                >
                  <Text style={styles.mapsBtnText}>🗺️  Open Live Location in Maps</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.gpsMeta}>
                {tripEventsQuery.isLoading ? 'Loading GPS pings...' : 'No GPS pings recorded yet for this trip.'}
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        {/* Supervisor / Ops Assignment & Dispatch Controls */}
        {canDispatch &&
          (duty.status === DutyStatus.UNASSIGNED ||
            duty.status === DutyStatus.ASSIGNED ||
            duty.status === DutyStatus.DRIVER_ACCEPTANCE_PENDING ||
            duty.status === DutyStatus.ACCEPTED) && (
            <View style={[styles.footerRow, { marginBottom: canExecuteDriverActions ? 8 : 0 }]}>
              <Button
                title={duty.driver_id ? 'Reassign' : 'Assign Driver & Vehicle'}
                variant="outline"
                onPress={() => router.push(`/dispatch/assign/${id}`)}
                style={styles.footerBtn}
              />
              {(duty.status === DutyStatus.ASSIGNED || duty.status === DutyStatus.ACCEPTED) && (
                <Button
                  title="🚀  Dispatch"
                  variant="primary"
                  onPress={() => dispatchMutation.mutate()}
                  loading={dispatchMutation.isPending}
                  style={styles.footerBtn}
                />
              )}
            </View>
          )}

        {/* Driver execution controls */}
        {canExecuteDriverActions && (
          <>
            {(duty.status === DutyStatus.DRIVER_ACCEPTANCE_PENDING || duty.status === DutyStatus.ASSIGNED) && (
              <View style={styles.footerRow}>
                <Button
                  title="Reject"
                  variant="danger"
                  onPress={handleReject}
                  loading={actionLoading && rejectMutation.isPending}
                  style={styles.footerBtn}
                />
                <Button
                  title="Accept Duty"
                  variant="success"
                  onPress={handleAccept}
                  loading={actionLoading && acceptMutation.isPending}
                  style={styles.footerBtn}
                />
              </View>
            )}

            {duty.status === DutyStatus.ACCEPTED && !canDispatch && (
              <View style={styles.completedBanner}>
                <Text style={styles.completedText}>✓ Accepted — Waiting for dispatch release</Text>
              </View>
            )}

            {/* Start Trip — shown when IN_TRANSIT and no trip yet */}
            {duty.status === DutyStatus.IN_TRANSIT && !trip && (
              <View style={styles.footerCol}>
                <Button
                  title="🚀  Start Trip"
                  variant="primary"
                  size="lg"
                  onPress={() => router.push(`/duty/start-trip/${id}`)}
                />
                <Button
                  title="💸  Log Expense"
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/expense/log',
                      params: { duty_id: id, vehicle_id: duty.vehicle_id, driver_id: duty.driver_id },
                    })
                  }
                  style={{ marginTop: 8 }}
                />
              </View>
            )}

            {/* Complete Trip — shown when trip exists and in transit */}
            {isTripActive && (
              <View style={styles.footerCol}>
                <Button
                  title="🏁  Complete Trip"
                  variant="success"
                  size="lg"
                  onPress={() => router.push({ pathname: `/duty/complete-trip/${trip.id}`, params: { duty_id: id } })}
                />
                <Button
                  title="💸  Log Expense"
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/expense/log',
                      params: { duty_id: id, trip_id: trip.id, vehicle_id: duty.vehicle_id, driver_id: duty.driver_id },
                    })
                  }
                  style={{ marginTop: 8 }}
                />
              </View>
            )}

            {/* Milestone actions for active duties */}
            {nextAction && !trip && duty.status !== DutyStatus.IN_TRANSIT && (
              <Button
                title={nextAction.label}
                variant={nextAction.variant}
                size="lg"
                onPress={() => handleMilestone(nextAction.milestone, nextAction.label)}
                loading={actionLoading && milestoneMutation.isPending}
              />
            )}
          </>
        )}

        {duty.status === DutyStatus.DUTY_COMPLETED && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✅  Duty completed</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 8 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.background },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary },
  errorIcon: { fontSize: 40 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xl },
  dutyNumber: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  bookingRef: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  section: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: theme.spacing.md, textTransform: 'uppercase', letterSpacing: 0.4 },

  infoBlock: { marginBottom: theme.spacing.sm },
  infoBlockFull: { width: '100%' },
  infoLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  infoValue: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },

  routeBlock: { marginTop: theme.spacing.md },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  pickupDot: { backgroundColor: theme.colors.primary },
  dropDot: { backgroundColor: theme.colors.success },
  routeConnector: { width: 2, height: 24, backgroundColor: theme.colors.border, marginLeft: 4, marginVertical: 4 },
  routeText: { flex: 1 },
  routePointLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.5, marginBottom: 2 },
  routeAddress: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
  routeDateTime: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  specialInstructions: { marginTop: theme.spacing.md, backgroundColor: theme.colors.warningMuted, borderRadius: theme.radius.sm, padding: theme.spacing.md, borderLeftWidth: 3, borderLeftColor: theme.colors.warning },
  specialInstructionsLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.warning, marginBottom: 4 },
  specialInstructionsText: { fontSize: 13, color: theme.colors.textPrimary },

  notes: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },

  // Trip card
  tripRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: theme.spacing.md },
  tripStat: { alignItems: 'center', flex: 1 },
  tripStatVal: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  tripStatLbl: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  tripStatDivider: { width: 1, backgroundColor: theme.colors.border },
  expenseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  expenseChip: { fontSize: 12, color: theme.colors.textSecondary, backgroundColor: theme.colors.surfaceSubtle, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  podBadge: { marginTop: 10, backgroundColor: theme.colors.successMuted, borderRadius: 8, padding: 6, alignSelf: 'flex-start' },
  podBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.success },

  gpsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm, gap: 8 },
  gpsBody: { gap: 6 },
  gpsCoords: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  gpsMeta: { fontSize: 12, color: theme.colors.textSecondary },
  gpsPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  gpsPillActive: { backgroundColor: theme.colors.successMuted },
  gpsPillWarn: { backgroundColor: theme.colors.warningMuted },
  gpsPillText: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary },
  mapsBtn: {
    marginTop: 6,
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  mapsBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primaryLight },

  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  footerRow: { flexDirection: 'row', gap: theme.spacing.sm },
  footerCol: { gap: 0 },
  footerBtn: { flex: 1 },
  completedBanner: { backgroundColor: theme.colors.successMuted, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center' },
  completedText: { fontSize: 15, fontWeight: '700', color: theme.colors.success },
});
