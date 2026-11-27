import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { dutiesService } from '../../../src/services/dutiesService';
import { theme } from '../../../src/lib/theme';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { useDriverLocation } from '../../../src/lib/useDriverLocation';

// ─── DVIR Checklist ───────────────────────────────────────────────────────
type ItemStatus = 'pass' | 'fail' | null;

interface ChecklistItem {
  key: string;
  label: string;
  icon: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'tires', label: 'Tires & Wheels', icon: '🛞' },
  { key: 'brakes', label: 'Brakes', icon: '🛑' },
  { key: 'lights', label: 'Lights & Signals', icon: '💡' },
  { key: 'documents', label: 'Documents (RC, PUC, Permit)', icon: '📄' },
  { key: 'fuel', label: 'Fuel Level', icon: '⛽' },
  { key: 'cabin', label: 'Cabin Clean, AC & Seatbelts', icon: '💺' },
];

interface ChecklistState {
  [key: string]: { status: ItemStatus; defectNote: string; photoUri?: string };
}

function DVIRChecklist({ onComplete }: { onComplete: (passed: boolean, data: ChecklistState) => void }) {
  const [items, setItems] = useState<ChecklistState>(
    Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, { status: null, defectNote: '' }]))
  );
  const [submitted, setSubmitted] = useState(false);

  const setStatus = (key: string, status: ItemStatus) => {
    setItems(prev => ({ ...prev, [key]: { ...prev[key], status } }));
  };

  const setNote = (key: string, note: string) => {
    setItems(prev => ({ ...prev, [key]: { ...prev[key], defectNote: note } }));
  };

  const addDefectPhoto = async (key: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission Needed', 'Camera access required for defect photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      setItems(prev => ({ ...prev, [key]: { ...prev[key], photoUri: result.assets[0].uri } }));
    }
  };

  const handleSubmit = () => {
    const incomplete = CHECKLIST_ITEMS.filter(i => items[i.key].status === null);
    if (incomplete.length > 0) {
      Alert.alert('Incomplete Checklist', `Please mark all items. Missing: ${incomplete.map(i => i.label).join(', ')}`);
      return;
    }
    const failedItems = CHECKLIST_ITEMS.filter(i => items[i.key].status === 'fail');
    const hasDefects = failedItems.length > 0;

    if (hasDefects) {
      Alert.alert(
        '⚠️ Defects Reported',
        `${failedItems.length} issue(s) found:\n${failedItems.map(i => `• ${i.label}`).join('\n')}\n\nFleet Manager will be notified. Continue?`,
        [
          { text: 'Review', style: 'cancel' },
          { text: 'Continue', onPress: () => { setSubmitted(true); onComplete(false, items); } },
        ]
      );
    } else {
      setSubmitted(true);
      onComplete(true, items);
    }
  };

  if (submitted) {
    return (
      <Card style={styles.card}>
        <Text style={styles.checkDoneText}>✅ Pre-Trip Inspection Complete</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>🔍 Pre-Trip Vehicle Inspection</Text>
      <Text style={styles.hint}>Check each item before departing. Report any defects.</Text>
      {CHECKLIST_ITEMS.map(item => {
        const st = items[item.key];
        return (
          <View key={item.key} style={styles.checkRow}>
            <Text style={styles.checkIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>{item.label}</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, st.status === 'pass' && styles.togglePass]}
                  onPress={() => setStatus(item.key, 'pass')}>
                  <Text style={[styles.toggleText, st.status === 'pass' && styles.togglePassText]}>✓ OK</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, st.status === 'fail' && styles.toggleFail]}
                  onPress={() => setStatus(item.key, 'fail')}>
                  <Text style={[styles.toggleText, st.status === 'fail' && styles.toggleFailText]}>✗ Defect</Text>
                </TouchableOpacity>
              </View>
              {st.status === 'fail' && (
                <View style={{ marginTop: 6, gap: 6 }}>
                  <TextInput
                    style={styles.defectInput}
                    placeholder="Describe defect..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={st.defectNote}
                    onChangeText={v => setNote(item.key, v)}
                  />
                  <TouchableOpacity style={styles.defectPhotoBtn} onPress={() => addDefectPhoto(item.key)}>
                    <Text style={styles.defectPhotoText}>
                      {st.photoUri ? '📷 Photo Added ✓' : '📷 Add Defect Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );
      })}
      <Button title="Submit Inspection" variant="primary" size="md"
        onPress={handleSubmit} style={{ marginTop: 12 }} />
    </Card>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function StartTripScreen() {
  const { id: dutyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [inspectionDone, setInspectionDone] = useState(false);
  const [inspectionData, setInspectionData] = useState<ChecklistState>({});
  const [odometer, setOdometer] = useState('');
  const { getLocation, startTracking, currentLocation } = useDriverLocation(null);

  const handleInspectionComplete = (passed: boolean, data: ChecklistState) => {
    setInspectionData(data);
    setInspectionDone(true);
    // If defects found, we still allow proceeding but backend will get notified
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();

      // Build DVIR summary to store with trip start notes
      const failedKeys = CHECKLIST_ITEMS.filter(i => inspectionData[i.key]?.status === 'fail').map(i => i.label);
      const dvirSummary = failedKeys.length
        ? `DVIR_DEFECTS: ${failedKeys.join(', ')}`
        : 'DVIR_PASSED';

      const trip = await dutiesService.startTrip(dutyId!, {
        start_odometer: parseFloat(odometer),
        start_location: coords ? (coords as unknown as Record<string, unknown>) : undefined,
      });

      // Post DVIR result as a TripEvent so fleet_manager sees it
      if (trip?.id) {
        await dutiesService.postTripEvent(trip.id, {
          event_type: failedKeys.length ? 'DVIR_DEFECTS_REPORTED' : 'DVIR_PASSED',
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          notes: failedKeys.length
            ? `Pre-trip defects: ${failedKeys.join(', ')}. ${Object.entries(inspectionData).filter(([, v]) => v.status === 'fail' && v.defectNote).map(([k, v]) => `${k}: ${v.defectNote}`).join('; ')}`
            : 'All pre-trip checks passed.',
        });
      }

      return trip;
    },
    onSuccess: async (createdTrip) => {
      if (createdTrip?.id) {
        await startTracking(createdTrip.id).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['duty', dutyId] });
      qc.invalidateQueries({ queryKey: ['duties'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Failed to Start Trip', err.message);
    },
  });

  const handleSubmit = () => {
    const km = parseFloat(odometer);
    if (!odometer || isNaN(km) || km < 0) {
      Alert.alert('Invalid Odometer', 'Enter a valid odometer reading in km.');
      return;
    }
    Alert.alert('Start Trip', `Odometer: ${km.toFixed(1)} km — confirm?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start Trip', onPress: () => mutate() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>🚀 Start Trip</Text>
          <Text style={styles.sub}>Complete the pre-trip inspection, then record your starting odometer.</Text>

          {/* Step 1: DVIR Inspection */}
          {!inspectionDone ? (
            <DVIRChecklist onComplete={handleInspectionComplete} />
          ) : (
            <>
              {/* Step 2: Odometer */}
              <Card style={styles.card}>
                <Text style={styles.label}>Start Odometer (km)</Text>
                <TextInput
                  style={styles.input} keyboardType="decimal-pad" placeholder="e.g. 48500"
                  placeholderTextColor={theme.colors.textMuted} value={odometer}
                  onChangeText={setOdometer} autoFocus
                />
                <Text style={styles.hint}>Enter the current odometer reading on the vehicle dashboard.</Text>
              </Card>

              {currentLocation && (
                <Card style={[styles.card, { marginTop: theme.spacing.sm }]}>
                  <Text style={styles.locationText}>
                    📍 {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                  </Text>
                </Card>
              )}

              <Button title="Start Trip" variant="primary" size="lg"
                onPress={handleSubmit} loading={isPending}
                style={{ marginTop: theme.spacing.xl }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl, lineHeight: 20 },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: 28, fontWeight: '800',
    color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceSubtle, textAlign: 'center',
  },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  locationText: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },

  // Checklist
  checkDoneText: { fontSize: 15, fontWeight: '700', color: theme.colors.success, textAlign: 'center' },
  checkRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  checkIcon: { fontSize: 22, width: 30, textAlign: 'center', marginTop: 2 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, padding: 8, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  togglePass: { backgroundColor: '#d1fae5', borderColor: theme.colors.success },
  toggleFail: { backgroundColor: '#fee2e2', borderColor: theme.colors.danger },
  toggleText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  togglePassText: { color: theme.colors.success },
  toggleFailText: { color: theme.colors.danger },
  defectInput: {
    borderWidth: 1, borderColor: theme.colors.danger, borderRadius: theme.radius.sm,
    padding: 8, fontSize: 13, color: theme.colors.textPrimary,
  },
  defectPhotoBtn: {
    padding: 8, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSubtle, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center',
  },
  defectPhotoText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
});
