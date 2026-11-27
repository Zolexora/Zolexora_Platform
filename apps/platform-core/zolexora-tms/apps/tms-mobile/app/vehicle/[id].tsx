import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/lib/api';
import { dutiesService } from '../../src/services/dutiesService';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import type { VehicleDetails, Duty } from '../../src/types/tms';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: vehicle, isLoading, error } = useQuery<VehicleDetails>({
    queryKey: ['vehicle', id],
    queryFn: () => apiClient<VehicleDetails>(`/api/v1/vehicles/${id}`),
    enabled: !!id,
  });

  const { data: duties } = useQuery<Duty[]>({
    queryKey: ['vehicle-duties', id],
    queryFn: () => dutiesService.getDuties({ }),
    enabled: !!id,
    select: (all) => all.filter((d) => (d as Duty & { vehicle_id?: string }).vehicle_id === id).slice(0, 10),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !vehicle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>🚛</Text>
          <Text style={styles.errorText}>Vehicle not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    vehicle.status === 'ACTIVE' ? theme.colors.success :
    vehicle.status === 'ON_TRIP' ? theme.colors.primary :
    vehicle.status === 'IN_MAINTENANCE' ? theme.colors.warning :
    theme.colors.textMuted;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.regNo}>{vehicle.registration_number}</Text>
            <View style={[styles.statusPill, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{vehicle.status ?? 'UNKNOWN'}</Text>
            </View>
          </View>
          <Text style={styles.vehicleType}>{vehicle.vehicle_type ?? '—'}</Text>
          <InfoRow label="Make / Model" value={vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : null} />
          <InfoRow label="Year" value={vehicle.year?.toString()} />
          <InfoRow label="Ownership" value={vehicle.ownership_type} />
        </Card>

        {/* Capacity & Docs */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Capacity & Documents</Text>
          <InfoRow label="Payload (tons)" value={vehicle.payload_tons?.toString()} />
          <InfoRow label="Insurance Expiry" value={vehicle.insurance_expiry
            ? new Date(vehicle.insurance_expiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
            : null}
          />
          <InfoRow label="Permit Expiry" value={vehicle.permit_expiry
            ? new Date(vehicle.permit_expiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
            : null}
          />
          <InfoRow label="Fitness Expiry" value={vehicle.fitness_expiry
            ? new Date(vehicle.fitness_expiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
            : null}
          />
        </Card>

        {/* Recent Duties */}
        {duties && duties.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Duties</Text>
            {duties.map((d) => (
              <View key={d.id} style={styles.dutyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dutyNumber}>{d.duty_number}</Text>
                  <Text style={styles.dutyDate}>
                    {d.scheduled_start_time ? new Date(d.scheduled_start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </Text>
                </View>
                <StatusBadge status={d.status} />
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  errorIcon: { fontSize: 48 },
  errorText: { fontSize: 16, color: theme.colors.textSecondary },

  headerCard: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  regNo: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary },
  statusPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  vehicleType: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },

  section: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoLabel: { fontSize: 13, color: theme.colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  dutyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dutyNumber: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  dutyDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
