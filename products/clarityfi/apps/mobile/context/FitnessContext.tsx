import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@clarityfi_fitness_v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitnessGoal = "fat_loss" | "muscle_gain" | "maintenance" | "general_fitness" | "strength";
export type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutLocation = "gym" | "home" | "outdoor" | "mixed";
export type Equipment = "dumbbells" | "barbell" | "machines" | "resistance_bands" | "bodyweight" | "treadmill" | "cycle" | "other";
export type WorkoutType = "strength" | "cardio" | "running" | "walking" | "cycling" | "yoga" | "hiit" | "sports" | "home" | "other";
export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body" | "cardio";
export type WorkoutDifficulty = "easy" | "medium" | "hard";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Mood = "great" | "good" | "okay" | "bad" | "terrible";

export interface UserProfile {
  name: string;
  age: number;
  gender: "male" | "female" | "other" | "";
  heightCm: number;
  currentWeight: number;
  targetWeight: number;
  currentBodyFat: number;
  targetBodyFat: number;
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  experienceLevel: ExperienceLevel;
  workoutDaysPerWeek: number;
  workoutLocation: WorkoutLocation;
  equipment: Equipment[];
}

export interface BodyEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercent: number;
  bmi: number;
  waistCm: number;
  chestCm: number;
  armCm: number;
  hipCm: number;
  thighCm: number;
  neckCm: number;
  muscleMass: number;
  visceralFat: number;
  waterPercent: number;
  mood: Mood;
  energyLevel: number;
  stressLevel: number;
  notes: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
  distanceKm: number;
  durationMinutes: number;
  notes: string;
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  type: WorkoutType;
  durationMinutes: number;
  caloriesBurned: number;
  difficulty: WorkoutDifficulty;
  muscleGroup: MuscleGroup;
  notes: string;
  exercises: Exercise[];
}

