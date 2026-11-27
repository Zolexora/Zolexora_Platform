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

function AmountField({
  label, icon, value, onChange,
}: { label: string; icon: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={amtStyles.row}>
      <Text style={amtStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={amtStyles.label}>{label}</Text>
        <TextInput
          style={amtStyles.input}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
          value={value}
          onChangeText={onChange}
        />
      </View>
    </View>
  );
}

const amtStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  icon: { fontSize: 22, width: 32, textAlign: 'center' },
  label: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  input: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, padding: 0 },
});

export default function CompleteTripScreen() {
  const { trip_id: tripId, duty_id: dutyId } = useLocalSearchParams<{ trip_id: string; duty_id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [endOdometer, setEndOdometer] = useState('');
  const [toll, setToll] = useState('');
  const [fuel, setFuel] = useState('');
  const [parking, setParking] = useState('');
  const [waiting, setWaiting] = useState('');
  const [podUri, setPodUri] = useState<string | null>(null);
  const [podNotes, setPodNotes] = useState('');
  const [notes, setNotes] = useState('');

  const { getLocation, stopTracking, currentLocation } = useDriverLocation(tripId);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let podUrl: string | undefined;

      // Upload POD image first if selected
      if (podUri) {
        const formData = new FormData();
        const filename = podUri.split('/').pop() ?? 'pod.jpg';
        const type = filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        formData.append('file', { uri: podUri, name: filename, type } as unknown as Blob);
        const res = await dutiesService.uploadPod(tripId!, formData);
        podUrl = res.pod_attachment_url;
      }

      // Capture final location for end_location
      const coords = await getLocation();

      return dutiesService.completeTrip(tripId!, {
        end_odometer: parseFloat(endOdometer),
        toll_amount: toll ? parseFloat(toll) : 0,
        fuel_amount: fuel ? parseFloat(fuel) : 0,
        parking_amount: parking ? parseFloat(parking) : 0,
        waiting_minutes: waiting ? parseInt(waiting, 10) : 0,
        pod_attachment_url: podUrl,
        pod_notes: podNotes || undefined,
        notes: notes || undefined,
        end_location: coords ? (coords as unknown as Record<string, unknown>) : undefined,
      });
    },
    onSuccess: async () => {
      await stopTracking().catch(() => {});
      qc.invalidateQueries({ queryKey: ['duty', dutyId] });
      qc.invalidateQueries({ queryKey: ['duties'] });
      router.back();
    },
    onError: (err: Error) => {
      Alert.alert('Failed to Complete Trip', err.message);
    },
  });

  const handlePickPod = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Camera access is required to capture POD.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    if (!result.canceled) setPodUri(result.assets[0].uri);
  };

  const handleSubmit = () => {
    const km = parseFloat(endOdometer);
    if (!endOdometer || isNaN(km) || km < 0) {
      Alert.alert('Invalid Odometer', 'Enter a valid end odometer reading.');
      return;
    }
    Alert.alert('Complete Trip', 'Confirm all expense entries and POD are correct?', [
      { text: 'Review', style: 'cancel' },
      { text: 'Submit', onPress: () => mutate() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>🏁 Complete Trip</Text>
          <Text style={styles.sub}>Record final odometer, expenses, and upload Proof of Delivery.</Text>

          {/* Odometer */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>End Odometer (km)</Text>
            <TextInput
              style={styles.bigInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 48900"
              placeholderTextColor={theme.colors.textMuted}
              value={endOdometer}
              onChangeText={setEndOdometer}
              autoFocus
            />
            {currentLocation && (
              <Text style={styles.locationText}>
                📍 {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
            )}
          </Card>

          {/* Expenses */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Expenses</Text>
            <AmountField label="Toll (₹)" icon="🛣️" value={toll} onChange={setToll} />
            <AmountField label="Fuel (₹)" icon="⛽" value={fuel} onChange={setFuel} />
            <AmountField label="Parking (₹)" icon="🅿️" value={parking} onChange={setParking} />
            <AmountField label="Waiting (min)" icon="⏱️" value={waiting} onChange={setWaiting} />
          </Card>

          {/* POD */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            <TouchableOpacity style={styles.podBtn} onPress={handlePickPod}>
              <Text style={styles.podIcon}>{podUri ? '✅' : '📷'}</Text>
              <Text style={styles.podBtnText}>{podUri ? 'POD Captured — Tap to Retake' : 'Take POD Photo'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.notesInput}
              placeholder="POD notes (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={podNotes}
              onChangeText={setPodNotes}
              multiline
              numberOfLines={2}
            />
          </Card>

          {/* Notes */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any remarks about the trip..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </Card>

          <Button
            title="Complete Trip"
            variant="success"
            size="lg"
            onPress={handleSubmit}
            loading={isPending}
            style={{ marginTop: theme.spacing.xl }}
          />
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
  section: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  bigInput: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: 28, fontWeight: '800',
    color: theme.colors.textPrimary, textAlign: 'center',
  },
  locationText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  podBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    borderWidth: 1.5, borderColor: theme.colors.border, borderStyle: 'dashed',
  },
  podIcon: { fontSize: 24 },
  podBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  notesInput: {
    marginTop: 10, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.sm, padding: theme.spacing.sm,
    fontSize: 14, color: theme.colors.textPrimary, minHeight: 56,
    textAlignVertical: 'top',
  },
});
