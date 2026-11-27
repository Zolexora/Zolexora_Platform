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
  Modal,
  Share,
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

function openDirections(address: string, lat?: number | null, lng?: number | null) {
  const dest =
    lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`).catch(() => {});
}

function dialPhone(phone?: string | null) {
  if (!phone) return;
  Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
}

function openWhatsApp(phone?: string | null, text?: string) {
  if (!phone) return;
  const digits = phone.replace(/[^\d]/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  Linking.openURL(`https://wa.me/${digits}${query}`).catch(() => {});
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const EXCEPTION_OPTIONS: Array<{ label: string; code: string }> = [
  { label: '🚦  Traffic / Route Delay', code: 'DELAY_TRAFFIC' },
  { label: '🔧  Vehicle Breakdown', code: 'BREAKDOWN' },
  { label: '⏳  Loading / Unloading Wait', code: 'LOADING_WAIT' },
  { label: '🚧  Toll / Checkpost Hold', code: 'CHECKPOINT_HOLD' },
  { label: '🆘  Emergency SOS Alert', code: 'SOS_EMERGENCY' },
];

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
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false);

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

  const { getLocation, startTracking, stopTracking, currentLocation, isBackgroundActive } = useDriverLocation(trip?.id);

  // Check geofence proximity once for DISPATCHED / IN_TRANSIT driver duties
  useEffect(() => {
    if (!canExecuteDriverActions || !isAssignedDriver) return;
    if (duty?.status === DutyStatus.DISPATCHED || duty?.status === DutyStatus.IN_TRANSIT) {
      getLocation().catch(() => {});
    }
  }, [canExecuteDriverActions, duty?.status, getLocation, isAssignedDriver]);

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
  const timelineEvents = useMemo(
    () => (tripEventsQuery.data ?? []).filter((ev) => ev.event_type !== 'location_update'),
    [tripEventsQuery.data],
  );
  const latestGps = gpsEvents[0] ?? null;

  const geofencePrompt = useMemo<{ label: string; milestone: MilestoneAction; distM: number } | null>(() => {
    if (!canExecuteDriverActions || !isAssignedDriver || !currentLocation || !duty?.booking) return null;
    if (duty.status === DutyStatus.DISPATCHED && duty.booking.pickup_lat != null && duty.booking.pickup_lng != null) {
      const distM = distanceMeters(currentLocation.latitude, currentLocation.longitude, duty.booking.pickup_lat, duty.booking.pickup_lng);
      if (distM <= 350) return { label: 'You are within 350m of Pickup', milestone: 'arrived-pickup', distM };
    }
    if (duty.status === DutyStatus.IN_TRANSIT && !trip && duty.booking.drop_lat != null && duty.booking.drop_lng != null) {
      const distM = distanceMeters(currentLocation.latitude, currentLocation.longitude, duty.booking.drop_lat, duty.booking.drop_lng);
      if (distM <= 350) return { label: 'You are within 350m of Drop', milestone: 'arrived-drop', distM };
    }
    return null;
  }, [canExecuteDriverActions, currentLocation, duty, isAssignedDriver, trip]);

  const exceptionMutation = useMutation({
    mutationFn: async ({ code, label }: { code: string; label: string }) => {
      if (!trip?.id) throw new Error('Trip must be started before reporting an event.');
      const coords = await getLocation();
      return dutiesService.postTripEvent(trip.id, {
        event_type: code,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        notes: label.replace(/^[^\w]+/, '').trim(),
      });
    },
    onSuccess: (_res, vars) => {
      setExceptionModalVisible(false);
      qc.invalidateQueries({ queryKey: ['trip-events', trip?.id] });
      Alert.alert(
        vars.code === 'SOS_EMERGENCY' ? '🆘 SOS Sent' : '⚠️ Update Logged',
        'Operations team has been notified with your GPS coordinates.',
      );
    },
    onError: (err: Error) => Alert.alert('Unable to Report Exception', err.message),
  });

  const handleReportException = () => {
    setExceptionModalVisible(true);
  };

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

            {/* e-Way Bill status */}
            {duty.booking.eway_bill_number && (() => {
              const exp = duty.booking.eway_bill_valid_until ? new Date(duty.booking.eway_bill_valid_until) : null;
              const hoursLeft = exp ? (exp.getTime() - Date.now()) / 3_600_000 : null;
              const isExpired = hoursLeft !== null && hoursLeft < 0;
              const isExpiring = hoursLeft !== null && hoursLeft >= 0 && hoursLeft < 8;
              return (
                <View style={[styles.ewayRow, isExpired ? styles.ewayDanger : isExpiring ? styles.ewayWarn : styles.ewayOk]}>
                  <Text style={styles.ewayLabel}>📄 e-Way Bill</Text>
                  <Text style={styles.ewayNum}>{duty.booking.eway_bill_number}</Text>
                  {exp && (
                    <Text style={styles.ewayExpiry}>
                      {isExpired ? `❌ Expired` : isExpiring ? `⚠️ ${Math.ceil(hoursLeft ?? 0)}h left` : `✅ Valid`}
                    </Text>
                  )}
                </View>
              );
            })()}

            <View style={styles.quickNavRow}>
              <TouchableOpacity
                style={styles.quickNavBtn}
                onPress={() =>
                  openDirections(
                    duty.booking!.pickup_address,
                    duty.booking!.pickup_lat,
                    duty.booking!.pickup_lng,
                  )
                }
              >
                <Text style={styles.quickNavText}>🧭 Nav Pickup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickNavBtn}
                onPress={() =>
                  openDirections(
                    duty.booking!.drop_address,
                    duty.booking!.drop_lat,
                    duty.booking!.drop_lng,
                  )
                }
              >
                <Text style={styles.quickNavText}>🧭 Nav Drop</Text>
              </TouchableOpacity>
              {duty.booking.customer_phone && (
                <>
                  <TouchableOpacity
                    style={styles.quickNavBtn}
                    onPress={() => dialPhone(duty.booking!.customer_phone)}
                  >
                    <Text style={styles.quickNavText}>📞 Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickNavBtn}
                    onPress={() =>
                      openWhatsApp(duty.booking!.customer_phone, `Update on ${duty.duty_number}`)
                    }
                  >
                    <Text style={styles.quickNavText}>💬 WA</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Card>
        )}

        {/* Geofence Arrival Banner */}
        {geofencePrompt && (
          <Card style={[styles.section, styles.geofenceCard]}>
            <Text style={styles.geofenceTitle}>
              📍 {geofencePrompt.label} ({Math.round(geofencePrompt.distM)}m away)
            </Text>
            <Button
              title={
                geofencePrompt.milestone === 'arrived-pickup'
                  ? 'Confirm Arrived at Pickup'
                  : 'Confirm Arrived at Drop'
              }
              variant="success"
              size="sm"
              onPress={() => milestoneMutation.mutate(geofencePrompt.milestone)}
              loading={milestoneMutation.isPending}
              style={{ marginTop: 8 }}
            />
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
            {duty.driver.phone && !isAssignedDriver && (
              <View style={styles.quickNavRow}>
                <TouchableOpacity
                  style={styles.quickNavBtn}
                  onPress={() => dialPhone(duty.driver!.phone)}
                >
                  <Text style={styles.quickNavText}>📞 Call Driver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickNavBtn}
                  onPress={() =>
                    openWhatsApp(duty.driver!.phone, `Regarding duty ${duty.duty_number}`)
                  }
                >
                  <Text style={styles.quickNavText}>💬 WhatsApp Driver</Text>
                </TouchableOpacity>
              </View>
            )}
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
                {/* Share link button — only for supervisors / ops (non-driver) */}
                {!isAssignedDriver && (
                  <TouchableOpacity
                    style={[styles.mapsBtn, { marginTop: 8, backgroundColor: theme.colors.primaryMuted }]}
                    onPress={async () => {
                      try {
                        const res = await dutiesService.createShareLink(trip.id);
                        await Share.share({
                          title: 'Track your shipment',
                          message: `Track live: ${res.share_url}`,
                          url: res.share_url,
                        });
                      } catch (e: unknown) {
                        Alert.alert('Share Failed', e instanceof Error ? e.message : 'Could not generate link');
                      }
                    }}
                  >
                    <Text style={[styles.mapsBtnText, { color: theme.colors.primaryLight }]}>🔗  Share Live Tracking Link</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.gpsMeta}>
                {tripEventsQuery.isLoading ? 'Loading GPS pings...' : 'No GPS pings recorded yet for this trip.'}
              </Text>
            )}
          </Card>
        )}

        {/* Milestones & Exceptions Timeline */}
        {trip && canViewLiveTracking && timelineEvents.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>🕒  Trip Events & Exceptions</Text>
            {timelineEvents.slice(0, 8).map((ev) => (
              <View key={ev.id} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    ev.event_type === 'SOS_EMERGENCY'
                      ? styles.timelineDotSos
                      : ev.event_type.includes('DELAY') || ev.event_type === 'BREAKDOWN'
                        ? styles.timelineDotWarn
                        : styles.timelineDotOk,
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{ev.event_type.replace(/_/g, ' ')}</Text>
                  {ev.notes && <Text style={styles.timelineNotes}>{ev.notes}</Text>}
                </View>
                <Text style={styles.timelineTime}>
                  {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
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
                <View style={[styles.footerRow, { marginTop: 8 }]}>
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
                    style={styles.footerBtn}
                  />
                  <Button
                    title="⚠️  Delay / SOS"
                    variant="danger"
                    size="sm"
                    onPress={handleReportException}
                    loading={exceptionMutation.isPending}
                    style={styles.footerBtn}
                  />
                </View>
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

      {/* Delay / Exception / SOS Modal (cross-platform Android + iOS) */}
      <Modal
        visible={exceptionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setExceptionModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report Trip Exception</Text>
            <Text style={styles.modalSub}>
              Sends an immediate operational alert with your current GPS coordinates.
            </Text>
            {EXCEPTION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.code}
                style={[
                  styles.exceptionOption,
                  opt.code === 'SOS_EMERGENCY' && styles.exceptionOptionSos,
                ]}
                disabled={exceptionMutation.isPending}
                onPress={() => exceptionMutation.mutate({ code: opt.code, label: opt.label })}
              >
                <Text
                  style={[
                    styles.exceptionOptionText,
                    opt.code === 'SOS_EMERGENCY' && styles.exceptionOptionSosText,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setExceptionModalVisible(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
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

  ewayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 8,
  },
  ewayOk: { backgroundColor: theme.colors.successMuted, borderColor: theme.colors.success },
  ewayWarn: { backgroundColor: theme.colors.warningMuted, borderColor: theme.colors.warning },
  ewayDanger: { backgroundColor: theme.colors.dangerMuted, borderColor: theme.colors.danger },
  ewayLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  ewayNum: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, flex: 1 },
  ewayExpiry: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },

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

  quickNavRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  quickNavBtn: {
    flex: 1,
    minWidth: 72,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickNavText: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },

  geofenceCard: { borderColor: theme.colors.success, borderWidth: 1, backgroundColor: theme.colors.successMuted },
  geofenceTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.success },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineDotOk: { backgroundColor: theme.colors.primaryLight },
  timelineDotWarn: { backgroundColor: theme.colors.warning },
  timelineDotSos: { backgroundColor: theme.colors.danger },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  timelineNotes: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  timelineTime: { fontSize: 11, color: theme.colors.textMuted },

  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  footerRow: { flexDirection: 'row', gap: theme.spacing.sm },
  footerCol: { gap: 0 },
  footerBtn: { flex: 1 },
  completedBanner: { backgroundColor: theme.colors.successMuted, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center' },
  completedText: { fontSize: 15, fontWeight: '700', color: theme.colors.success },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: 28,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSub: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  exceptionOption: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  exceptionOptionSos: {
    backgroundColor: theme.colors.dangerMuted,
    borderColor: theme.colors.danger,
  },
  exceptionOptionText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  exceptionOptionSosText: { color: theme.colors.danger },
});
