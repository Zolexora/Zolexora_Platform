import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../src/lib/api';
import { theme } from '../../src/lib/theme';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';

type ExpenseCategory = 'FUEL' | 'TOLL' | 'PARKING' | 'MAINTENANCE' | 'DRIVER_ALLOWANCE' | 'OTHER';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: 'FUEL', label: 'Fuel', icon: '⛽' },
  { key: 'TOLL', label: 'Toll', icon: '🛣️' },
  { key: 'PARKING', label: 'Parking', icon: '🅿️' },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: '🔧' },
  { key: 'DRIVER_ALLOWANCE', label: 'Allowance', icon: '💰' },
  { key: 'OTHER', label: 'Other', icon: '📋' },
];

export default function LogExpenseScreen() {
  const { duty_id: dutyId } = useLocalSearchParams<{ duty_id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [category, setCategory] = useState<ExpenseCategory>('FUEL');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let receiptUrl: string | undefined;

      if (receiptUri) {
        const formData = new FormData();
        const filename = receiptUri.split('/').pop() ?? 'receipt.jpg';
        formData.append('file', { uri: receiptUri, name: filename, type: 'image/jpeg' } as unknown as Blob);
        const res = await apiClient<{ url: string }>('/api/v1/expenses/receipts/upload', {
          method: 'POST',
          body: formData,
          headers: {},
        });
        receiptUrl = res.url;
      }

      return apiClient('/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category,
          amount: parseFloat(amount),
          duty_id: dutyId,
          receipt_url: receiptUrl,
          notes: notes || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Expense Logged', 'Your expense has been recorded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Failed to Log Expense', err.message);
    },
  });

  const handlePickReceipt = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Camera access is required to capture a receipt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  };

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid expense amount.');
      return;
    }
    mutate();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>💸 Log Expense</Text>
          <Text style={styles.sub}>Record trip-related costs with an optional receipt photo.</Text>

          {/* Category picker */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catBtn, category === c.key && styles.catBtnActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={styles.catIcon}>{c.icon}</Text>
                  <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Amount */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Amount (₹)</Text>
            <TextInput
              style={styles.bigInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </Card>

          {/* Receipt */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt</Text>
            <TouchableOpacity style={styles.podBtn} onPress={handlePickReceipt}>
              <Text style={styles.podIcon}>{receiptUri ? '✅' : '📷'}</Text>
              <Text style={styles.podBtnText}>
                {receiptUri ? 'Receipt Captured — Tap to Retake' : 'Photograph Receipt (optional)'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Notes */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Additional details..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </Card>

          <Button
            title="Log Expense"
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
  section: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  catBtnActive: { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}18` },
  catIcon: { fontSize: 18 },
  catLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  catLabelActive: { color: theme.colors.primary },
  bigInput: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: 32, fontWeight: '800',
    color: theme.colors.textPrimary, textAlign: 'center',
  },
  podBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    borderWidth: 1.5, borderColor: theme.colors.border, borderStyle: 'dashed',
  },
  podIcon: { fontSize: 24 },
  podBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  notesInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm,
    padding: theme.spacing.sm, fontSize: 14, color: theme.colors.textPrimary,
    minHeight: 70, textAlignVertical: 'top',
  },
});
