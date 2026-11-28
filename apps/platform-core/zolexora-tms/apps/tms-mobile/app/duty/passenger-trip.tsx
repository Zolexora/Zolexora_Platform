/**
 * Passenger Trip Screen
 *
 * Shows live trip progress, boarding PIN, driver/vehicle details, and
 * a live-tracking link for the passenger. Accessible from the duty detail
 * screen for CLIENT persona or via deep link with share token.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dutiesService, TripRecord } from '../../src/services/dutiesService';
import { Duty, DutyStatus } from '../../src/types/tms';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { MilestoneTracker } from '../../src/components/MilestoneTracker';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PinBadge({ pin }: { pin: string }) {
  return (
    <View style={styles.pinContainer}>
      <Text style={styles.pinLabel}>Boarding PIN</Text>
      <Text style={styles.pinValue}>{pin}</Text>
      <Text style={styles.pinHint}>Show this PIN to the driver</Text>
    </View>
  );
}

const MILESTONE_LABELS: Record<string, string> = {
  DISPATCHED: '🚦 Cab Dispatched',
  ARRIVED_PICKUP: '📍 Cab Arrived at Pickup',
  IN_TRANSIT: '🚗 Trip in Progress',
  ARRIVED_DROP: '🏁 Arrived at Drop',
  DUTY_COMPLETED: '✅ Trip Completed',
};

export default function PassengerTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: duty, isLoading, error } = useQuery<Duty>({
    queryKey: ['duty', id],
    queryFn: () => dutiesService.getDutyById(id!),
    enabled: !!id,
    refetchInterval: (data) => {
      const status = data?.status;
      if (
        status === DutyStatus.DUTY_COMPLETED ||
        status === DutyStatus.CANCELLED
      ) {
        return false;
      }
      return 20_000;
    },
  });

  const trip = (duty as (typeof duty & { trip?: TripRecord | null }) | undefined)?.trip ?? null;

  const boardingPin =
    (duty?.booking as any)?.boarding_pin ||
    (duty?.booking as any)?.stops?.find(
      (s: any) => String(s.stop_type).toUpperCase() === 'PICKUP',
    )?.boarding_pin ||
    null;

  const trackingUrl = useMemo(() => {
    if (!trip?.share_token) return null;
    return `https://track.zolexora.com/t/${trip.share_token}`;
  }, [trip?.share_token]);

  const openTracking = useCallback(() => {
    if (trackingUrl) Linking.openURL(trackingUrl).catch(() => {});
  }, [trackingUrl]);

  const dialDriver = useCallback(() => {
    const phone = (duty?.driver as any)?.phone;
    if (phone) Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
  }, [duty?.driver]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !duty) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Unable to load trip details.</Text>
        <Button label="Go Back" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  const milestoneLabel = MILESTONE_LABELS[duty.status] ?? duty.status;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your Trip</Text>
          <StatusBadge status={duty.status} />
        </View>

        {/* Boarding PIN */}
        {boardingPin && (
          <Card>
            <PinBadge pin={boardingPin} />
          </Card>
        )}

        {/* Current Status */}
        <Card>
          <Text style={styles.sectionTitle}>Live Status</Text>
          <Text style={styles.milestoneLabel}>{milestoneLabel}</Text>
          <MilestoneTracker currentStatus={duty.status} />
        </Card>

        {/* Route */}
        <Card>
          <Text style={styles.sectionTitle}>Route</Text>
          <InfoRow label="From" value={(duty.booking as any)?.pickup_address} />
          <InfoRow label="To" value={(duty.booking as any)?.drop_address} />
          <InfoRow
            label="Scheduled Pickup"
            value={
              (duty.booking as any)?.pickup_datetime
                ? new Date((duty.booking as any).pickup_datetime).toLocaleString()
                : undefined
            }
          />
        </Card>

        {/* Vehicle & Driver */}
        <Card>
          <Text style={styles.sectionTitle}>Your Cab</Text>
          <InfoRow label="Vehicle" value={(duty.vehicle as any)?.registration_number} />
          <InfoRow label="Type" value={(duty.vehicle as any)?.vehicle_type} />
          <InfoRow label="Driver" value={(duty.driver as any)?.full_name} />
          {(duty.driver as any)?.phone && (
            <TouchableOpacity style={styles.dialBtn} onPress={dialDriver}>
              <Text style={styles.dialText}>📞 Call Driver — {(duty.driver as any).phone}</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Live Tracking */}
        {trackingUrl && (
          <Card>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            <Text style={styles.trackingHint}>
              Tap below to open the live map and see your cab in real-time.
            </Text>
            <Button label="🗺  Track Live on Map" onPress={openTracking} variant="primary" />
          </Card>
        )}

        {/* Trip Summary (completed) */}
        {trip && duty.status === DutyStatus.DUTY_COMPLETED && (
          <Card>
            <Text style={styles.sectionTitle}>Trip Summary</Text>
            <InfoRow
              label="Distance"
              value={trip.total_distance_km ? `${trip.total_distance_km} km` : undefined}
            />
            <InfoRow
              label="Start"
              value={trip.start_timestamp ? new Date(trip.start_timestamp).toLocaleString() : undefined}
            />
            <InfoRow
              label="End"
              value={trip.end_timestamp ? new Date(trip.end_timestamp).toLocaleString() : undefined}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 18, color: theme.colors.primary },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  milestoneLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text, flex: 2, textAlign: 'right' },
  pinContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  pinLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  pinValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 8,
    color: theme.colors.primary,
  },
  pinHint: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  dialBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  dialText: { fontSize: 14, color: theme.colors.primary, fontWeight: '600' },
  trackingHint: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 10 },
  errorText: { fontSize: 16, color: theme.colors.error, marginBottom: 12 },
});
