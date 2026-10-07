import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppHeader from "@/components/AppHeader";
import ModuleBottomNav, { type ModuleBottomNavItem } from "@/components/ModuleBottomNav";
import {
  type BodyEntry,
  type Exercise,
  type FitnessGoal,
  type MealItem,
  type MealType,
  type Mood,
  type MuscleGroup,
  type NutritionEntry,
  type SleepEntry,
  type Workout,
  type WorkoutDifficulty,
  type WorkoutType,
  useFitness,
} from "@/context/FitnessContext";
import { useColors } from "@/hooks/useColors";

type FitnessTab = "dashboard" | "track" | "workout" | "nutrition" | "progress" | "profile";

const TODAY = new Date().toISOString().split("T")[0];

const TABS: ModuleBottomNavItem<FitnessTab>[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "track", label: "Track", icon: "activity" },
  { key: "workout", label: "Workout", icon: "zap" },
  { key: "nutrition", label: "Nutrition", icon: "coffee" },
  { key: "progress", label: "Progress", icon: "trending-up" },
  { key: "profile", label: "Profile", icon: "user" },
];

const WORKOUT_TYPES: WorkoutType[] = ["strength", "cardio", "running", "walking", "cycling", "yoga", "hiit", "sports", "home", "other"];
const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "full_body", "cardio"];
const DIFFICULTIES: WorkoutDifficulty[] = ["easy", "medium", "hard"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MOODS: Mood[] = ["great", "good", "okay", "bad", "terrible"];
const MOOD_EMOJI: Record<Mood, string> = { great: "😄", good: "🙂", okay: "😐", bad: "😕", terrible: "😞" };
const GOAL_LABELS: Record<FitnessGoal, string> = { fat_loss: "Fat Loss", muscle_gain: "Muscle Gain", maintenance: "Maintenance", general_fitness: "General Fitness", strength: "Strength" };

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// ─── Reusable components ─────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }, style]}>{children}</View>;
}

function Label({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</Text>;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1, minWidth: "45%", alignItems: "center", paddingVertical: 14 }}>
      <Text style={{ color: color ?? colors.primary, fontSize: 22, fontFamily: "Inter_700Bold" }}>{value}</Text>
      <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 }}>{label}</Text>
      {sub ? <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const colors = useColors();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
      <View style={{ height: 6, width: `${pct * 100}%`, backgroundColor: color ?? colors.primary, borderRadius: 3 }} />
    </View>
  );
}

