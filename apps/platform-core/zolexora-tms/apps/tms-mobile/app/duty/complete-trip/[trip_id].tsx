import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, TouchableOpacity,
  PanResponder, Image,
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

// ─── Signature Pad (pure RN, no native lib needed) ────────────────────────
type Point = { x: number; y: number };

function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const [paths, setPaths] = useState<Point[][]>([]);
  const currentPath = useRef<Point[]>([]);
  const [saved, setSaved] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      currentPath.current = [{ x: locationX, y: locationY }];
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      currentPath.current = [...currentPath.current, { x: locationX, y: locationY }];
      setPaths(prev => [...prev.slice(0, -1), [...currentPath.current]]);
    },
    onPanResponderRelease: () => {
      setPaths(prev => {
        const updated = [...prev];
        if (!updated.length || updated[updated.length - 1] !== currentPath.current) {
          updated.push([...currentPath.current]);
        }
        return updated;
      });
      currentPath.current = [];
    },
  });

  const pointsToSvgPath = (pts: Point[]) => {
    if (!pts.length) return '';
    return pts.reduce((d, p, i) => i === 0 ? `M${p.x},${p.y}` : `${d} L${p.x},${p.y}`, '');
  };

    const handleSave = () => {
    if (!paths.length) { Alert.alert('Empty Signature', 'Please sign above first.'); return; }
    // Encode paths as compact JSON (backend stores as metadata string)
    const encoded = JSON.stringify(paths.map(pointsToSvgPath));
    setSaved(true);
    onSave(encoded);
  };

  const handleClear = () => { setPaths([]); setSaved(false); onSave(''); };

  return (
    <View style={sigStyles.wrapper}>
      <Text style={sigStyles.label}>Passenger / Coordinator Signature</Text>
      <View style={sigStyles.canvas} {...panResponder.panHandlers}>
        {/* Drawn lines rendered as absolute-position views (thin lines) */}
        {paths.map((path, pi) =>
          path.slice(1).map((pt, si) => {
            const prev = path[si];
            const dx = pt.x - prev.x;
            const dy = pt.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View key={`${pi}-${si}`} style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: len,
                height: 2,
                backgroundColor: '#1a1a2e',
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: '0 50%',
              }} />
            );
          })
        )}
        {paths.length === 0 && (
          <Text style={sigStyles.placeholder}>Sign here</Text>
        )}
      </View>
      <View style={sigStyles.row}>
        <TouchableOpacity style={sigStyles.clearBtn} onPress={handleClear}>
          <Text style={sigStyles.clearText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[sigStyles.saveBtn, saved && sigStyles.savedBtn]} onPress={handleSave}>
          <Text style={sigStyles.saveText}>{saved ? '✅ Saved' : 'Save Signature'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sigStyles = StyleSheet.create({
  wrapper: { marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  canvas: {
    height: 140, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    backgroundColor: '#fafafa', overflow: 'hidden', position: 'relative',
    justifyContent: 'center', alignItems: 'center',
  },
  placeholder: { color: theme.colors.textMuted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  clearBtn: { flex: 1, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, alignItems: 'center' },
  clearText: { fontSize: 13, color: theme.colors.textSecondary },
  saveBtn: { flex: 2, padding: theme.spacing.sm, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, alignItems: 'center' },
  savedBtn: { backgroundColor: theme.colors.success },
  saveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Amount Field ──────────────────────────────────────────────────────────
function AmountField({ label, icon, value, onChange }: { label: string; icon: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={amtStyles.row}>
      <Text style={amtStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={amtStyles.label}>{label}</Text>
        <TextInput style={amtStyles.input} keyboardType="decimal-pad" placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted} value={value} onChangeText={onChange} />
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

// ─── Main Screen ───────────────────────────────────────────────────────────
const MAX_PHOTOS = 5;

export default function CompleteTripScreen() {
  const { trip_id: tripId, duty_id: dutyId } = useLocalSearchParams<{ trip_id: string; duty_id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // Expenses
  const [endOdometer, setEndOdometer] = useState('');
  const [toll, setToll] = useState('');
  const [fuel, setFuel] = useState('');
  const [parking, setParking] = useState('');
  const [waiting, setWaiting] = useState('');

  // e-POD
  const [podUris, setPodUris] = useState<string[]>([]);      // up to 5 photos
  const [signatureData, setSignatureData] = useState('');    // SVG path JSON
  const [deliveryOtp, setDeliveryOtp] = useState('');        // 4-6 digit OTP from recipient
  const [podNotes, setPodNotes] = useState('');
  const [notes, setNotes] = useState('');

  const { getLocation, stopTracking, currentLocation } = useDriverLocation(tripId);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // Capture GPS + timestamp at submit time
      const coords = await getLocation();
      const submittedAt = new Date().toISOString();

      // Upload primary POD (first photo)
      let podUrl: string | undefined;
      const extraUrls: string[] = [];

      for (let i = 0; i < podUris.length; i++) {
        const uri = podUris[i];
        const formData = new FormData();
        const filename = uri.split('/').pop() ?? `pod_${i + 1}.jpg`;
        formData.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
        const res = await dutiesService.uploadPod(tripId!, formData);
        if (i === 0) podUrl = res.pod_attachment_url;
        else extraUrls.push(res.pod_attachment_url);
      }

      // Build enriched POD metadata stored in pod_notes field
      const podMeta = JSON.stringify({
        signature: signatureData || null,
        delivery_otp_verified: deliveryOtp.length >= 4,
        extra_photo_urls: extraUrls,
        gps: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
        submitted_at: submittedAt,
        notes: podNotes || null,
      });

      return dutiesService.completeTrip(tripId!, {
        end_odometer: parseFloat(endOdometer),
        toll_amount: toll ? parseFloat(toll) : 0,
        fuel_amount: fuel ? parseFloat(fuel) : 0,
        parking_amount: parking ? parseFloat(parking) : 0,
        waiting_minutes: waiting ? parseInt(waiting, 10) : 0,
        pod_attachment_url: podUrl,
        pod_notes: podMeta,
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

  const handleAddPhoto = async () => {
    if (podUris.length >= MAX_PHOTOS) {
      Alert.alert('Max Photos', `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Needed', 'Camera access required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
          if (!result.canceled) setPodUris(prev => [...prev, result.assets[0].uri]);
        },
      },
      {
        text: 'Gallery', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Needed', 'Photo library access required.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
          if (!result.canceled) setPodUris(prev => [...prev, result.assets[0].uri]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (idx: number) => setPodUris(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const km = parseFloat(endOdometer);
    if (!endOdometer || isNaN(km) || km < 0) {
      Alert.alert('Invalid Odometer', 'Enter a valid end odometer reading.');
      return;
    }
    Alert.alert('Complete Trip', `Confirm: Odometer ${km.toFixed(1)} km, ${podUris.length} photo(s), signature: ${signatureData ? 'Yes' : 'No'}`, [
      { text: 'Review', style: 'cancel' },
      { text: 'Submit', onPress: () => mutate() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>🏁 Complete Trip</Text>
          <Text style={styles.sub}>Record ending odometer, toll/parking expenses, and trip closure sign-off.</Text>

          {/* Odometer */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>End Odometer (km)</Text>
            <TextInput style={styles.bigInput} keyboardType="decimal-pad" placeholder="e.g. 48900"
              placeholderTextColor={theme.colors.textMuted} value={endOdometer}
              onChangeText={setEndOdometer} autoFocus />
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

          {/* Trip Sheet & Guest Sign-Off */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Trip Sheet & Guest Sign-Off</Text>

            {/* Multi-photo */}
            <Text style={styles.podSubLabel}>Duty Slip / Receipt Photos ({podUris.length}/{MAX_PHOTOS})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {podUris.map((uri, i) => (
                <View key={i} style={styles.thumbContainer}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i)}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {podUris.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Recipient Signature */}
            <SignaturePad onSave={setSignatureData} />

            {/* Trip Closure OTP / Employee PIN */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.podSubLabel}>Trip Closure OTP / Employee PIN (optional)</Text>
              <TextInput style={styles.otpInput} keyboardType="number-pad" placeholder="e.g. 4821"
                placeholderTextColor={theme.colors.textMuted} value={deliveryOtp}
                onChangeText={v => setDeliveryOtp(v.replace(/\D/g, '').slice(0, 6))}
                maxLength={6} />
            </View>

            {/* Trip Sheet Notes */}
            <TextInput style={[styles.notesInput, { marginTop: 14 }]}
              placeholder="Passenger / coordinator remarks (optional)" placeholderTextColor={theme.colors.textMuted}
              value={podNotes} onChangeText={setPodNotes} multiline numberOfLines={2} />
          </Card>

          {/* Trip Notes */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Notes</Text>
            <TextInput style={styles.notesInput}
              placeholder="Any remarks about the trip..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
          </Card>

          <Button title="Complete Trip" variant="success" size="lg"
            onPress={handleSubmit} loading={isPending}
            style={{ marginTop: theme.spacing.xl }} />
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

  // Photos
  podSubLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  thumbContainer: { position: 'relative', marginRight: 8 },
  thumb: { width: 80, height: 80, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20,
    borderRadius: 10, backgroundColor: theme.colors.danger,
    justifyContent: 'center', alignItems: 'center',
  },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: theme.radius.sm, borderWidth: 1.5,
    borderColor: theme.colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceSubtle,
  },
  addPhotoIcon: { fontSize: 22 },
  addPhotoText: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },

  // OTP
  otpInput: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.spacing.sm, fontSize: 24, fontWeight: '800',
    color: theme.colors.textPrimary, textAlign: 'center', letterSpacing: 8,
  },

  // Notes
  notesInput: {
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.sm, padding: theme.spacing.sm,
    fontSize: 14, color: theme.colors.textPrimary, minHeight: 56,
    textAlignVertical: 'top',
  },
});
