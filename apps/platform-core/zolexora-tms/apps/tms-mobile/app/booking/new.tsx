import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/lib/api';
import { useAuth } from '../../src/context/AuthContext';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';

interface ClientItem {
  id: string;
  name: string;
  phone?: string | null;
}

const BOOKING_TYPES = ['ETS', 'FIXED', 'SPOT', 'AIRPORT', 'RENTAL', 'CORPORATE'] as const;
const SERVICE_TYPES = ['PASSENGER', 'CARGO'] as const;

export default function NewBookingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { activeOrg } = useAuth();

  const { data: clients = [] } = useQuery({
    queryKey: ['mobile-clients', activeOrg?.organisation_id],
    queryFn: () => apiClient<ClientItem[]>('/api/v1/crm/clients'),
    enabled: !!activeOrg?.organisation_id,
  });

  const [customerId, setCustomerId] = useState('');
  const [bookingType, setBookingType] = useState<(typeof BOOKING_TYPES)[number]>('ETS');
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>('PASSENGER');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [pickupHoursAhead, setPickupHoursAhead] = useState<number>(2);
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [passengerCount, setPassengerCount] = useState('1');
  const [shiftLabel, setShiftLabel] = useState('');
  const [material, setMaterial] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    if (!customerId && clients.length > 0) {
      setCustomerId(clients[0].id);
    }
  }, [clients, customerId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const pickupDt = new Date(Date.now() + pickupHoursAhead * 3600 * 1000).toISOString();
      const created = await apiClient<{ id: string; request_number: string }>('/api/v1/booking-requests', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          booking_type: bookingType,
          service_type: serviceType,
          pickup_address: pickupAddress.trim(),
          drop_address: dropAddress.trim(),
          pickup_datetime: pickupDt,
          passenger_info: serviceType === 'PASSENGER'
            ? {
                ...(passengerName.trim() ? { name: passengerName.trim() } : {}),
                ...(passengerPhone.trim() ? { phone: passengerPhone.trim() } : {}),
                ...(passengerCount ? { count: parseInt(passengerCount, 10) || 1 } : {}),
                ...(shiftLabel.trim() ? { shift: shiftLabel.trim() } : {}),
              }
            : {},
          cargo_info: serviceType === 'CARGO'
            ? {
                ...(material.trim() ? { material: material.trim() } : {}),
                ...(weightKg ? { weight_kg: parseFloat(weightKg) } : {}),
              }
            : {},
          special_instructions: instructions.trim() || undefined,
          source: 'MOBILE',
        }),
      });
      await apiClient(`/api/v1/booking-requests/${created.id}/submit`, { method: 'POST' });
      return created;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['mobile-booking-requests'] });
      qc.invalidateQueries({ queryKey: ['mobile-bookings'] });
      Alert.alert(
        'Trip Request Submitted',
        `Booking request ${created.request_number} has been sent to dispatch.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    },
    onError: (err: Error) => {
      Alert.alert('Booking Failed', err.message);
    },
  });

  const handleSubmit = () => {
    if (!customerId) {
      Alert.alert('Client Required', 'No client organisation found in this workspace.');
      return;
    }
    if (pickupAddress.trim().length < 3 || dropAddress.trim().length < 3) {
      Alert.alert('Location Required', 'Enter valid pickup and drop points.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>🚖 Request Cab / Trip</Text>
          <Text style={styles.sub}>Book an ETS shuttle, fixed route cab, airport transfer, or corporate trip.</Text>

          {clients.length > 1 && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Corporate Client / Account</Text>
              <View style={styles.chipWrap}>
                {clients.slice(0, 12).map((c) => {
                  const selected = customerId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setCustomerId(c.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          )}

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Type & Service</Text>
            <View style={styles.chipRow}>
              {BOOKING_TYPES.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, bookingType === b && styles.chipActive]}
                  onPress={() => setBookingType(b)}
                >
                  <Text style={[styles.chipText, bookingType === b && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {SERVICE_TYPES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, serviceType === s && styles.chipActive]}
                  onPress={() => setServiceType(s)}
                >
                  <Text style={[styles.chipText, serviceType === s && styles.chipTextActive]}>
                    {s === 'PASSENGER' ? '🧑 People / Cab' : '📦 Cargo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup & Drop Route</Text>
            <Text style={styles.label}>Pickup Point</Text>
            <TextInput
              style={styles.input}
              placeholder="Home / Office campus / Terminal"
              placeholderTextColor={theme.colors.textMuted}
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>Drop Point</Text>
            <TextInput
              style={styles.input}
              placeholder="Destination / Campus gate / Hotel"
              placeholderTextColor={theme.colors.textMuted}
              value={dropAddress}
              onChangeText={setDropAddress}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>Reporting Time</Text>
            <View style={styles.chipRow}>
              {[
                { label: 'In 2 hrs', hrs: 2 },
                { label: 'In 6 hrs', hrs: 6 },
                { label: 'Tomorrow', hrs: 24 },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.hrs}
                  style={[styles.chip, pickupHoursAhead === preset.hrs && styles.chipActive]}
                  onPress={() => setPickupHoursAhead(preset.hrs)}
                >
                  <Text style={[styles.chipText, pickupHoursAhead === preset.hrs && styles.chipTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {serviceType === 'PASSENGER' ? (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Passenger / Shift Roster</Text>
              <Text style={styles.label}>Lead Passenger / Employee Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ananya Verma"
                placeholderTextColor={theme.colors.textMuted}
                value={passengerName}
                onChangeText={setPassengerName}
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Passenger Contact Phone</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="e.g. +91 98XXXXXXXX"
                placeholderTextColor={theme.colors.textMuted}
                value={passengerPhone}
                onChangeText={setPassengerPhone}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Passengers</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={theme.colors.textMuted}
                    value={passengerCount}
                    onChangeText={setPassengerCount}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>Shift / Flight No. (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Night Shift 22:00 / AI-804"
                    placeholderTextColor={theme.colors.textMuted}
                    value={shiftLabel}
                    onChangeText={setShiftLabel}
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Cargo Details</Text>
              <Text style={styles.label}>Material</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Equipment / Documents"
                placeholderTextColor={theme.colors.textMuted}
                value={material}
                onChangeText={setMaterial}
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 500"
                placeholderTextColor={theme.colors.textMuted}
                value={weightKg}
                onChangeText={setWeightKg}
              />
            </Card>
          )}

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Notes / Gate Instructions</Text>
            <TextInput
              style={[styles.input, { minHeight: 68, textAlignVertical: 'top' }]}
              placeholder="Cab type preference, gate number, VIP escort notes..."
              placeholderTextColor={theme.colors.textMuted}
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />
          </Card>

          <Button
            title="Submit Trip Request"
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            loading={createMutation.isPending}
            style={{ marginTop: theme.spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
  section: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  label: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryMuted },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primaryLight },
});