function NumInput({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Label text={label} />
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.muted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 44 }}>
        <TextInput
          style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 15 }}
          keyboardType="numeric"
          value={value === 0 ? "" : String(value)}
          onChangeText={(t) => onChange(parseFloat(t) || 0)}
          placeholderTextColor={colors.mutedForeground}
          placeholder="0"
        />
        {unit ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function StrInput({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Label text={label} />
      <TextInput
        style={{ backgroundColor: colors.muted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 15, ...(multiline ? { minHeight: 80, textAlignVertical: "top" } : {}) }}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
      />
    </View>
  );
}

function Chips<T extends string>({ options, selected, onSelect, multi, label }: { options: T[]; selected: T | T[]; onSelect: (v: T) => void; multi?: boolean; label?: string }) {
  const colors = useColors();
  const isSelected = (o: T) => multi ? (selected as T[]).includes(o) : selected === o;
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Label text={label} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map(o => (
          <TouchableOpacity key={o} onPress={() => onSelect(o)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: isSelected(o) ? colors.primary : colors.muted, borderWidth: 1, borderColor: isSelected(o) ? colors.primary : colors.border }}>
            <Text style={{ color: isSelected(o) ? colors.primaryForeground : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{o.replace(/_/g, " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────

function DashboardTab() {
  const colors = useColors();
  const fit = useFitness();
  const score = fit.computeFitnessScore();
  const todayBody = fit.getTodayBodyEntry();
  const todaySleep = fit.getTodaySleep();
  const todayNutrition = fit.getTodayNutrition();
  const weeklyWorkouts = fit.getWeeklyWorkoutCount();
  const workoutStreak = fit.getWorkoutStreak();
  const latestBody = fit.bodyEntries[0];
  const profile = fit.profile;

  const scoreColor = score.total >= 75 ? "#10B981" : score.total >= 50 ? colors.primary : "#EF4444";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      {/* Fitness Score */}
      <Card style={{ alignItems: "center", paddingVertical: 20 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 }}>OVERALL FITNESS SCORE</Text>
        <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: scoreColor, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Text style={{ color: scoreColor, fontSize: 32, fontFamily: "Inter_700Bold" }}>{score.total}</Text>
        </View>
        <Text style={{ color: scoreColor, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>{score.category}</Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
          {[
            { label: "Workout", v: score.workout },
            { label: "Nutrition", v: score.nutrition },
            { label: "Recovery", v: score.recovery },
            { label: "Habits", v: score.habit },
          ].map(s => (
            <View key={s.label} style={{ alignItems: "center" }}>
              <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_700Bold" }}>{s.v}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Quick Stats */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StatCard label="Current Weight" value={latestBody ? `${latestBody.weightKg}kg` : "—"} sub={profile ? `Target: ${profile.targetWeight}kg` : undefined} />
        <StatCard label="BMI" value={latestBody ? String(latestBody.bmi) : "—"} sub={latestBody ? fit.getBMICategory(latestBody.bmi) : undefined} />
        <StatCard label="Weekly Workouts" value={`${weeklyWorkouts}/${profile?.workoutDaysPerWeek ?? 4}`} color="#10B981" />
        <StatCard label="Workout Streak" value={`${workoutStreak}d`} sub="days in a row" color="#7C3AED" />
      </View>

      {/* Today Status */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Today's Status</Text>
        {[
          { label: "Body Entry", done: !!todayBody, detail: todayBody ? `${todayBody.weightKg}kg · BMI ${todayBody.bmi}` : "Not logged" },
          { label: "Workout", done: fit.workouts.some(w => w.date === TODAY), detail: fit.workouts.find(w => w.date === TODAY)?.name ?? "Not logged" },
          { label: "Nutrition", done: !!todayNutrition, detail: todayNutrition ? `${todayNutrition.caloriesConsumed}/${todayNutrition.calorieTarget} kcal` : "Not logged" },
          { label: "Sleep", done: !!todaySleep, detail: todaySleep ? `${todaySleep.sleepHours}h · Recovery ${todaySleep.recoveryScore}%` : "Not logged" },
        ].map(item => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: item.done ? "#10B981" : colors.border, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
              <Feather name={item.done ? "check" : "x"} size={13} color={item.done ? "#fff" : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{item.label}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Score Breakdown */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Score Breakdown</Text>
        {[
          { label: "Workout Consistency (30%)", value: score.workout, color: "#10B981" },
          { label: "Body Progress (20%)", value: score.body, color: "#3B82F6" },
          { label: "Nutrition (20%)", value: score.nutrition, color: "#F97316" },
          { label: "Sleep & Recovery (15%)", value: score.recovery, color: "#7C3AED" },
          { label: "Habits (15%)", value: score.habit, color: colors.primary },
        ].map(s => (
          <View key={s.label} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: "Inter_400Regular" }}>{s.label}</Text>
              <Text style={{ color: s.color, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{s.value}</Text>
            </View>
            <ProgressBar value={s.value} max={100} color={s.color} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ─── TRACK TAB ────────────────────────────────────────────────────────────────

type TrackSub = "body" | "sleep";

function TrackTab() {
  const colors = useColors();
  const [sub, setSub] = useState<TrackSub>("body");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
        {(["body", "sleep"] as TrackSub[]).map(s => (
          <TouchableOpacity key={s} onPress={() => setSub(s)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: sub === s ? colors.primary : "transparent" }}>
            <Text style={{ color: sub === s ? colors.primary : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{s === "body" ? "Body Tracking" : "Sleep & Recovery"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {sub === "body" ? <BodyTrackingTab /> : <SleepTab />}
    </View>
  );
}

function BodyTrackingTab() {
  const colors = useColors();
  const fit = useFitness();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BodyEntry | null>(null);

  const blankEntry = () => ({
    date: TODAY, weightKg: fit.profile?.currentWeight ?? 70, bodyFatPercent: 0,
    waistCm: 0, chestCm: 0, armCm: 0, hipCm: 0, thighCm: 0, neckCm: 0,
    muscleMass: 0, visceralFat: 0, waterPercent: 0, mood: "good" as Mood, energyLevel: 7, stressLevel: 3, notes: "",
  });

  const [form, setForm] = useState(blankEntry());

  const open = (e?: BodyEntry) => {
    if (e) { setEditing(e); setForm({ ...e }); } else { setEditing(null); setForm(blankEntry()); }
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.weightKg) return Alert.alert("Enter weight");
    if (editing) await fit.updateBodyEntry({ ...editing, ...form, bmi: fit.computeBMI(form.weightKg, fit.profile?.heightCm ?? 170) });
    else await fit.addBodyEntry(form);
    setShowAdd(false);
  };

  const latest = fit.bodyEntries[0];
  const avg7 = fit.bodyEntries.slice(0, 7).reduce((s, e) => s + e.weightKg, 0) / Math.max(fit.bodyEntries.slice(0, 7).length, 1);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      {latest && (
        <Card>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Latest Entry — {latest.date}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { l: "Weight", v: `${latest.weightKg}kg` },
              { l: "BMI", v: `${latest.bmi} (${fit.getBMICategory(latest.bmi)})` },
              { l: "Body Fat", v: latest.bodyFatPercent ? `${latest.bodyFatPercent}%` : "—" },
              { l: "7d Avg", v: `${avg7.toFixed(1)}kg` },
            ].map(x => (
              <View key={x.l} style={{ backgroundColor: colors.muted, borderRadius: 8, padding: 10, minWidth: "45%", flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{x.l}</Text>
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>{x.v}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8 }}>* BMI is an estimate. It does not separate fat and muscle.</Text>
        </Card>
      )}

      <TouchableOpacity onPress={() => open()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>+ Log Body Entry</Text>
      </TouchableOpacity>

      {fit.bodyEntries.map(e => (
        <Card key={e.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{e.date}</Text>
              <Text style={{ color: colors.primary, fontSize: 18, fontFamily: "Inter_700Bold" }}>{e.weightKg}kg</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>BMI {e.bmi} · {fit.getBMICategory(e.bmi)} {e.bodyFatPercent ? `· BF ${e.bodyFatPercent}%` : ""}</Text>
              {e.mood ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Mood: {MOOD_EMOJI[e.mood]} Energy: {e.energyLevel}/10</Text> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={() => open(e)}><Feather name="edit-2" size={16} color={colors.mutedForeground} /></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("Delete?", "", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => fit.deleteBodyEntry(e.id) }])}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>
            </View>
          </View>
        </Card>
      ))}
      {fit.bodyEntries.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No body entries yet</Text>}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>{editing ? "Edit Entry" : "Log Body Entry"}</Text>
            <TouchableOpacity onPress={save}><Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StrInput label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
            <NumInput label="Weight" value={form.weightKg} onChange={v => setForm(p => ({ ...p, weightKg: v }))} unit="kg" />
            <NumInput label="Body Fat %" value={form.bodyFatPercent} onChange={v => setForm(p => ({ ...p, bodyFatPercent: v }))} unit="%" />
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 4 }}>Measurements (optional)</Text>
            {(["waistCm", "chestCm", "armCm", "hipCm", "thighCm", "neckCm"] as const).map(k => (
              <NumInput key={k} label={k.replace("Cm", " (cm)")} value={form[k]} onChange={v => setForm(p => ({ ...p, [k]: v }))} unit="cm" />
            ))}
            <NumInput label="Energy Level" value={form.energyLevel} onChange={v => setForm(p => ({ ...p, energyLevel: v }))} unit="/10" />
            <NumInput label="Stress Level" value={form.stressLevel} onChange={v => setForm(p => ({ ...p, stressLevel: v }))} unit="/10" />
            <Chips options={MOODS} selected={form.mood} onSelect={v => setForm(p => ({ ...p, mood: v }))} label="Mood" />
            <StrInput label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} multiline />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SleepTab() {
  const colors = useColors();
  const fit = useFitness();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SleepEntry | null>(null);

  const blank = () => ({ date: TODAY, sleepHours: 7, sleepQuality: 7, energyLevel: 7, sorenessLevel: 3, stressLevel: 3, mood: "good" as Mood, restingHeartRate: 0, notes: "" });
  const [form, setForm] = useState(blank());

  const open = (e?: SleepEntry) => {
    if (e) { setEditing(e); setForm({ ...e }); } else { setEditing(null); setForm(blank()); }
    setShowAdd(true);
  };

  const save = async () => {
    if (editing) await fit.updateSleepEntry({ ...editing, ...form, recoveryScore: fit.computeRecoveryScore(form) });
    else await fit.addSleepEntry(form);
    setShowAdd(false);
  };

  const recColor = (s: number) => s >= 80 ? "#10B981" : s >= 60 ? colors.primary : s >= 40 ? "#F97316" : "#EF4444";
  const recLabel = (s: number) => s >= 80 ? "Heavy workout ✓" : s >= 60 ? "Normal workout ✓" : s >= 40 ? "Light workout" : "Rest day suggested";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <TouchableOpacity onPress={() => open()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>+ Log Sleep & Recovery</Text>
      </TouchableOpacity>

      {fit.sleepEntries.map(e => {
        const rc = recColor(e.recoveryScore);
        return (
          <Card key={e.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{e.date}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: colors.primary, fontSize: 20, fontFamily: "Inter_700Bold" }}>{e.sleepHours}h</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Sleep</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: rc, fontSize: 20, fontFamily: "Inter_700Bold" }}>{e.recoveryScore}%</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Recovery</Text>
                  </View>
                </View>
                <Text style={{ color: rc, fontSize: 12, marginTop: 4, fontFamily: "Inter_500Medium" }}>{recLabel(e.recoveryScore)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Quality {e.sleepQuality}/10 · Energy {e.energyLevel}/10 · Stress {e.stressLevel}/10</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => open(e)}><Feather name="edit-2" size={16} color={colors.mutedForeground} /></TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("Delete?", "", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => fit.deleteSleepEntry(e.id) }])}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>
              </View>
            </View>
          </Card>
        );
      })}
      {fit.sleepEntries.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No sleep entries yet</Text>}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>Log Sleep & Recovery</Text>
            <TouchableOpacity onPress={save}><Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StrInput label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
            <NumInput label="Sleep Hours" value={form.sleepHours} onChange={v => setForm(p => ({ ...p, sleepHours: v }))} unit="hrs" />
            <NumInput label="Sleep Quality" value={form.sleepQuality} onChange={v => setForm(p => ({ ...p, sleepQuality: v }))} unit="/10" />
            <NumInput label="Energy Level" value={form.energyLevel} onChange={v => setForm(p => ({ ...p, energyLevel: v }))} unit="/10" />
            <NumInput label="Soreness Level" value={form.sorenessLevel} onChange={v => setForm(p => ({ ...p, sorenessLevel: v }))} unit="/10" />
            <NumInput label="Stress Level" value={form.stressLevel} onChange={v => setForm(p => ({ ...p, stressLevel: v }))} unit="/10" />
            <NumInput label="Resting Heart Rate (optional)" value={form.restingHeartRate} onChange={v => setForm(p => ({ ...p, restingHeartRate: v }))} unit="bpm" />
            <Chips options={MOODS} selected={form.mood} onSelect={v => setForm(p => ({ ...p, mood: v }))} label="Mood" />
            <StrInput label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} multiline />
            <Card style={{ backgroundColor: colors.muted }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Preview recovery score: <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{fit.computeRecoveryScore(form)}%</Text></Text>
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── WORKOUT TAB ──────────────────────────────────────────────────────────────

function WorkoutTab() {
  const colors = useColors();
  const fit = useFitness();
  const [showAdd, setShowAdd] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [filterType, setFilterType] = useState<WorkoutType | "all">("all");

  const blankWorkout = (): Omit<Workout, "id"> => ({
    date: TODAY, name: "", type: "strength", durationMinutes: 45,
    caloriesBurned: 0, difficulty: "medium", muscleGroup: "chest", notes: "", exercises: [],
  });
  const [form, setForm] = useState(blankWorkout());
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const open = (w?: Workout) => {
    if (w) { setEditingWorkout(w); setForm({ ...w }); setExercises([...w.exercises]); }
    else { setEditingWorkout(null); setForm(blankWorkout()); setExercises([]); }
    setShowAdd(true);
  };

  const addExercise = () => setExercises(p => [...p, { id: uid(), name: "", sets: 3, reps: 10, weightKg: 0, restSeconds: 60, distanceKm: 0, durationMinutes: 0, notes: "" }]);
  const updateExercise = (id: string, k: keyof Exercise, v: string | number) => setExercises(p => p.map(e => e.id === id ? { ...e, [k]: v } : e));
  const removeExercise = (id: string) => setExercises(p => p.filter(e => e.id !== id));

  const save = async () => {
    if (!form.name) return Alert.alert("Enter workout name");
    const w = { ...form, exercises };
    if (editingWorkout) await fit.updateWorkout({ ...editingWorkout, ...w });
    else await fit.addWorkout(w);
    setShowAdd(false);
  };

  const filtered = filterType === "all" ? fit.workouts : fit.workouts.filter(w => w.type === filterType);
  const weeklyCount = fit.getWeeklyWorkoutCount();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.primary, fontSize: 22, fontFamily: "Inter_700Bold" }}>{weeklyCount}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>This Week</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: "#10B981", fontSize: 22, fontFamily: "Inter_700Bold" }}>{fit.getWorkoutStreak()}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Day Streak</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: "#7C3AED", fontSize: 22, fontFamily: "Inter_700Bold" }}>{fit.workouts.length}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Total</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => open()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginBottom: 16 }}>
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>+ Log Workout</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {(["all", ...WORKOUT_TYPES] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setFilterType(t as any)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: filterType === t ? colors.primary : colors.muted, marginRight: 8, borderWidth: 1, borderColor: filterType === t ? colors.primary : colors.border }}>
              <Text style={{ color: filterType === t ? colors.primaryForeground : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.map(w => (
          <Card key={w.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{w.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{w.date} · {w.type} · {w.muscleGroup}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{w.durationMinutes}min {w.caloriesBurned ? `· ${w.caloriesBurned} kcal` : ""} · {w.difficulty}</Text>
                {w.exercises.length > 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{w.exercises.length} exercise{w.exercises.length !== 1 ? "s" : ""}: {w.exercises.map(e => e.name).join(", ")}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => open(w)}><Feather name="edit-2" size={16} color={colors.mutedForeground} /></TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("Delete?", "", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => fit.deleteWorkout(w.id) }])}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}
        {filtered.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No workouts yet</Text>}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>{editingWorkout ? "Edit Workout" : "Log Workout"}</Text>
            <TouchableOpacity onPress={save}><Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <StrInput label="Workout Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Chest Day, Morning Run" />
            <StrInput label="Date" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
            <Chips options={WORKOUT_TYPES} selected={form.type} onSelect={v => setForm(p => ({ ...p, type: v }))} label="Type" />
            <Chips options={MUSCLE_GROUPS} selected={form.muscleGroup} onSelect={v => setForm(p => ({ ...p, muscleGroup: v }))} label="Muscle Group" />
            <Chips options={DIFFICULTIES} selected={form.difficulty} onSelect={v => setForm(p => ({ ...p, difficulty: v }))} label="Difficulty" />
            <NumInput label="Duration" value={form.durationMinutes} onChange={v => setForm(p => ({ ...p, durationMinutes: v }))} unit="min" />
            <NumInput label="Calories Burned (optional)" value={form.caloriesBurned} onChange={v => setForm(p => ({ ...p, caloriesBurned: v }))} unit="kcal" />
            <StrInput label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} multiline />

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Exercises ({exercises.length})</Text>
              <TouchableOpacity onPress={addExercise} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="plus-circle" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            </View>
            {exercises.map((ex, i) => (
              <Card key={ex.id} style={{ backgroundColor: colors.muted }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Exercise {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeExercise(ex.id)}><Feather name="x" size={16} color={colors.destructive} /></TouchableOpacity>
                </View>
                <StrInput label="Name" value={ex.name} onChange={v => updateExercise(ex.id, "name", v)} placeholder="e.g. Bench Press, Squat" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><NumInput label="Sets" value={ex.sets} onChange={v => updateExercise(ex.id, "sets", v)} /></View>
                  <View style={{ flex: 1 }}><NumInput label="Reps" value={ex.reps} onChange={v => updateExercise(ex.id, "reps", v)} /></View>
                  <View style={{ flex: 1 }}><NumInput label="Weight" value={ex.weightKg} onChange={v => updateExercise(ex.id, "weightKg", v)} unit="kg" /></View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><NumInput label="Rest" value={ex.restSeconds} onChange={v => updateExercise(ex.id, "restSeconds", v)} unit="sec" /></View>
                  <View style={{ flex: 1 }}><NumInput label="Distance" value={ex.distanceKm} onChange={v => updateExercise(ex.id, "distanceKm", v)} unit="km" /></View>
                </View>
              </Card>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── NUTRITION TAB ────────────────────────────────────────────────────────────

const COMMON_FOODS = [
  { name: "Roti", calories: 120, protein: 3, carbs: 25, fat: 1 },
  { name: "Rice (1 cup)", calories: 200, protein: 4, carbs: 44, fat: 0 },
  { name: "Dal (1 cup)", calories: 180, protein: 10, carbs: 28, fat: 3 },
  { name: "Paneer (100g)", calories: 265, protein: 18, carbs: 3, fat: 20 },
  { name: "Chicken (100g)", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { name: "Egg (1 whole)", calories: 70, protein: 6, carbs: 0, fat: 5 },
  { name: "Banana", calories: 90, protein: 1, carbs: 23, fat: 0 },
  { name: "Oats (1 cup)", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { name: "Milk (1 cup)", calories: 120, protein: 8, carbs: 12, fat: 5 },
  { name: "Curd (1 cup)", calories: 100, protein: 11, carbs: 8, fat: 4 },
];

function NutritionTab() {
  const colors = useColors();
  const fit = useFitness();
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showSetTargets, setShowSetTargets] = useState(false);

  const today = fit.getTodayNutrition();
  const todayDate = TODAY;

  const defaultTargets = { calorieTarget: 2000, proteinTarget: 150, carbsTarget: 250, fatTarget: 65, waterTargetMl: 3000 };

  const [targets, setTargets] = useState(today ? {
    calorieTarget: today.calorieTarget, proteinTarget: today.proteinTarget,
    carbsTarget: today.carbsTarget, fatTarget: today.fatTarget, waterTargetMl: today.waterTargetMl,
  } : defaultTargets);

  const [mealForm, setMealForm] = useState<Omit<MealItem, "id">>({ mealType: "breakfast", foodName: "", quantity: "1 serving", calories: 0, protein: 0, carbs: 0, fat: 0 });

  const ensureEntry = async (extra?: Partial<NutritionEntry>) => {
    if (today) return today;
    const e: Omit<NutritionEntry, "id"> = {
      date: todayDate, ...targets, caloriesConsumed: 0, proteinConsumed: 0,
      carbsConsumed: 0, fatConsumed: 0, waterConsumedMl: 0, notes: "", meals: [], ...extra,
    };
    await fit.saveNutritionEntry(e);
    return null;
  };

  const addMeal = async () => {
    if (!mealForm.foodName) return Alert.alert("Enter food name");
    const meal: MealItem = { ...mealForm, id: uid() };
    let entry = today;
    if (!entry) {
      await ensureEntry();
      entry = fit.getTodayNutrition();
    }
    if (!entry) return;
    const updated: NutritionEntry = {
      ...entry,
      meals: [...entry.meals, meal],
      caloriesConsumed: entry.caloriesConsumed + meal.calories,
      proteinConsumed: entry.proteinConsumed + meal.protein,
      carbsConsumed: entry.carbsConsumed + meal.carbs,
      fatConsumed: entry.fatConsumed + meal.fat,
    };
    await fit.updateNutritionEntry(updated);
    setShowAddMeal(false);
    setMealForm({ mealType: "breakfast", foodName: "", quantity: "1 serving", calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const removeMeal = async (mealId: string) => {
    if (!today) return;
    const meal = today.meals.find(m => m.id === mealId);
    if (!meal) return;
    await fit.updateNutritionEntry({
      ...today,
      meals: today.meals.filter(m => m.id !== mealId),
      caloriesConsumed: Math.max(today.caloriesConsumed - meal.calories, 0),
      proteinConsumed: Math.max(today.proteinConsumed - meal.protein, 0),
      carbsConsumed: Math.max(today.carbsConsumed - meal.carbs, 0),
      fatConsumed: Math.max(today.fatConsumed - meal.fat, 0),
    });
  };

  const addWater = async (ml: number) => {
    let entry = today;
    if (!entry) { await ensureEntry(); entry = fit.getTodayNutrition(); }
    if (!entry) return;
    await fit.updateNutritionEntry({ ...entry, waterConsumedMl: entry.waterConsumedMl + ml });
  };

  const saveTargets = async () => {
    if (today) await fit.updateNutritionEntry({ ...today, ...targets });
    else await fit.saveNutritionEntry({ date: todayDate, ...targets, caloriesConsumed: 0, proteinConsumed: 0, carbsConsumed: 0, fatConsumed: 0, waterConsumedMl: 0, notes: "", meals: [] });
    setShowSetTargets(false);
  };

  const mealsByType = MEAL_TYPES.map(mt => ({ type: mt, items: (today?.meals ?? []).filter(m => m.mealType === mt) }));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setShowAddMeal(true)} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>+ Log Meal</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSetTargets(true)} style={{ backgroundColor: colors.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="sliders" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Macro Progress */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Today — {todayDate}</Text>
        {[
          { label: "Calories", consumed: today?.caloriesConsumed ?? 0, target: targets.calorieTarget, unit: "kcal", color: colors.primary },
          { label: "Protein", consumed: today?.proteinConsumed ?? 0, target: targets.proteinTarget, unit: "g", color: "#10B981" },
          { label: "Carbs", consumed: today?.carbsConsumed ?? 0, target: targets.carbsTarget, unit: "g", color: "#3B82F6" },
          { label: "Fat", consumed: today?.fatConsumed ?? 0, target: targets.fatTarget, unit: "g", color: "#F97316" },
        ].map(m => (
          <View key={m.label} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{m.label}</Text>
              <Text style={{ color: m.color, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{m.consumed} / {m.target} {m.unit}</Text>
            </View>
            <ProgressBar value={m.consumed} max={m.target} color={m.color} />
          </View>
        ))}

        {/* Water */}
        <View style={{ marginTop: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>💧 Water</Text>
            <Text style={{ color: "#06B6D4", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{((today?.waterConsumedMl ?? 0) / 1000).toFixed(1)}L / {(targets.waterTargetMl / 1000).toFixed(1)}L</Text>
          </View>
          <ProgressBar value={today?.waterConsumedMl ?? 0} max={targets.waterTargetMl} color="#06B6D4" />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {[200, 300, 500].map(ml => (
              <TouchableOpacity key={ml} onPress={() => addWater(ml)} style={{ flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>+{ml}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      {/* Meals by type */}
      {mealsByType.filter(g => g.items.length > 0).map(g => (
        <Card key={g.type}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 8, textTransform: "capitalize" }}>{g.type}</Text>
          {g.items.map(item => (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{item.foodName} · {item.quantity}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.calories}kcal · P:{item.protein}g C:{item.carbs}g F:{item.fat}g</Text>
              </View>
              <TouchableOpacity onPress={() => removeMeal(item.id)}><Feather name="trash-2" size={14} color={colors.destructive} /></TouchableOpacity>
            </View>
          ))}
        </Card>
      ))}

      {(!today || today.meals.length === 0) && (
        <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>No meals logged today</Text>
      )}

      {/* Add Meal Modal */}
      <Modal visible={showAddMeal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMeal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowAddMeal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>Log Meal</Text>
            <TouchableOpacity onPress={addMeal}><Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Add</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Chips options={MEAL_TYPES} selected={mealForm.mealType} onSelect={v => setMealForm(p => ({ ...p, mealType: v }))} label="Meal Type" />
            <StrInput label="Food Name" value={mealForm.foodName} onChange={v => setMealForm(p => ({ ...p, foodName: v }))} placeholder="e.g. Roti, Chicken, Dal" />
            <StrInput label="Quantity" value={mealForm.quantity} onChange={v => setMealForm(p => ({ ...p, quantity: v }))} placeholder="e.g. 2 rotis, 100g" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><NumInput label="Calories" value={mealForm.calories} onChange={v => setMealForm(p => ({ ...p, calories: v }))} unit="kcal" /></View>
              <View style={{ flex: 1 }}><NumInput label="Protein" value={mealForm.protein} onChange={v => setMealForm(p => ({ ...p, protein: v }))} unit="g" /></View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><NumInput label="Carbs" value={mealForm.carbs} onChange={v => setMealForm(p => ({ ...p, carbs: v }))} unit="g" /></View>
              <View style={{ flex: 1 }}><NumInput label="Fat" value={mealForm.fat} onChange={v => setMealForm(p => ({ ...p, fat: v }))} unit="g" /></View>
            </View>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 4 }}>Quick Add</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {COMMON_FOODS.map(f => (
                <TouchableOpacity key={f.name} onPress={() => setMealForm(p => ({ ...p, foodName: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat }))}
                  style={{ backgroundColor: colors.muted, borderRadius: 8, padding: 10, marginRight: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center", minWidth: 80 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center" }}>{f.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{f.calories}kcal</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>

      {/* Set Targets Modal */}
      <Modal visible={showSetTargets} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSetTargets(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setShowSetTargets(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }}>Set Targets</Text>
            <TouchableOpacity onPress={saveTargets}><Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <NumInput label="Calorie Target" value={targets.calorieTarget} onChange={v => setTargets(p => ({ ...p, calorieTarget: v }))} unit="kcal" />
            <NumInput label="Protein Target" value={targets.proteinTarget} onChange={v => setTargets(p => ({ ...p, proteinTarget: v }))} unit="g" />
            <NumInput label="Carbs Target" value={targets.carbsTarget} onChange={v => setTargets(p => ({ ...p, carbsTarget: v }))} unit="g" />
            <NumInput label="Fat Target" value={targets.fatTarget} onChange={v => setTargets(p => ({ ...p, fatTarget: v }))} unit="g" />
            <NumInput label="Water Target" value={targets.waterTargetMl} onChange={v => setTargets(p => ({ ...p, waterTargetMl: v }))} unit="ml" />
            <View style={{ backgroundColor: colors.muted, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>⚠️ For safe results, avoid extreme calorie deficits. Consult a professional for personalised diet plans.</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────

function ProgressTab() {
  const colors = useColors();
  const fit = useFitness();
  const [period, setPeriod] = useState<7 | 30>(7);

  const today = new Date();
  const days = Array.from({ length: period }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (period - 1 - i));
    return d.toISOString().split("T")[0];
  });

  const weightData = days.map(d => ({ date: d, value: fit.bodyEntries.find(e => e.date === d)?.weightKg ?? null }));
  const workoutData = days.map(d => ({ date: d, value: fit.workouts.filter(w => w.date === d).length }));
  const sleepData = days.map(d => ({ date: d, value: fit.sleepEntries.find(e => e.date === d)?.sleepHours ?? null }));

  const maxWeight = Math.max(...weightData.map(d => d.value ?? 0)) || 100;
  const maxWorkout = Math.max(...workoutData.map(d => d.value), 1);
  const maxSleep = Math.max(...sleepData.map(d => d.value ?? 0), 10);

  const activeHabits = fit.habits.filter(h => h.isActive);
  const last7Dates = days.slice(-7);
  const habitCompletion = activeHabits.map(h => ({
    habit: h,
    streak: fit.getHabitStreak(h.id),
    completed7: last7Dates.filter(d => fit.habitLogs.some(l => l.habitId === h.id && l.date === d && l.isCompleted)).length,
  }));

  function MiniBar({ value, max, color, label }: { value: number | null; max: number; color: string; label: string }) {
    const c = useColors();
    const h = value != null ? Math.max((value / max) * 60, 4) : 0;
    return (
      <View style={{ alignItems: "center", flex: 1 }}>
        <View style={{ width: "70%", height: 60, justifyContent: "flex-end" }}>
          <View style={{ height: h, backgroundColor: value != null ? color : c.border, borderRadius: 3 }} />
        </View>
        <Text style={{ color: c.mutedForeground, fontSize: 9, marginTop: 2 }}>{label.slice(-2)}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {([7, 30] as const).map(p => (
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: period === p ? colors.primary : colors.muted, borderWidth: 1, borderColor: period === p ? colors.primary : colors.border, alignItems: "center" }}>
            <Text style={{ color: period === p ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Last {p} days</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Weight chart */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 12 }}>Weight (kg)</Text>
        <View style={{ flexDirection: "row", height: 70, alignItems: "flex-end" }}>
          {weightData.map((d, i) => <MiniBar key={i} value={d.value} max={maxWeight} color={colors.primary} label={d.date} />)}
        </View>
      </Card>

      {/* Workouts chart */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 12 }}>Workouts per Day</Text>
        <View style={{ flexDirection: "row", height: 70, alignItems: "flex-end" }}>
          {workoutData.map((d, i) => <MiniBar key={i} value={d.value} max={maxWorkout} color="#10B981" label={d.date} />)}
        </View>
      </Card>

      {/* Sleep chart */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 12 }}>Sleep Hours</Text>
        <View style={{ flexDirection: "row", height: 70, alignItems: "flex-end" }}>
          {sleepData.map((d, i) => <MiniBar key={i} value={d.value} max={maxSleep} color="#7C3AED" label={d.date} />)}
        </View>
      </Card>

      {/* Habits */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Habit Tracker</Text>
        {activeHabits.map(h => {
          const hc = habitCompletion.find(x => x.habit.id === h.id)!;
          const today7Completed = last7Dates.filter(d => fit.habitLogs.some(l => l.habitId === h.id && l.date === d && l.isCompleted)).length;
          const todayDone = fit.habitLogs.some(l => l.habitId === h.id && l.date === TODAY && l.isCompleted);
          return (
            <View key={h.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{h.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{h.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{today7Completed}/7 this week · 🔥 {hc.streak}d streak</Text>
                <View style={{ flexDirection: "row", gap: 3, marginTop: 4 }}>
                  {last7Dates.map(d => {
                    const done = fit.habitLogs.some(l => l.habitId === h.id && l.date === d && l.isCompleted);
                    return <View key={d} style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: done ? colors.primary : colors.border }} />;
                  })}
                </View>
              </View>
              <TouchableOpacity onPress={() => fit.toggleHabitLog(h.id, TODAY)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: todayDone ? colors.primary : colors.muted, borderWidth: 1, borderColor: todayDone ? colors.primary : colors.border, alignItems: "center", justifyContent: "center" }}>
                <Feather name="check" size={16} color={todayDone ? colors.primaryForeground : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })}
        {activeHabits.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>No habits configured</Text>}
      </Card>

      {/* Weekly report */}
      <Card>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 12 }}>Weekly Summary</Text>
        {(() => {
          const score = fit.computeFitnessScore();
          const latest = fit.bodyEntries[0];
          const prev7 = fit.bodyEntries.find(e => {
            const d = new Date(today); d.setDate(d.getDate() - 7);
            return e.date <= d.toISOString().split("T")[0];
          });
          const weightChange = latest && prev7 ? (latest.weightKg - prev7.weightKg).toFixed(1) : null;
          const avgSleep = fit.sleepEntries.slice(0, 7).length > 0 ? (fit.sleepEntries.slice(0, 7).reduce((s, e) => s + e.sleepHours, 0) / fit.sleepEntries.slice(0, 7).length).toFixed(1) : "—";
          return (
            <View style={{ gap: 8 }}>
              {[
                { label: "Fitness Score", value: `${score.total}/100`, color: colors.primary },
                { label: "Weekly Workouts", value: `${fit.getWeeklyWorkoutCount()}/${fit.profile?.workoutDaysPerWeek ?? 4}`, color: "#10B981" },
                { label: "Weight Change", value: weightChange ? `${Number(weightChange) > 0 ? "+" : ""}${weightChange}kg` : "—", color: Number(weightChange) < 0 ? "#10B981" : colors.primary },
                { label: "Avg Sleep", value: `${avgSleep}h`, color: "#7C3AED" },
              ].map(r => (
                <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ color: r.color, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{r.value}</Text>
                </View>
              ))}
            </View>
          );
        })()}
      </Card>
    </ScrollView>
  );
}

// ─── PROFILE TAB ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const colors = useColors();
  const fit = useFitness();
  const [editing, setEditing] = useState(!fit.profile?.name);
  const [form, setForm] = useState(fit.profile ?? {
    name: "", age: 25, gender: "" as any, heightCm: 170, currentWeight: 70, targetWeight: 65,
    currentBodyFat: 20, targetBodyFat: 15, goal: "general_fitness" as const,
    activityLevel: "moderately_active" as const, experienceLevel: "beginner" as const,
    workoutDaysPerWeek: 4, workoutLocation: "gym" as const, equipment: ["dumbbells"] as any,
  });

  const save = async () => {
    if (!form.name) return Alert.alert("Enter your name");
    await fit.saveProfile(form);
    setEditing(false);
  };

  if (!editing && fit.profile) {
    const p = fit.profile;
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Card style={{ alignItems: "center", paddingVertical: 20 }}>
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Text style={{ color: colors.primaryForeground, fontSize: 28, fontFamily: "Inter_700Bold" }}>{p.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>{p.name}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>{GOAL_LABELS[p.goal]}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Edit Profile</Text>
          </TouchableOpacity>
        </Card>
        {[
          ["Age", `${p.age} years`], ["Height", `${p.heightCm} cm`],
          ["Current Weight", `${p.currentWeight} kg`], ["Target Weight", `${p.targetWeight} kg`],
          ["Body Fat", `${p.currentBodyFat}% → ${p.targetBodyFat}%`],
          ["Experience", p.experienceLevel], ["Activity", p.activityLevel.replace(/_/g, " ")],
          ["Workout Days", `${p.workoutDaysPerWeek}/week`], ["Location", p.workoutLocation],
          ["Equipment", p.equipment.join(", ")],
        ].map(([l, v]) => (
          <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{l}</Text>
            <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13, textTransform: "capitalize" }}>{v}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 16 }}>
        {fit.profile?.name ? "Edit Profile" : "Set Up Your Profile"}
      </Text>
      <StrInput label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Your name" />
      <NumInput label="Age" value={form.age} onChange={v => setForm(p => ({ ...p, age: v }))} unit="years" />
      <Chips options={["male", "female", "other"] as const} selected={form.gender} onSelect={(v: any) => setForm(p => ({ ...p, gender: v }))} label="Gender (optional)" />
      <NumInput label="Height" value={form.heightCm} onChange={v => setForm(p => ({ ...p, heightCm: v }))} unit="cm" />
      <NumInput label="Current Weight" value={form.currentWeight} onChange={v => setForm(p => ({ ...p, currentWeight: v }))} unit="kg" />
      <NumInput label="Target Weight" value={form.targetWeight} onChange={v => setForm(p => ({ ...p, targetWeight: v }))} unit="kg" />
      <NumInput label="Current Body Fat %" value={form.currentBodyFat} onChange={v => setForm(p => ({ ...p, currentBodyFat: v }))} unit="%" />
      <NumInput label="Target Body Fat %" value={form.targetBodyFat} onChange={v => setForm(p => ({ ...p, targetBodyFat: v }))} unit="%" />
      <Chips options={["fat_loss", "muscle_gain", "maintenance", "general_fitness", "strength"] as const} selected={form.goal} onSelect={v => setForm(p => ({ ...p, goal: v }))} label="Fitness Goal" />
      <Chips options={["sedentary", "lightly_active", "moderately_active", "very_active"] as const} selected={form.activityLevel} onSelect={v => setForm(p => ({ ...p, activityLevel: v }))} label="Activity Level" />
      <Chips options={["beginner", "intermediate", "advanced"] as const} selected={form.experienceLevel} onSelect={v => setForm(p => ({ ...p, experienceLevel: v }))} label="Experience" />
      <NumInput label="Workout Days per Week" value={form.workoutDaysPerWeek} onChange={v => setForm(p => ({ ...p, workoutDaysPerWeek: v }))} />
      <Chips options={["gym", "home", "outdoor", "mixed"] as const} selected={form.workoutLocation} onSelect={v => setForm(p => ({ ...p, workoutLocation: v }))} label="Workout Location" />
      <Chips options={["dumbbells", "barbell", "machines", "resistance_bands", "bodyweight", "treadmill", "cycle", "other"] as const} selected={form.equipment} onSelect={(v: any) => setForm(p => ({ ...p, equipment: p.equipment.includes(v) ? p.equipment.filter((e: any) => e !== v) : [...p.equipment, v] }))} multi label="Equipment Available" />
      <TouchableOpacity onPress={save} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 }}>
        <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 16 }}>Save Profile</Text>
      </TouchableOpacity>
      {fit.profile?.name && (
        <TouchableOpacity onPress={() => setEditing(false)} style={{ paddingVertical: 12, alignItems: "center", marginTop: 4 }}>
          <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── ROOT SCREEN ──────────────────────────────────────────────────────────────

export default function FitnessScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<FitnessTab>("dashboard");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader />
      <View style={{ flex: 1 }}>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "track" && <TrackTab />}
        {activeTab === "workout" && <WorkoutTab />}
        {activeTab === "nutrition" && <NutritionTab />}
        {activeTab === "progress" && <ProgressTab />}
        {activeTab === "profile" && <ProfileTab />}
      </View>

      <ModuleBottomNav items={TABS} activeKey={activeTab} onChange={setActiveTab} />
    </View>
  );
}
