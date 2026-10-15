import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert
} from 'react-native';

export default function App() {
  const [occupancy, setOccupancy] = useState(68);
  const maxCapacity = 160;

  const [recentScans, setRecentScans] = useState([
    { id: '1', name: 'Vikram Singhania', tier: 'VIP', decision: 'GRANTED', gate: 'Gate A', time: 'Just now' },
    { id: '2', name: 'Ananya Deshmukh', tier: 'GOLD', decision: 'GRANTED', gate: 'Gate B', time: '3m ago' },
    { id: '3', name: 'Dev Kapoor', tier: 'BRONZE', decision: 'DENIED_EXPIRED', gate: 'Gate A', time: '7m ago' },
    { id: '4', name: 'Arjun Mehta', tier: 'SILVER', decision: 'GRANTED', gate: 'Exit Gate', time: '12m ago' },
  ]);

  const handleUnlockGate = (gateName: string) => {
    setOccupancy((prev) => Math.min(maxCapacity, prev + 1));
    Alert.alert('Gate Unlocked ⚡', `${gateName} open for 5 seconds. Signal sent to controller.`);
    setRecentScans([
      { id: Date.now().toString(), name: 'Manager Override', tier: 'ADMIN', decision: 'GRANTED', gate: gateName, time: 'Just now' },
      ...recentScans
    ]);
  };

  const handleLockdown = () => {
    Alert.alert('Emergency Lockdown 🚨', 'All turnstiles locked down. Touch release disabled.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>IRONCLUB MANAGER</Text>
            <Text style={styles.subTitle}>Bengaluru Downtown Flagship</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Live</Text>
          </View>
        </View>

        {/* Live Headcount Gauge */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>LIVE GYM OCCUPANCY</Text>
          <View style={styles.gaugeRow}>
            <Text style={styles.occupancyValue}>{occupancy}</Text>
            <Text style={styles.capacityText}>/ {maxCapacity} Max</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${(occupancy / maxCapacity) * 100}%` }]} />
          </View>
          <Text style={styles.crowdHint}>
            {occupancy < 80 ? '🟢 Normal crowd flow — benches & racks available' : '🟠 Busy floor'}
          </Text>
        </View>

        {/* Quick Gate Controls */}
        <Text style={styles.sectionTitle}>QUICK HARDWARE CONTROLS</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => handleUnlockGate('Main Turnstile A')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnPrimaryText}>⚡ Open Gate A (5s)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => handleUnlockGate('Main Turnstile B')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnSecondaryText}>⚡ Open Gate B (5s)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.lockdownBtn}
          onPress={handleLockdown}
          activeOpacity={0.8}
        >
          <Text style={styles.lockdownBtnText}>🚨 Emergency Safety Lockdown</Text>
        </TouchableOpacity>

        {/* Live Access Feed */}
        <Text style={styles.sectionTitle}>REAL-TIME TURNSTILE FEED</Text>
        <View style={styles.card}>
          {recentScans.map((scan) => (
            <View key={scan.id} style={styles.scanRow}>
              <View>
                <Text style={styles.scanName}>{scan.name}</Text>
                <Text style={styles.scanSub}>{scan.gate} • {scan.time}</Text>
              </View>
              <View style={styles.scanRight}>
                <View style={[
                  styles.badge,
                  scan.decision === 'GRANTED' ? styles.badgeGranted : styles.badgeDenied
                ]}>
                  <Text style={[
                    styles.badgeText,
                    scan.decision === 'GRANTED' ? styles.badgeTextGranted : styles.badgeTextDenied
                  ]}>
                    {scan.decision === 'GRANTED' ? 'PASSED' : 'DENIED'}
                  </Text>
                </View>
                <Text style={styles.tierText}>{scan.tier}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Today's Sales Snapshot */}
        <Text style={styles.sectionTitle}>TODAY'S OPERATIONS SNAPSHOT</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { marginRight: 8 }]}>
            <Text style={styles.statLabel}>Total Entries</Text>
            <Text style={styles.statVal}>342</Text>
          </View>
          <View style={[styles.statBox, { marginLeft: 8 }]}>
            <Text style={styles.statLabel}>Pro-Shop POS</Text>
            <Text style={styles.statVal}>₹14,800</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brandTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC', letterSpacing: 0.5 },
  subTitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#064E3B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399', marginRight: 6 },
  onlineText: { color: '#34D399', fontSize: 11, fontWeight: 'bold' },
  card: { backgroundColor: '#0F172A', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1E293B', marginBottom: 20 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  gaugeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8, marginBottom: 12 },
  occupancyValue: { fontSize: 44, fontWeight: '900', color: '#F8FAFC' },
  capacityText: { fontSize: 14, color: '#64748B', marginLeft: 8 },
  progressBarBg: { height: 10, backgroundColor: '#1E293B', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: 10, backgroundColor: '#F59E0B', borderRadius: 5 },
  crowdHint: { fontSize: 12, color: '#94A3B8', marginTop: 10, fontWeight: '500' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 12 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  actionBtnPrimary: { flex: 1, backgroundColor: '#059669', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginRight: 6 },
  actionBtnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  actionBtnSecondary: { flex: 1, backgroundColor: '#D97706', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginLeft: 6 },
  actionBtnSecondaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  lockdownBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#DC2626', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginBottom: 24 },
  lockdownBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },
  scanRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  scanName: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC' },
  scanSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  scanRight: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  badgeGranted: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  badgeDenied: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextGranted: { color: '#34D399' },
  badgeTextDenied: { color: '#F87171' },
  tierText: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 1, backgroundColor: '#0F172A', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  statVal: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginTop: 4 }
});