export interface MealItem {
  id: string;
  mealType: MealType;
  foodName: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionEntry {
  id: string;
  date: string;
  calorieTarget: number;
  caloriesConsumed: number;
  proteinTarget: number;
  proteinConsumed: number;
  carbsTarget: number;
  carbsConsumed: number;
  fatTarget: number;
  fatConsumed: number;
  waterTargetMl: number;
  waterConsumedMl: number;
  notes: string;
  meals: MealItem[];
}

export interface FitnessHabit {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  isCompleted: boolean;
}

export interface SleepEntry {
  id: string;
  date: string;
  sleepHours: number;
  sleepQuality: number;
  energyLevel: number;
  sorenessLevel: number;
  stressLevel: number;
  mood: Mood;
  restingHeartRate: number;
  recoveryScore: number;
  notes: string;
}

interface FitnessData {
  profile: UserProfile | null;
  bodyEntries: BodyEntry[];
  workouts: Workout[];
  nutritionEntries: NutritionEntry[];
  habits: FitnessHabit[];
  habitLogs: HabitLog[];
  sleepEntries: SleepEntry[];
}

interface FitnessContextType {
  profile: UserProfile | null;
  bodyEntries: BodyEntry[];
  workouts: Workout[];
  nutritionEntries: NutritionEntry[];
  habits: FitnessHabit[];
  habitLogs: HabitLog[];
  sleepEntries: SleepEntry[];
  saveProfile: (p: UserProfile) => Promise<void>;
  addBodyEntry: (e: Omit<BodyEntry, "id" | "bmi">) => Promise<void>;
  updateBodyEntry: (e: BodyEntry) => Promise<void>;
  deleteBodyEntry: (id: string) => Promise<void>;
  addWorkout: (w: Omit<Workout, "id">) => Promise<void>;
  updateWorkout: (w: Workout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  saveNutritionEntry: (e: Omit<NutritionEntry, "id">) => Promise<void>;
  updateNutritionEntry: (e: NutritionEntry) => Promise<void>;
  addHabit: (name: string, icon: string) => Promise<void>;
  toggleHabitActive: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleHabitLog: (habitId: string, date: string) => Promise<void>;
  addSleepEntry: (e: Omit<SleepEntry, "id" | "recoveryScore">) => Promise<void>;
  updateSleepEntry: (e: SleepEntry) => Promise<void>;
  deleteSleepEntry: (id: string) => Promise<void>;
  computeBMI: (weightKg: number, heightCm: number) => number;
  getBMICategory: (bmi: number) => string;
  computeRecoveryScore: (e: Omit<SleepEntry, "id" | "recoveryScore" | "date" | "mood" | "restingHeartRate" | "notes">) => number;
  computeFitnessScore: () => { workout: number; body: number; nutrition: number; recovery: number; habit: number; total: number; category: string };
  getTodayNutrition: () => NutritionEntry | null;
  getTodaySleep: () => SleepEntry | null;
  getTodayBodyEntry: () => BodyEntry | null;
  getWorkoutStreak: () => number;
  getHabitStreak: (habitId: string) => number;
  getWeeklyWorkoutCount: () => number;
  isLoaded: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: 25,
  gender: "",
  heightCm: 170,
  currentWeight: 70,
  targetWeight: 65,
  currentBodyFat: 20,
  targetBodyFat: 15,
  goal: "general_fitness",
  activityLevel: "moderately_active",
  experienceLevel: "beginner",
  workoutDaysPerWeek: 4,
  workoutLocation: "gym",
  equipment: ["dumbbells"],
};

const DEFAULT_HABITS: FitnessHabit[] = [
  { id: "h1", name: "Workout done", icon: "💪", isActive: true, createdAt: new Date().toISOString() },
  { id: "h2", name: "10,000 steps", icon: "🚶", isActive: true, createdAt: new Date().toISOString() },
  { id: "h3", name: "3L water", icon: "💧", isActive: true, createdAt: new Date().toISOString() },
  { id: "h4", name: "Protein complete", icon: "🥩", isActive: true, createdAt: new Date().toISOString() },
  { id: "h5", name: "No sugar", icon: "🚫", isActive: true, createdAt: new Date().toISOString() },
  { id: "h6", name: "Sleep by 11PM", icon: "🌙", isActive: true, createdAt: new Date().toISOString() },
  { id: "h7", name: "Morning walk", icon: "🌅", isActive: true, createdAt: new Date().toISOString() },
  { id: "h8", name: "Meditation", icon: "🧘", isActive: true, createdAt: new Date().toISOString() },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function dateStr(d = new Date()) {
  return d.toISOString().split("T")[0];
}

// ─── Context ─────────────────────────────────────────────────────────────────

const FitnessContext = createContext<FitnessContextType | null>(null);

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used inside FitnessProvider");
  return ctx;
}

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FitnessData>({
    profile: null,
    bodyEntries: [],
    workouts: [],
    nutritionEntries: [],
    habits: DEFAULT_HABITS,
    habitLogs: [],
    sleepEntries: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: FitnessData = JSON.parse(raw);
          setData({ ...parsed, habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS });
        } catch {}
      }
      setIsLoaded(true);
    });
  }, []);

  const persist = useCallback(async (next: FitnessData) => {
    setData(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // ── Calculators ────────────────────────────────────────────────────────────

  const computeBMI = useCallback((weightKg: number, heightCm: number) => {
    if (!heightCm) return 0;
    return parseFloat((weightKg / ((heightCm / 100) ** 2)).toFixed(1));
  }, []);

  const getBMICategory = useCallback((bmi: number) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";
    return "Obese";
  }, []);

  const computeRecoveryScore = useCallback((
    e: Pick<SleepEntry, "sleepHours" | "sleepQuality" | "energyLevel" | "sorenessLevel" | "stressLevel">
  ) => {
    const sleepScore = Math.min((e.sleepHours / 8) * 100, 100);
    const qualityScore = (e.sleepQuality / 10) * 100;
    const energyScore = (e.energyLevel / 10) * 100;
    const sorenessScore = ((10 - e.sorenessLevel) / 10) * 100;
    const stressScore = ((10 - e.stressLevel) / 10) * 100;
    return Math.round((sleepScore * 0.3 + qualityScore * 0.2 + energyScore * 0.2 + sorenessScore * 0.15 + stressScore * 0.15));
  }, []);

  const computeFitnessScore = useCallback(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - i); return dateStr(d);
    });
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - i); return dateStr(d);
    });

    const workoutsLast7 = data.workouts.filter(w => last7.includes(w.date)).length;
    const workoutTarget = (data.profile?.workoutDaysPerWeek ?? 4);
    const workoutScore = Math.min(Math.round((workoutsLast7 / workoutTarget) * 100), 100);

    const bodyEntriesLast30 = data.bodyEntries.filter(e => last30.includes(e.date)).length;
    const bodyScore = Math.min(Math.round((bodyEntriesLast30 / 20) * 100), 100);

    const nutritionLast7 = data.nutritionEntries.filter(e => last7.includes(e.date));
    const nutritionScore = nutritionLast7.length
      ? Math.round(nutritionLast7.reduce((s, e) => s + (e.calorieTarget ? Math.min(e.caloriesConsumed / e.calorieTarget, 1) : 0.5), 0) / nutritionLast7.length * 100)
      : 50;

    const sleepLast7 = data.sleepEntries.filter(e => last7.includes(e.date));
    const recoveryScore = sleepLast7.length
      ? Math.round(sleepLast7.reduce((s, e) => s + e.recoveryScore, 0) / sleepLast7.length)
      : 50;

    const activeHabits = data.habits.filter(h => h.isActive);
    const habitLogs7 = data.habitLogs.filter(l => last7.includes(l.date) && l.isCompleted);
    const maxHabitLogs = activeHabits.length * 7;
    const habitScore = maxHabitLogs > 0 ? Math.min(Math.round((habitLogs7.length / maxHabitLogs) * 100), 100) : 50;

    const total = Math.round(workoutScore * 0.3 + bodyScore * 0.2 + nutritionScore * 0.2 + recoveryScore * 0.15 + habitScore * 0.15);
    let category = "Poor";
    if (total >= 90) category = "Excellent";
    else if (total >= 75) category = "Good";
    else if (total >= 60) category = "Average";
    else if (total >= 40) category = "Needs Improvement";
    return { workout: workoutScore, body: bodyScore, nutrition: nutritionScore, recovery: recoveryScore, habit: habitScore, total, category };
  }, [data]);

  const getTodayNutrition = useCallback(() => {
    return data.nutritionEntries.find(e => e.date === dateStr()) ?? null;
  }, [data.nutritionEntries]);

  const getTodaySleep = useCallback(() => {
    return data.sleepEntries.find(e => e.date === dateStr()) ?? null;
  }, [data.sleepEntries]);

  const getTodayBodyEntry = useCallback(() => {
    return data.bodyEntries.find(e => e.date === dateStr()) ?? null;
  }, [data.bodyEntries]);

  const getWorkoutStreak = useCallback(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (data.workouts.some(w => w.date === dateStr(d))) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [data.workouts]);

  const getHabitStreak = useCallback((habitId: string) => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (data.habitLogs.some(l => l.habitId === habitId && l.date === dateStr(d) && l.isCompleted)) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [data.habitLogs]);

  const getWeeklyWorkoutCount = useCallback(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - i); return dateStr(d);
    });
    return data.workouts.filter(w => last7.includes(w.date)).length;
  }, [data.workouts]);

  // ── Profile ────────────────────────────────────────────────────────────────

  const saveProfile = useCallback(async (p: UserProfile) => {
    await persist({ ...data, profile: p });
  }, [data, persist]);

  // ── Body ───────────────────────────────────────────────────────────────────

  const addBodyEntry = useCallback(async (e: Omit<BodyEntry, "id" | "bmi">) => {
    const bmi = computeBMI(e.weightKg, data.profile?.heightCm ?? 170);
    const entry: BodyEntry = { ...e, id: uid(), bmi };
    const filtered = data.bodyEntries.filter(b => b.date !== e.date);
    await persist({ ...data, bodyEntries: [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date)) });
  }, [data, persist, computeBMI]);

  const updateBodyEntry = useCallback(async (e: BodyEntry) => {
    await persist({ ...data, bodyEntries: data.bodyEntries.map(b => b.id === e.id ? e : b) });
  }, [data, persist]);

  const deleteBodyEntry = useCallback(async (id: string) => {
    await persist({ ...data, bodyEntries: data.bodyEntries.filter(b => b.id !== id) });
  }, [data, persist]);

  // ── Workout ────────────────────────────────────────────────────────────────

  const addWorkout = useCallback(async (w: Omit<Workout, "id">) => {
    const workout: Workout = { ...w, id: uid() };
    await persist({ ...data, workouts: [workout, ...data.workouts].sort((a, b) => b.date.localeCompare(a.date)) });
  }, [data, persist]);

  const updateWorkout = useCallback(async (w: Workout) => {
    await persist({ ...data, workouts: data.workouts.map(x => x.id === w.id ? w : x) });
  }, [data, persist]);

  const deleteWorkout = useCallback(async (id: string) => {
    await persist({ ...data, workouts: data.workouts.filter(w => w.id !== id) });
  }, [data, persist]);

  // ── Nutrition ──────────────────────────────────────────────────────────────

  const saveNutritionEntry = useCallback(async (e: Omit<NutritionEntry, "id">) => {
    const entry: NutritionEntry = { ...e, id: uid() };
    const filtered = data.nutritionEntries.filter(n => n.date !== e.date);
    await persist({ ...data, nutritionEntries: [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date)) });
  }, [data, persist]);

  const updateNutritionEntry = useCallback(async (e: NutritionEntry) => {
    await persist({ ...data, nutritionEntries: data.nutritionEntries.map(n => n.id === e.id ? e : n) });
  }, [data, persist]);

  // ── Habits ─────────────────────────────────────────────────────────────────

  const addHabit = useCallback(async (name: string, icon: string) => {
    const habit: FitnessHabit = { id: uid(), name, icon, isActive: true, createdAt: new Date().toISOString() };
    await persist({ ...data, habits: [...data.habits, habit] });
  }, [data, persist]);

  const toggleHabitActive = useCallback(async (id: string) => {
    await persist({ ...data, habits: data.habits.map(h => h.id === id ? { ...h, isActive: !h.isActive } : h) });
  }, [data, persist]);

  const deleteHabit = useCallback(async (id: string) => {
    await persist({ ...data, habits: data.habits.filter(h => h.id !== id), habitLogs: data.habitLogs.filter(l => l.habitId !== id) });
  }, [data, persist]);

  const toggleHabitLog = useCallback(async (habitId: string, date: string) => {
    const existing = data.habitLogs.find(l => l.habitId === habitId && l.date === date);
    let logs: HabitLog[];
    if (existing) {
      logs = data.habitLogs.map(l => l.id === existing.id ? { ...l, isCompleted: !l.isCompleted } : l);
    } else {
      logs = [...data.habitLogs, { id: uid(), habitId, date, isCompleted: true }];
    }
    await persist({ ...data, habitLogs: logs });
  }, [data, persist]);

  // ── Sleep ──────────────────────────────────────────────────────────────────

  const addSleepEntry = useCallback(async (e: Omit<SleepEntry, "id" | "recoveryScore">) => {
    const recoveryScore = computeRecoveryScore(e);
    const entry: SleepEntry = { ...e, id: uid(), recoveryScore };
    const filtered = data.sleepEntries.filter(s => s.date !== e.date);
    await persist({ ...data, sleepEntries: [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date)) });
  }, [data, persist, computeRecoveryScore]);

  const updateSleepEntry = useCallback(async (e: SleepEntry) => {
    await persist({ ...data, sleepEntries: data.sleepEntries.map(s => s.id === e.id ? e : s) });
  }, [data, persist]);

  const deleteSleepEntry = useCallback(async (id: string) => {
    await persist({ ...data, sleepEntries: data.sleepEntries.filter(s => s.id !== id) });
  }, [data, persist]);

  return (
    <FitnessContext.Provider value={{
      ...data,
      isLoaded,
      saveProfile,
      addBodyEntry, updateBodyEntry, deleteBodyEntry,
      addWorkout, updateWorkout, deleteWorkout,
      saveNutritionEntry, updateNutritionEntry,
      addHabit, toggleHabitActive, deleteHabit, toggleHabitLog,
      addSleepEntry, updateSleepEntry, deleteSleepEntry,
      computeBMI, getBMICategory, computeRecoveryScore, computeFitnessScore,
      getTodayNutrition, getTodaySleep, getTodayBodyEntry,
      getWorkoutStreak, getHabitStreak, getWeeklyWorkoutCount,
    }}>
      {children}
    </FitnessContext.Provider>
  );
}
