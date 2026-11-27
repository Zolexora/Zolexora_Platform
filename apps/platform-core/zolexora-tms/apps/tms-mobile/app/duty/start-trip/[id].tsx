import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dutiesService } from '../../../src/services/dutiesService';
import { theme } from '../../../src/lib/theme';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { useDriverLocation } from '../../../src/lib/useDriverLocation';

export default function StartTripScreen() {
  const { id: dutyId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [odometer, setOdometer] = useState('');
  const { getLocation, currentLocation } = useDriverLocation(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      return dutiesService.startTrip(dutyId!, {
        start_odometer: parseFloat(odometer),
        start_location: coords ? (coords as unknown as Record<string, unknown>) : undefined,
      });
    },
    onSuccess: () => {
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>🚀 Start Trip</Text>
          <Text style={styles.sub}>Record your starting odometer reading before departing.</Text>

          <Card style={styles.card}>
            <Text style={styles.label}>Start Odometer (km)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="e.g. 48500"
              placeholderTextColor={theme.colors.textMuted}
              value={odometer}
              onChangeText={setOdometer}
              autoFocus
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

          <Button
            title="Start Trip"
            variant="primary"
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
  card: { padding: theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceSubtle,
    textAlign: 'center',
  },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  locationText: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
});
