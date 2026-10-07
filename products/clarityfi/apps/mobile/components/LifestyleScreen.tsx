import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppHeader from "@/components/AppHeader";
import ModuleBottomNav, { type ModuleBottomNavItem } from "@/components/ModuleBottomNav";
import { useGemini } from "@/context/GeminiContext";
import {
  type Habit,
  type MealType,
  type TimelineCategory,
  useLifestyle,
} from "@/context/LifestyleContext";
import { useColors } from "@/hooks/useColors";

const TODAY = new Date().toISOString().split("T")[0];
const NOW_HH_MM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type LifestyleTab = "dashboard" | "habits" | "meals" | "timeline";

const HABIT_ICONS = ["☀️","🧘","📖","💪","🚶","🥗","💧","✍️","🎯","🙏","🌙","❤️","🎵","🌿","⚡","🔥","🌊","🧠"];
const HABIT_COLORS = ["#C9A840","#7C3AED","#3B82F6","#10B981","#EF4444","#F97316","#EC4899","#06B6D4"];

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "🌅" },
  { key: "lunch", label: "Lunch", icon: "☀️" },
  { key: "dinner", label: "Dinner", icon: "🌙" },
  { key: "snack", label: "Snack", icon: "🍎" },
];

const TIMELINE_CATEGORIES: { key: TimelineCategory; label: string; color: string; icon: string }[] = [
  { key: "sleep", label: "Sleep", color: "#7C3AED", icon: "🌙" },
  { key: "exercise", label: "Exercise", color: "#10B981", icon: "💪" },
  { key: "meal", label: "Meal", color: "#F97316", icon: "🍽️" },
  { key: "work", label: "Work", color: "#3B82F6", icon: "💼" },
  { key: "study", label: "Study", color: "#C9A840", icon: "📖" },
  { key: "leisure", label: "Leisure", color: "#EC4899", icon: "🎮" },
  { key: "social", label: "Social", color: "#06B6D4", icon: "👥" },
  { key: "self-care", label: "Self-care", color: "#EF4444", icon: "🧘" },
  { key: "other", label: "Other", color: "#666666", icon: "⚡" },
];

const QUICK_HABITS = [
  { name: "Meditation", icon: "🧘", color: "#7C3AED" },
  { name: "Reading", icon: "📖", color: "#3B82F6" },
  { name: "Workout", icon: "💪", color: "#10B981" },
  { name: "Journaling", icon: "✍️", color: "#C9A840" },
  { name: "Walk", icon: "🚶", color: "#F97316" },
  { name: "Prayer", icon: "🙏", color: "#EC4899" },
  { name: "No Sugar", icon: "🥗", color: "#EF4444" },
  { name: "Early Sleep", icon: "🌙", color: "#7C3AED" },
];

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const colors = useColors();
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#C9A840" : "#EF4444";
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 8, borderColor: colors.border }} />
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 8, borderColor: color, opacity: score / 100 }} />
      <Text style={{ fontSize: size * 0.28, fontFamily: "Inter_700Bold", color }}>{score}</Text>
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>/ 100</Text>
    </View>
  );
}

