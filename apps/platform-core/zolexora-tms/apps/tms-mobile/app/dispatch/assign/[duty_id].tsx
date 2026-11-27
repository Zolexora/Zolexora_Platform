import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../../src/lib/api';
import { getVehicleComplianceIssues } from '../../../src/lib/compliance';
import { dutiesService } from '../../../src/services/dutiesService';
import { theme } from '../../../src/lib/theme';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { StatusBadge } from '../../../src/components/StatusBadge';
import type { DriverProfile, VehicleDetails } from '../../../src/types/tms';

export default function AssignDutyScreen() {
  const { duty_id: dutyId } = useLocalSearchParams<{ duty_id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: duty, isLoading: dutyLoading } = useQuery({
    queryKey: ['duty', dutyId],
    queryFn: () => dutiesService.getDutyById(dutyId!),
    enabled: !!dutyId,
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['assign-drivers'],
    queryFn: () => apiClient<DriverProfile[]>('/api/v1/drivers?limit=100'),
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['assign-vehicles'],
    queryFn: () => apiClient<VehicleDetails[]>('/api/v1/vehicles?limit=100'),
  });

  const effectiveDriverId = selectedDriverId || duty?.driver_id || '';
  const effectiveVehicleId = selectedVehicleId || duty?.vehicle_id || '';

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        (d.full_name || d.name || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q),
    );
  }, [drivers, search]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.registration_number.toLowerCase().includes(q) ||
        (v.make || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q),
    );
  }, [vehicles, search]);

  const assignMutation = useMutation({
    mutationFn: async (alsoDispatch: boolean) => {
      await dutiesService.assignDuty(dutyId!, {
        driver_id: effectiveDriverId,
        vehicle_id: effectiveVehicleId,
      });
      if (alsoDispatch) {
        await dutiesService.dispatchDuty(dutyId!);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duty', dutyId] });
      qc.invalidateQueries({ queryKey: ['duties'] });
      qc.invalidateQueries({ queryKey: ['mobile-dispatch-board'] });
      qc.invalidateQueries({ queryKey: ['dashboard-dispatch'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Assignment Failed', err.message);
    },
  });

  const submit = (alsoDispatch: boolean) => {
    if (!effectiveDriverId || !effectiveVehicleId) {
      Alert.alert('Selection Required', 'Select both a driver and a vehicle first.');
      return;
    }
    const chosenVehicle = vehicles.find((v) => v.id === effectiveVehicleId);
    if (chosenVehicle) {
      const issues = getVehicleComplianceIssues(chosenVehicle);
      if (issues.expired.length > 0) {
        Alert.alert(
          '⚠️ Expired Compliance Document',
          `${chosenVehicle.registration_number} has expired: ${issues.expired.join(', ')}.\n\nProceed anyway?`,
          [
            { text: 'Pick Another', style: 'cancel' },
            { text: 'Proceed Anyway', style: 'destructive', onPress: () => assignMutation.mutate(alsoDispatch) },
          ],
        );
        return;
      }
    }
    assignMutation.mutate(alsoDispatch);
  };

  if (dutyLoading || driversLoading || vehiclesLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading dispatch resources...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {duty && (
          <Card style={styles.dutyBanner}>
            <View style={styles.rowBetween}>
              <Text style={styles.dutyNo}>{duty.duty_number}</Text>
              <StatusBadge status={duty.status} />
            </View>
            {duty.booking && (
              <Text style={styles.routeText} numberOfLines={2}>
                {duty.booking.pickup_address} → {duty.booking.drop_address}
              </Text>
            )}
          </Card>
        )}

        <TextInput
          style={styles.searchInput}
          placeholder="Filter drivers or vehicles..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />

        <Text style={styles.sectionTitle}>1. Select Driver ({filteredDrivers.length})</Text>
        <Card style={styles.listCard}>
          {filteredDrivers.length === 0 ? (
            <Text style={styles.emptyText}>No drivers match your filter.</Text>
          ) : (
            filteredDrivers.slice(0, 25).map((d) => {
              const selected = effectiveDriverId === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.pickRow, selected && styles.pickRowActive]}
                  onPress={() => setSelectedDriverId(d.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickTitle}>{d.full_name || d.name}</Text>
                    <Text style={styles.pickSub}>
                      {d.phone}  ·  {d.driver_type || d.status || 'Driver'}
                    </Text>
                  </View>
                  <Text style={styles.checkMark}>{selected ? '●' : '○'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        <Text style={styles.sectionTitle}>2. Select Vehicle ({filteredVehicles.length})</Text>
        <Card style={styles.listCard}>
          {filteredVehicles.length === 0 ? (
            <Text style={styles.emptyText}>No vehicles match your filter.</Text>
          ) : (
            filteredVehicles.slice(0, 25).map((v) => {
              const selected = effectiveVehicleId === v.id;
              const issues = getVehicleComplianceIssues(v);
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.pickRow, selected && styles.pickRowActive]}
                  onPress={() => setSelectedVehicleId(v.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickTitle}>{v.registration_number}</Text>
                    <Text style={styles.pickSub}>
                      {[v.make, v.model, v.vehicle_type, v.status].filter(Boolean).join(' · ')}
                    </Text>
                    {issues.expired.length > 0 ? (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.danger, marginTop: 2 }}>
                        🔴 Expired: {issues.expired.join(', ')}
                      </Text>
                    ) : issues.expiringSoon.length > 0 ? (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.warning, marginTop: 2 }}>
                        🟡 Expiring soon: {issues.expiringSoon.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.checkMark}>{selected ? '●' : '○'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Assign Only"
          variant="outline"
          onPress={() => submit(false)}
          loading={assignMutation.isPending}
          style={{ flex: 1 }}
        />
        <Button
          title="Assign & Dispatch"
          variant="primary"
          onPress={() => submit(true)}
          loading={assignMutation.isPending}
          style={{ flex: 1.4 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.colors.background },
  loadingText: { color: theme.colors.textSecondary, fontSize: 14 },
  dutyBanner: { padding: theme.spacing.md, marginBottom: theme.spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dutyNo: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  routeText: { fontSize: 12, color: theme.colors.textSecondary },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  listCard: { padding: theme.spacing.sm, marginBottom: theme.spacing.md },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  pickRowActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
  },
  pickTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pickSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  checkMark: { fontSize: 18, color: theme.colors.primaryLight, marginLeft: 8 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, padding: theme.spacing.md },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});