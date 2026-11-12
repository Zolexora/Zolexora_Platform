import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'pass' | 'workout' | 'classes'>('pass');
  const [countdown, setCountdown] = useState(24);

  // Dynamic QR countdown simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Workout state with checkable sets
  const [exercises, setExercises] = useState([
    {
      id: 'ex-1',
      name: 'Flat Barbell Bench Press',
      target: '4 sets × 8 reps @ 100 kg',
      sets: [true, true, true, false]
    },
    {
      id: 'ex-2',
      name: 'Incline Dumbbell Press',
      target: '3 sets × 10 reps @ 36 kg',
      sets: [true, false, false]
    },
    {
      id: 'ex-3',
      name: 'Weighted Chest Dips',
      target: '3 sets × 12 reps @ +20 kg',
      sets: [false, false, false]
    }
  ]);

  const toggleSet = (exIdx: number, setIdx: number) => {
    const updated = [...exercises];
    updated[exIdx].sets[setIdx] = !updated[exIdx].sets[setIdx];
    setExercises(updated);
  };

  const handleNfcWave = () => {
    Alert.alert('Turnstile Wave Simulated ⚡', 'NFC Handshake Confirmed. Turnstile unlocked. Welcome Vikram!');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Member Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.memberName}>Vikram Singhania</Text>
            <Text style={styles.memberId}>IC-2026-0811 • Downtown Flagship</Text>
          </View>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>BLACK IRON VIP</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'pass' && styles.tabItemActive]}
            onPress={() => setActiveTab('pass')}
          >
            <Text style={[styles.tabText, activeTab === 'pass' && styles.tabTextActive]}>Digital Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'workout' && styles.tabItemActive]}
            onPress={() => setActiveTab('workout')}
          >
            <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>My Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'classes' && styles.tabItemActive]}
            onPress={() => setActiveTab('classes')}
          >
            <Text style={[styles.tabText, activeTab === 'classes' && styles.tabTextActive]}>Book Classes</Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: DIGITAL GATE PASS */}
        {activeTab === 'pass' && (
          <View>
            {/* Live Rush Meter */}
            <View style={styles.rushCard}>
              <View style={styles.rushHeader}>
                <Text style={styles.rushLabel}>LIVE GYM FLOOR RUSH</Text>
                <Text style={styles.rushStatus}>MODERATE (42.5%)</Text>
              </View>
              <Text style={styles.rushCount}>68 lifters inside</Text>
              <View style={styles.rushBarBg}>
                <View style={[styles.rushBarFill, { width: '42.5%' }]} />
              </View>
              <Text style={styles.rushHint}>Plenty of squat racks and platforms free right now.</Text>
            </View>

            {/* Dynamic QR Pass */}
            <View style={styles.passCard}>
              <Text style={styles.passTitle}>DYNAMIC OPTICAL PASS</Text>
              <Text style={styles.passSub}>Scan against Turnstile Optical Reader</Text>

              {/* QR Mock graphic */}
              <View style={styles.qrContainer}>
                <View style={styles.qrBox}>
                  <View style={styles.qrCornerTL} />
                  <View style={styles.qrCornerTR} />
                  <View style={styles.qrCornerBL} />
                  <View style={styles.qrCenterDot} />
                  <Text style={styles.qrCodeText}>IC-88910-PASS</Text>
                </View>
              </View>

              <View style={styles.countdownRow}>
                <Text style={styles.countdownText}>
                  🛡️ Security token refreshes in: <Text style={styles.countdownSec}>{countdown}s</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.nfcButton}
                onPress={handleNfcWave}
                activeOpacity={0.8}
              >
                <Text style={styles.nfcButtonText}>⚡ Hold Phone Near Turnstile (NFC Wave)</Text>
              </TouchableOpacity>
            </View>

            {/* Daily Nutrition Macro Bar */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>TODAY'S MACRO TARGETS</Text>
              <View style={styles.macroRow}>
                <View style={styles.macroCol}>
                  <Text style={styles.macroVal}>180g / 200g</Text>
                  <Text style={styles.macroName}>Protein (90%)</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={styles.macroVal}>2,450 / 2,800</Text>
                  <Text style={styles.macroName}>Calories (kcal)</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: WORKOUT TRACKER */}
        {activeTab === 'workout' && (
          <View>
            <View style={styles.routineHeader}>
              <Text style={styles.routineTitle}>Chest & Triceps Hypertrophy</Text>
              <Text style={styles.routineSub}>Assigned by Coach Raghav Sharma</Text>
            </View>

            {exercises.map((ex, exIdx) => (
              <View key={ex.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Text style={styles.exerciseTarget}>{ex.target}</Text>

                <View style={styles.setsRow}>
                  {ex.sets.map((done, sIdx) => (
                    <TouchableOpacity
                      key={sIdx}
                      style={[styles.setCircle, done && styles.setCircleDone]}
                      onPress={() => toggleSet(exIdx, sIdx)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.setText, done && styles.setTextDone]}>
                        Set {sIdx + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.completeWorkoutBtn}
              onPress={() => Alert.alert('Workout Logged! 💪', 'Great session! 14,200 kg total volume moved.')}
            >
              <Text style={styles.completeWorkoutText}>Complete & Log Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: BOOK CLASSES */}
        {activeTab === 'classes' && (
          <View style={{ gap: 14 }}>
            <View style={styles.classCard}>
              <View style={styles.classTop}>
                <Text style={styles.classCat}>POWERLIFTING</Text>
                <Text style={styles.classTime}>18:30 - 19:30 Today</Text>
              </View>
              <Text style={styles.classTitle}>Heavy Deadlift Mechanics</Text>
              <Text style={styles.classInstructor}>Platform Pit 01 • Coach Raghav Sharma</Text>
              <TouchableOpacity
                style={styles.bookClassBtn}
                onPress={() => Alert.alert('Class Confirmed!', 'Your spot is reserved for Heavy Deadlift Mechanics.')}
              >
                <Text style={styles.bookClassText}>Reserve Spot (1 spot left)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.classCard}>
              <View style={styles.classTop}>
                <Text style={styles.classCat}>CROSSFIT & HIIT</Text>
                <Text style={styles.classTime}>19:45 - 20:30 Today</Text>
              </View>
              <Text style={styles.classTitle}>Metcon 500 Tactical Circuit</Text>
              <Text style={styles.classInstructor}>CrossFit Arena • Coach Pooja Roy</Text>
              <TouchableOpacity
                style={styles.bookClassBtn}
                onPress={() => Alert.alert('Class Confirmed!', 'Your spot is reserved for Metcon 500.')}
              >
                <Text style={styles.bookClassText}>Reserve Spot (2 spots left)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  memberName: { fontSize: 20, fontWeight: '900', color: '#F8FAFC' },
  memberId: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  tierBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierText: { color: '#030712', fontSize: 10, fontWeight: '900' },
  tabBar: { flexDirection: 'row', backgroundColor: '#0F172A', borderRadius: 14, padding: 4, marginBottom: 20 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabItemActive: { backgroundColor: '#1E293B' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  tabTextActive: { color: '#F59E0B' },
  rushCard: { backgroundColor: '#0F172A', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 16 },
  rushHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rushLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  rushStatus: { fontSize: 11, fontWeight: 'bold', color: '#34D399' },
  rushCount: { fontSize: 20, fontWeight: '900', color: '#F8FAFC', marginTop: 6, marginBottom: 8 },
  rushBarBg: { height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  rushBarFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },
  rushHint: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
  passCard: { backgroundColor: '#0F172A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F59E0B', alignItems: 'center', marginBottom: 16 },
  passTitle: { fontSize: 12, fontWeight: '900', color: '#F59E0B', letterSpacing: 1 },
  passSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, marginBottom: 16 },
  qrContainer: { width: 180, height: 180, backgroundColor: '#FFFFFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', padding: 12 },
  qrBox: { width: '100%', height: '100%', borderWidth: 3, borderColor: '#030712', borderRadius: 8, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  qrCornerTL: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, backgroundColor: '#030712' },
  qrCornerTR: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, backgroundColor: '#030712' },
  qrCornerBL: { position: 'absolute', bottom: 6, left: 6, width: 26, height: 26, backgroundColor: '#030712' },
  qrCenterDot: { width: 18, height: 18, backgroundColor: '#D97706', borderRadius: 4 },
  qrCodeText: { position: 'absolute', bottom: 6, fontSize: 8, fontWeight: '900', color: '#030712' },
  countdownRow: { marginTop: 14, marginBottom: 16 },
  countdownText: { fontSize: 11, color: '#94A3B8' },
  countdownSec: { color: '#F59E0B', fontWeight: 'bold' },
  nfcButton: { width: '100%', backgroundColor: '#F59E0B', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  nfcButtonText: { color: '#030712', fontWeight: '900', fontSize: 12 },
  card: { backgroundColor: '#0F172A', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 16 },
  cardLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 12 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroCol: { flex: 1 },
  macroVal: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC' },
  macroName: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  routineHeader: { marginBottom: 16 },
  routineTitle: { fontSize: 18, fontWeight: '900', color: '#F8FAFC' },
  routineSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  exerciseCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 12 },
  exerciseName: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC' },
  exerciseTarget: { fontSize: 12, color: '#F59E0B', marginTop: 2, marginBottom: 12 },
  setsRow: { flexDirection: 'row', gap: 8 },
  setCircle: { flex: 1, paddingVertical: 10, backgroundColor: '#1E293B', borderRadius: 10, alignItems: 'center' },
  setCircleDone: { backgroundColor: '#059669' },
  setText: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8' },
  setTextDone: { color: '#FFFFFF' },
  completeWorkoutBtn: { backgroundColor: '#059669', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  completeWorkoutText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  classCard: { backgroundColor: '#0F172A', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1E293B' },
  classTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  classCat: { fontSize: 10, fontWeight: '800', color: '#F59E0B' },
  classTime: { fontSize: 11, color: '#34D399', fontWeight: 'bold' },
  classTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC' },
  classInstructor: { fontSize: 12, color: '#94A3B8', marginTop: 2, marginBottom: 14 },
  bookClassBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#F59E0B', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  bookClassText: { color: '#F59E0B', fontWeight: 'bold', fontSize: 11 }
});
