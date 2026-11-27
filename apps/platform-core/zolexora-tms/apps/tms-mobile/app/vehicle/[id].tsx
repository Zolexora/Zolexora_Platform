import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../src/lib/api';
import { dutiesService } from '../../src/services/dutiesService';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ComplianceBadge } from '../../src/components/ComplianceBadge';
import type { VehicleDetails, Duty } from '../../src/types/tms';

interface ComplianceRequirement {
  id: string;
  code: string;
  name: string;
}

interface ComplianceRecord {
  id: string;
  requirement_id: string;
  status: string;
  document_number?: string | null;
  expiry_date?: string | null;
}

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
  const qc = useQueryClient();
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);

  const { data: vehicle, isLoading, error } = useQuery<VehicleDetails>({
    queryKey: ['vehicle', id],
    queryFn: () => apiClient<VehicleDetails>(`/api/v1/vehicles/${id}`),
    enabled: !!id,
  });

  const { data: duties } = useQuery<Duty[]>({
    queryKey: ['vehicle-duties', id],
    queryFn: () => dutiesService.getDuties({}),
    enabled: !!id,
    select: (all) => all.filter((d) => (d as Duty & { vehicle_id?: string }).vehicle_id === id).slice(0, 10),
  });

  const { data: requirements = [] } = useQuery<ComplianceRequirement[]>({
    queryKey: ['compliance-requirements', 'VEHICLE'],
    queryFn: () => apiClient<ComplianceRequirement[]>('/api/v1/compliance/requirements?entity_type=VEHICLE'),
    enabled: !!id,
  });

  const { data: records = [] } = useQuery<ComplianceRecord[]>({
    queryKey: ['compliance-records', 'VEHICLE', id],
    queryFn: () => apiClient<ComplianceRecord[]>(`/api/v1/compliance/records?entity_type=VEHICLE&entity_id=${id}`),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ reqId, uri }: { reqId: string; uri: string }) => {
      setUploadingReqId(reqId);
      const fd = new FormData();
      const filename = uri.split('/').pop() ?? 'compliance.jpg';
      fd.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
      fd.append('requirement_id', reqId);
      fd.append('entity_type', 'VEHICLE');
      fd.append('entity_id', id!);
      return apiClient('/api/v1/compliance/records/upload', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-records', 'VEHICLE', id] });
      Alert.alert('Document Uploaded', 'Submitted for verification.');
    },
    onError: (err: Error) => Alert.alert('Upload Failed', err.message),
    onSettled: () => setUploadingReqId(null),
  });

  const pickAndUpload = (reqId: string) => {
    Alert.alert('Upload Compliance Document', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Needed', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!res.canceled) uploadMutation.mutate({ reqId, uri: res.assets[0].uri });
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Needed', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          if (!res.canceled) uploadMutation.mutate({ reqId, uri: res.assets[0].uri });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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

        {/* Compliance & Docs — colour-coded expiry badges */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Compliance & Documents</Text>
          {vehicle.payload_capacity_kg != null && (
            <InfoRow label="Payload (kg)" value={vehicle.payload_capacity_kg.toString()} />
          )}
          <ComplianceBadge label="RC (Registration)" expiry={vehicle.rc_expiry} />
          <ComplianceBadge label="PUC (Pollution)" expiry={vehicle.puc_expiry} daysWarn={15} />
          <ComplianceBadge label="Insurance" expiry={vehicle.insurance_expiry} />
          <ComplianceBadge label="Permit" expiry={vehicle.permit_expiry} />
          <ComplianceBadge label="Fitness" expiry={vehicle.fitness_expiry} />
        </Card>

        {/* Compliance Record Uploads */}
        {requirements.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📤 Document Renewals & Records</Text>
            {requirements.map((req) => {
              const rec = records.find((r) => r.requirement_id === req.id);
              const busy = uploadingReqId === req.id;
              return (
                <View key={req.id} style={styles.compRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compName}>{req.name}</Text>
                    <Text style={styles.compStatus}>{rec ? `Status: ${rec.status}` : 'Not uploaded'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    disabled={busy}
                    onPress={() => pickAndUpload(req.id)}
                  >
                    <Text style={styles.uploadBtnText}>{busy ? 'Uploading...' : rec ? 'Renew' : 'Upload'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </Card>
        )}

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

  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  compName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  compStatus: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  uploadBtn: { backgroundColor: theme.colors.primaryMuted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryLight },

  dutyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dutyNumber: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  dutyDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
