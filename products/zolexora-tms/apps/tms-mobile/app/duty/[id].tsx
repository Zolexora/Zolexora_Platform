import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dutiesService } from '../../src/services/dutiesService';
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
    case DutyStatus.ACCEPTED:
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
  const [actionLoading, setActionLoading] = useState(false);

  const { data: duty, isLoading, error } = useQuery({
    queryKey: ['duty', id],
    queryFn: () => dutiesService.getDutyById(id!),
    enabled: !!id,
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
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        {/* Accept / Reject pending duties */}
        {duty.status === DutyStatus.DRIVER_ACCEPTANCE_PENDING && (
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

        {/* Milestone actions for active duties */}
        {nextAction && (
          <Button
            title={nextAction.label}
            variant={nextAction.variant}
            size="lg"
            onPress={() => handleMilestone(nextAction.milestone, nextAction.label)}
            loading={actionLoading && milestoneMutation.isPending}
          />
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

  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  footerRow: { flexDirection: 'row', gap: theme.spacing.sm },
  footerBtn: { flex: 1 },
  completedBanner: { backgroundColor: theme.colors.successMuted, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center' },
  completedText: { fontSize: 15, fontWeight: '700', color: theme.colors.success },
});