function MetricCard({ label, value, unit, icon, color, onPress }: { label: string; value: string | number; unit: string; icon: string; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricEditModal({ visible, label, unit, value, min, max, step = 1, onSave, onClose }: {
  visible: boolean; label: string; unit: string; value: number; min: number; max: number; step?: number;
  onSave: (v: number) => void; onClose: () => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState(value);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.metricOverlay} onPress={onClose}>
        <Pressable style={[styles.metricModal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[styles.metricModalTitle, { color: colors.foreground }]}>Log {label}</Text>
          <View style={styles.metricStepper}>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.muted }]} onPress={() => setDraft((v) => Math.max(min, +(v - step).toFixed(1)))}>
              <Feather name="minus" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.stepValue, { color: colors.foreground }]}>{draft} <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{unit}</Text></Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: colors.muted }]} onPress={() => setDraft((v) => Math.min(max, +(v + step).toFixed(1)))}>
              <Feather name="plus" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={() => { onSave(draft); onClose(); }}>
            <Text style={[styles.saveBtnText, { color: "#000" }]}>Save</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DashboardTab() {
  const colors = useColors();
  const { todayScore, todayMetrics, updateMetrics, habits, toggleHabit, getMealsForDate } = useLifestyle();
  const { apiKey, sendMessage, messages, isLoading } = useGemini();
  const todayMeals = getMealsForDate(TODAY);
  const totalCal = todayMeals.reduce((s, m) => s + m.calories, 0);
  const todayHabits = habits.filter((h) => h.completedDates.includes(TODAY));

  const [editMetric, setEditMetric] = useState<null | { key: string; label: string; unit: string; value: number; min: number; max: number; step?: number }>(null);
  const [insight, setInsight] = useState("");
  const [fetchingInsight, setFetchingInsight] = useState(false);

  const fetchInsight = async () => {
    if (!apiKey) { Alert.alert("No API Key", "Add your Gemini API key in Preferences to get AI insights."); return; }
    setFetchingInsight(true);
    const prompt = `Based on today's data: sleep ${todayMetrics.sleep}h (quality ${todayMetrics.sleepQuality}/5), water ${todayMetrics.water} glasses, ${todayMetrics.steps} steps, stress ${todayMetrics.stress}/5, mood ${todayMetrics.mood}/5, focus ${todayMetrics.focusTime} min, ${todayMeals.length} meals (${totalCal} cal), ${todayHabits.length}/${habits.length} habits done. Lifestyle score: ${todayScore}/100. Give one short actionable insight (2-3 sentences max) to improve today.`;
    try {
      await sendMessage(prompt);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") setInsight(last.text);
    } catch {}
    setFetchingInsight(false);
  };

  const scoreColor = todayScore >= 70 ? "#10B981" : todayScore >= 40 ? "#C9A840" : "#EF4444";

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.scoreLeft}>
          <ScoreRing score={todayScore} size={100} />
        </View>
        <View style={styles.scoreRight}>
          <Text style={[styles.scoreTodayLabel, { color: colors.mutedForeground }]}>TODAY'S SCORE</Text>
          <Text style={[styles.scoreStatus, { color: scoreColor }]}>
            {todayScore >= 70 ? "Great day! 🎉" : todayScore >= 40 ? "Room to improve 💪" : "Let's get started 🌅"}
          </Text>
          <Text style={[styles.scoreBreakdown, { color: colors.mutedForeground }]}>
            {habits.length > 0 ? `${todayHabits.length}/${habits.length} habits` : "No habits yet"} · {todayMeals.length} meals
          </Text>
          <TouchableOpacity style={[styles.insightBtn, { backgroundColor: "#7C3AED22", borderColor: "#7C3AED44" }]} onPress={fetchInsight} disabled={fetchingInsight} activeOpacity={0.7}>
            <Feather name="zap" size={12} color="#7C3AED" />
            <Text style={[styles.insightBtnText, { color: "#7C3AED" }]}>{fetchingInsight ? "Thinking…" : "AI Insight"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {insight ? (
        <View style={[styles.insightCard, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED40" }]}>
          <Feather name="zap" size={14} color="#7C3AED" style={{ marginTop: 2 }} />
          <Text style={[styles.insightText, { color: colors.foreground }]}>{insight}</Text>
        </View>
      ) : null}

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>HEALTH METRICS</Text>
      <View style={styles.metricsGrid}>
        <MetricCard label="Sleep" value={todayMetrics.sleep} unit="hrs" icon="🌙" color="#7C3AED" onPress={() => setEditMetric({ key: "sleep", label: "Sleep", unit: "hrs", value: todayMetrics.sleep, min: 0, max: 12, step: 0.5 })} />
        <MetricCard label="Water" value={todayMetrics.water} unit="glasses" icon="💧" color="#3B82F6" onPress={() => setEditMetric({ key: "water", label: "Water", unit: "glasses", value: todayMetrics.water, min: 0, max: 20 })} />
        <MetricCard label="Steps" value={todayMetrics.steps >= 1000 ? `${(todayMetrics.steps / 1000).toFixed(1)}k` : todayMetrics.steps} unit="steps" icon="🚶" color="#10B981" onPress={() => setEditMetric({ key: "steps", label: "Steps", unit: "steps", value: todayMetrics.steps, min: 0, max: 30000, step: 500 })} />
        <MetricCard label="Focus" value={todayMetrics.focusTime} unit="min" icon="⚡" color="#C9A840" onPress={() => setEditMetric({ key: "focusTime", label: "Focus Time", unit: "min", value: todayMetrics.focusTime, min: 0, max: 720, step: 15 })} />
        <MetricCard label="Stress" value={todayMetrics.stress} unit="/ 5" icon="🧠" color="#EF4444" onPress={() => setEditMetric({ key: "stress", label: "Stress Level", unit: "/ 5", value: todayMetrics.stress, min: 1, max: 5 })} />
        <MetricCard label="Mood" value={todayMetrics.mood} unit="/ 5" icon="😊" color="#EC4899" onPress={() => setEditMetric({ key: "mood", label: "Mood", unit: "/ 5", value: todayMetrics.mood, min: 1, max: 5 })} />
      </View>

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>TODAY'S HABITS</Text>
      {habits.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>No habits yet — go to Habits tab to add some</Text>
        </View>
      ) : (
        <View style={[styles.habitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {habits.slice(0, 5).map((h) => {
            const done = h.completedDates.includes(TODAY);
            return (
              <TouchableOpacity key={h.id} style={[styles.habitRow, { borderBottomColor: colors.border }]} onPress={() => toggleHabit(h.id, TODAY)} activeOpacity={0.7}>
                <Text style={styles.habitRowIcon}>{h.icon}</Text>
                <Text style={[styles.habitRowName, { color: done ? colors.foreground : colors.mutedForeground }]}>{h.name}</Text>
                <View style={[styles.habitCheck, { backgroundColor: done ? h.color : "transparent", borderColor: done ? h.color : colors.border }]}>
                  {done && <Feather name="check" size={12} color="#000" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>SCORE BREAKDOWN</Text>
      <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: "Sleep", pts: Math.round(Math.min(20, (todayMetrics.sleep / 8) * 20)), max: 20, color: "#7C3AED" },
          { label: "Water", pts: Math.round(Math.min(10, (todayMetrics.water / 8) * 10)), max: 10, color: "#3B82F6" },
          { label: "Steps", pts: Math.round(Math.min(15, (todayMetrics.steps / 10000) * 15)), max: 15, color: "#10B981" },
          { label: "Meals", pts: Math.round(Math.min(15, (Math.min(todayMeals.length, 3) / 3) * 15)), max: 15, color: "#F97316" },
          { label: "Habits", pts: habits.length > 0 ? Math.round(Math.min(15, (todayHabits.length / habits.length) * 15)) : 0, max: 15, color: "#EC4899" },
          { label: "Focus", pts: Math.round(Math.min(15, (todayMetrics.focusTime / 480) * 15)), max: 15, color: "#C9A840" },
          { label: "Stress", pts: Math.round(Math.min(10, ((5 - todayMetrics.stress + 1) / 5) * 10)), max: 10, color: "#06B6D4" },
        ].map((b) => (
          <View key={b.label} style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>{b.label}</Text>
            <View style={[styles.breakdownBar, { backgroundColor: colors.border }]}>
              <View style={[styles.breakdownFill, { backgroundColor: b.color, width: `${(b.pts / b.max) * 100}%` }]} />
            </View>
            <Text style={[styles.breakdownPts, { color: b.color }]}>{b.pts}/{b.max}</Text>
          </View>
        ))}
      </View>

      {editMetric && (
        <MetricEditModal
          visible={!!editMetric}
          label={editMetric.label}
          unit={editMetric.unit}
          value={editMetric.value}
          min={editMetric.min}
          max={editMetric.max}
          step={editMetric.step}
          onSave={(v) => updateMetrics(TODAY, { [editMetric.key]: v })}
          onClose={() => setEditMetric(null)}
        />
      )}
    </ScrollView>
  );
}

function HabitsTab() {
  const colors = useColors();
  const { habits, toggleHabit, addHabit, deleteHabit, getHabitStreak } = useLifestyle();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("☀️");
  const [selectedColor, setSelectedColor] = useState("#C9A840");
  const [showQuick, setShowQuick] = useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    addHabit({ name: name.trim(), icon: selectedIcon, color: selectedColor, frequency: "daily" });
    setName(""); setSelectedIcon("☀️"); setSelectedColor("#C9A840");
    setShowAdd(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={styles.habitsHeader}>
        <Text style={[styles.habitsTitle, { color: colors.foreground }]}>Today's Habits</Text>
        <TouchableOpacity style={[styles.addHabitBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Feather name="plus" size={16} color="#000" />
          <Text style={[styles.addHabitBtnText, { color: "#000" }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {habits.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No habits yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Add habits you want to build daily, or pick from quick templates below.</Text>
          <TouchableOpacity style={[styles.quickAddBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setShowQuick(true)} activeOpacity={0.7}>
            <Text style={[styles.quickAddBtnText, { color: colors.foreground }]}>⚡ Quick Add Templates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        habits.map((h) => {
          const done = h.completedDates.includes(TODAY);
          const streak = getHabitStreak(h);
          return (
            <View key={h.id} style={[styles.habitCard, { backgroundColor: colors.card, borderColor: done ? h.color + "60" : colors.border }]}>
              <View style={[styles.habitIconBg, { backgroundColor: h.color + "22" }]}>
                <Text style={{ fontSize: 20 }}>{h.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.habitName, { color: colors.foreground }]}>{h.name}</Text>
                <Text style={[styles.habitStreak, { color: colors.mutedForeground }]}>🔥 {streak} day streak</Text>
              </View>
              <TouchableOpacity
                style={[styles.habitToggle, { backgroundColor: done ? h.color : "transparent", borderColor: done ? h.color : colors.border }]}
                onPress={() => toggleHabit(h.id, TODAY)}
                activeOpacity={0.7}
              >
                {done ? <Feather name="check" size={18} color="#000" /> : <View />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteHabitBtn} onPress={() => Alert.alert("Delete Habit", `Delete "${h.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteHabit(h.id) }])} activeOpacity={0.7}>
                <Feather name="trash-2" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {habits.length > 0 && (
        <TouchableOpacity style={[styles.quickAddBtn, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]} onPress={() => setShowQuick(true)} activeOpacity={0.7}>
          <Text style={[styles.quickAddBtnText, { color: colors.mutedForeground }]}>⚡ Quick Add Templates</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showQuick} transparent animationType="slide" onRequestClose={() => setShowQuick(false)}>
        <Pressable style={styles.metricOverlay} onPress={() => setShowQuick(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Quick Add Habits</Text>
            <View style={styles.quickGrid}>
              {QUICK_HABITS.map((q) => {
                const exists = habits.some((h) => h.name === q.name);
                return (
                  <TouchableOpacity key={q.name} style={[styles.quickChip, { backgroundColor: exists ? q.color + "30" : colors.muted, borderColor: exists ? q.color : colors.border }]}
                    onPress={() => { if (!exists) { addHabit({ name: q.name, icon: q.icon, color: q.color, frequency: "daily" }); } }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 16 }}>{q.icon}</Text>
                    <Text style={[styles.quickChipText, { color: exists ? q.color : colors.foreground }]}>{q.name}</Text>
                    {exists && <Feather name="check" size={12} color={q.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={() => setShowQuick(false)}>
              <Text style={[styles.saveBtnText, { color: "#000" }]}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.metricOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Habit</Text>
            <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Habit name…" placeholderTextColor={colors.mutedForeground} autoFocus />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.iconRow}>
                {HABIT_ICONS.map((ic) => (
                  <TouchableOpacity key={ic} style={[styles.iconPick, { backgroundColor: selectedIcon === ic ? colors.primary + "30" : colors.muted, borderColor: selectedIcon === ic ? colors.primary : colors.border }]} onPress={() => setSelectedIcon(ic)}>
                    <Text style={{ fontSize: 20 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>COLOR</Text>
            <View style={styles.colorRow}>
              {HABIT_COLORS.map((c) => (
                <TouchableOpacity key={c} style={[styles.colorPick, { backgroundColor: c, borderWidth: selectedColor === c ? 3 : 1, borderColor: selectedColor === c ? "#FFF" : "transparent" }]} onPress={() => setSelectedColor(c)} />
              ))}
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: name.trim() ? colors.primary : colors.border, marginTop: 16 }]} disabled={!name.trim()} onPress={handleAdd}>
              <Text style={[styles.saveBtnText, { color: name.trim() ? "#000" : colors.mutedForeground }]}>Add Habit</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function MealsTab() {
  const colors = useColors();
  const { getMealsForDate, addMeal, deleteMeal } = useLifestyle();
  const { apiKey, sendMessage, messages } = useGemini();
  const todayMeals = getMealsForDate(TODAY);
  const totalCal = todayMeals.reduce((s, m) => s + m.calories, 0);

  const [showAdd, setShowAdd] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [calories, setCalories] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<null | { calories: number; note: string }>(null);

  const estimateCalories = async () => {
    if (!mealName.trim()) return;
    if (!apiKey) { Alert.alert("No API Key", "Add your Gemini API key in Preferences to use AI calorie estimation."); return; }
    setEstimating(true);
    try {
      await sendMessage(`Estimate calories for: "${mealName}". Reply with ONLY a JSON object: {"calories": number, "note": "brief description"}. No other text.`);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        const txt = last.text.trim().replace(/```json|```/g, "");
        const parsed = JSON.parse(txt);
        setAiEstimate(parsed);
        setCalories(String(parsed.calories));
      }
    } catch {
      Alert.alert("Estimate failed", "Could not parse AI response. Please enter calories manually.");
    }
    setEstimating(false);
  };

  const handleAdd = () => {
    if (!mealName.trim() || !calories) return;
    const now = NOW_HH_MM();
    addMeal({ date: TODAY, time: now, name: mealName.trim(), mealType, calories: parseInt(calories, 10) || 0 });
    setMealName(""); setCalories(""); setAiEstimate(null); setMealType("lunch"); setShowAdd(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={[styles.calSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.calLeft}>
          <Text style={[styles.calBig, { color: colors.primary }]}>{totalCal}</Text>
          <Text style={[styles.calLabel, { color: colors.mutedForeground }]}>kcal today</Text>
        </View>
        <View style={styles.calRight}>
          {MEAL_TYPES.map((mt) => {
            const has = todayMeals.some((m) => m.mealType === mt.key);
            return (
              <View key={mt.key} style={[styles.mealTypeBadge, { backgroundColor: has ? colors.primary + "22" : colors.muted }]}>
                <Text style={{ fontSize: 12 }}>{mt.icon}</Text>
                <Text style={[styles.mealTypeBadgeText, { color: has ? colors.primary : colors.mutedForeground }]}>{mt.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.habitsHeader}>
        <Text style={[styles.habitsTitle, { color: colors.foreground }]}>Today's Meals</Text>
        <TouchableOpacity style={[styles.addHabitBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Feather name="plus" size={16} color="#000" />
          <Text style={[styles.addHabitBtnText, { color: "#000" }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {todayMeals.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No meals logged</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Tap Add to log a meal. Use AI to estimate calories automatically.</Text>
        </View>
      ) : (
        todayMeals.map((m) => {
          const mt = MEAL_TYPES.find((t) => t.key === m.mealType);
          return (
            <View key={m.id} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.mealCardIcon}>{mt?.icon ?? "🍽️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mealCardName, { color: colors.foreground }]}>{m.name}</Text>
                <Text style={[styles.mealCardMeta, { color: colors.mutedForeground }]}>{mt?.label} · {m.time}</Text>
              </View>
              <Text style={[styles.mealCardCal, { color: colors.primary }]}>{m.calories} kcal</Text>
              <TouchableOpacity onPress={() => Alert.alert("Delete meal?", m.name, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMeal(m.id) }])} activeOpacity={0.7} style={{ padding: 4 }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.metricOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Log Meal</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity key={mt.key} style={[styles.mealTypeBtn, { backgroundColor: mealType === mt.key ? colors.primary + "22" : colors.muted, borderColor: mealType === mt.key ? colors.primary : colors.border }]} onPress={() => setMealType(mt.key)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14 }}>{mt.icon}</Text>
                  <Text style={[styles.mealTypeBtnText, { color: mealType === mt.key ? colors.primary : colors.mutedForeground }]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>WHAT DID YOU EAT?</Text>
            <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={mealName} onChangeText={(t) => { setMealName(t); setAiEstimate(null); }} placeholder="e.g. 2 roti, dal, rice…" placeholderTextColor={colors.mutedForeground} autoFocus />
            <TouchableOpacity style={[styles.aiEstimateBtn, { backgroundColor: "#7C3AED22", borderColor: "#7C3AED44" }]} onPress={estimateCalories} disabled={estimating || !mealName.trim()} activeOpacity={0.7}>
              <Feather name="zap" size={14} color="#7C3AED" />
              <Text style={[styles.aiEstimateBtnText, { color: "#7C3AED" }]}>{estimating ? "Estimating…" : "AI Estimate Calories"}</Text>
            </TouchableOpacity>
            {aiEstimate && (
              <View style={[styles.aiEstimateResult, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED40" }]}>
                <Text style={[styles.aiEstimateNote, { color: colors.mutedForeground }]}>⚠️ AI estimate — may vary</Text>
                <Text style={[styles.aiEstimateVal, { color: "#7C3AED" }]}>{aiEstimate.calories} kcal</Text>
                <Text style={[styles.aiEstimateDesc, { color: colors.mutedForeground }]}>{aiEstimate.note}</Text>
              </View>
            )}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CALORIES</Text>
            <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={calories} onChangeText={setCalories} placeholder="Enter or use AI estimate" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: mealName.trim() && calories ? colors.primary : colors.border, marginTop: 16 }]} disabled={!mealName.trim() || !calories} onPress={handleAdd}>
              <Text style={[styles.saveBtnText, { color: mealName.trim() && calories ? "#000" : colors.mutedForeground }]}>Save Meal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function TimelineTab() {
  const colors = useColors();
  const { getTimelineForDate, addTimelineEntry, deleteTimelineEntry } = useLifestyle();
  const entries = getTimelineForDate(TODAY);
  const [showAdd, setShowAdd] = useState(false);
  const [activity, setActivity] = useState("");
  const [startTime, setStartTime] = useState(NOW_HH_MM());
  const [endTime, setEndTime] = useState(NOW_HH_MM());
  const [category, setCategory] = useState<TimelineCategory>("work");

  const QUICK_ACTIVITIES = [
    { label: "Wake up", category: "other" as TimelineCategory, icon: "🌅" },
    { label: "Morning walk", category: "exercise" as TimelineCategory, icon: "🚶" },
    { label: "Breakfast", category: "meal" as TimelineCategory, icon: "🌅" },
    { label: "Study / Work", category: "study" as TimelineCategory, icon: "📖" },
    { label: "Lunch", category: "meal" as TimelineCategory, icon: "☀️" },
    { label: "Gym", category: "exercise" as TimelineCategory, icon: "💪" },
    { label: "Dinner", category: "meal" as TimelineCategory, icon: "🌙" },
    { label: "Sleep", category: "sleep" as TimelineCategory, icon: "🛌" },
  ];

  const handleAdd = () => {
    if (!activity.trim()) return;
    addTimelineEntry({ date: TODAY, startTime, endTime, activity: activity.trim(), category });
    setActivity(""); setShowAdd(false);
  };

  const durationMins = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const d = (eh * 60 + em) - (sh * 60 + sm);
    return d < 0 ? 0 : d;
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={styles.habitsHeader}>
        <Text style={[styles.habitsTitle, { color: colors.foreground }]}>Today's Timeline</Text>
        <TouchableOpacity style={[styles.addHabitBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Feather name="plus" size={16} color="#000" />
          <Text style={[styles.addHabitBtnText, { color: "#000" }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.emptyIcon}>🕐</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No activities logged</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Track your full day — sleep, meals, work, exercise, everything.</Text>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>QUICK ADD</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIVITIES.map((q) => (
              <TouchableOpacity key={q.label} style={[styles.quickChip, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => { setActivity(q.label); setCategory(q.category); setShowAdd(true); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 14 }}>{q.icon}</Text>
                <Text style={[styles.quickChipText, { color: colors.foreground }]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.timelineContainer, { borderColor: colors.border }]}>
          {entries.map((e, i) => {
            const cat = TIMELINE_CATEGORIES.find((c) => c.key === e.category);
            const dur = durationMins(e.startTime, e.endTime);
            return (
              <View key={e.id} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <Text style={[styles.timelineTime, { color: colors.mutedForeground }]}>{e.startTime}</Text>
                  <View style={[styles.timelineDot, { backgroundColor: cat?.color ?? "#666" }]} />
                  {i < entries.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                </View>
                <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: cat?.color ?? "#666" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineActivity, { color: colors.foreground }]}>{e.activity}</Text>
                    <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>{cat?.label} · {e.startTime}–{e.endTime}{dur > 0 ? ` · ${dur}m` : ""}</Text>
                  </View>
                  <TouchableOpacity onPress={() => Alert.alert("Delete?", e.activity, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteTimelineEntry(e.id) }])} style={{ padding: 4 }} activeOpacity={0.7}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.metricOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Activity</Text>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ACTIVITY</Text>
            <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={activity} onChangeText={setActivity} placeholder="What were you doing?" placeholderTextColor={colors.mutedForeground} autoFocus />
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>START</Text>
                <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={startTime} onChangeText={setStartTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>END</Text>
                <TextInput style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]} value={endTime} onChangeText={setEndTime} placeholder="HH:MM" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {TIMELINE_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.key} style={[styles.catChip, { backgroundColor: category === c.key ? c.color + "30" : colors.muted, borderColor: category === c.key ? c.color : colors.border }]} onPress={() => setCategory(c.key)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                    <Text style={[styles.catChipText, { color: category === c.key ? c.color : colors.mutedForeground }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: activity.trim() ? colors.primary : colors.border }]} disabled={!activity.trim()} onPress={handleAdd}>
              <Text style={[styles.saveBtnText, { color: activity.trim() ? "#000" : colors.mutedForeground }]}>Add Activity</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const TABS: ModuleBottomNavItem<LifestyleTab>[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "habits", label: "Habits", icon: "check-circle" },
  { key: "meals", label: "Meals", icon: "coffee" },
  { key: "timeline", label: "Timeline", icon: "clock" },
];

export default function LifestyleScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<LifestyleTab>("dashboard");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={{ flex: 1 }}>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "habits" && <HabitsTab />}
        {activeTab === "meals" && <MealsTab />}
        {activeTab === "timeline" && <TimelineTab />}
      </View>
      <ModuleBottomNav items={TABS} activeKey={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabContent: { padding: 16, gap: 12, paddingBottom: 32 },

  scoreCard: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 16, gap: 16, alignItems: "center" },
  scoreLeft: { alignItems: "center" },
  scoreRight: { flex: 1, gap: 6 },
  scoreTodayLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  scoreStatus: { fontSize: 17, fontFamily: "Inter_700Bold" },
  scoreBreakdown: { fontSize: 13, fontFamily: "Inter_400Regular" },
  insightBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  insightBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  insightCard: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  insightText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 4 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "30.5%", borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  metricIcon: { fontSize: 22 },
  metricValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  metricUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  habitsCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  habitRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  habitRowIcon: { fontSize: 18 },
  habitRowName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  habitCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },

  breakdownCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownLabel: { width: 52, fontSize: 13, fontFamily: "Inter_500Medium" },
  breakdownBar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 4 },
  breakdownPts: { width: 40, fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },

  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center" },
  emptyCardText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  habitsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  habitsTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addHabitBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addHabitBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  emptyState: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, color: "#666" },

  quickAddBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  quickAddBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  quickChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  habitCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  habitIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  habitName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  habitStreak: { fontSize: 12, fontFamily: "Inter_400Regular" },
  habitToggle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  deleteHabitBtn: { padding: 6 },

  calSummary: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  calLeft: { alignItems: "center" },
  calBig: { fontSize: 36, fontFamily: "Inter_700Bold" },
  calLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  calRight: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mealTypeBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  mealTypeBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  mealCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  mealCardIcon: { fontSize: 24 },
  mealCardName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  mealCardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  mealCardCal: { fontSize: 15, fontFamily: "Inter_700Bold" },

  mealTypeRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  mealTypeBtn: { flex: 1, alignItems: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 8, gap: 2 },
  mealTypeBtnText: { fontSize: 10, fontFamily: "Inter_500Medium" },

  aiEstimateBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  aiEstimateBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  aiEstimateResult: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12, gap: 4 },
  aiEstimateNote: { fontSize: 11, fontFamily: "Inter_400Regular" },
  aiEstimateVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  aiEstimateDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },

  timelineContainer: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timelineLeft: { alignItems: "center", width: 50 },
  timelineTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, minHeight: 30, marginVertical: 2 },
  timelineCard: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, padding: 12, marginBottom: 10, gap: 8 },
  timelineActivity: { fontSize: 14, fontFamily: "Inter_500Medium" },
  timelineMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  timeRow: { flexDirection: "row", gap: 12, marginBottom: 0 },

  catChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  catChipText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  metricOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  metricModal: { borderRadius: 20, margin: 20, padding: 24, borderWidth: 1 },
  metricModalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 20, textAlign: "center" },
  metricStepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 24 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 32, fontFamily: "Inter_700Bold", minWidth: 80, textAlign: "center" },

  bottomSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 24, paddingBottom: 40, gap: 12 },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },

  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  textInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },

  iconRow: { flexDirection: "row", gap: 8 },
  iconPick: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorPick: { width: 32, height: 32, borderRadius: 16 },
});
