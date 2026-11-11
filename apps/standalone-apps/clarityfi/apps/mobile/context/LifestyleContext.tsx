import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@clarityfi_lifestyle_v1";

export type HabitFrequency = "daily" | "weekly";

export type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  completedDates: string[];
  createdAt: string;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Meal = {
  id: string;
  date: string;
  time: string;
  name: string;
  mealType: MealType;
  calories: number;
  notes?: string;
};

export type TimelineCategory = "sleep" | "exercise" | "meal" | "work" | "study" | "leisure" | "social" | "self-care" | "other";

export type TimelineEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  category: TimelineCategory;
};

export type DailyMetrics = {
  date: string;
  sleep: number;
  sleepQuality: number;
  water: number;
  steps: number;
  stress: number;
  mood: number;
  focusTime: number;
};

type LifestyleData = {
  habits: Habit[];
  meals: Meal[];
  timeline: TimelineEntry[];
  metrics: DailyMetrics[];
};

type LifestyleContextType = {
  habits: Habit[];
  meals: Meal[];
  timeline: TimelineEntry[];
  metrics: DailyMetrics[];
  todayMetrics: DailyMetrics;
  todayScore: number;
  addHabit: (h: Omit<Habit, "id" | "completedDates" | "createdAt">) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (id: string, date: string) => void;
  addMeal: (m: Omit<Meal, "id">) => void;
  deleteMeal: (id: string) => void;
  addTimelineEntry: (e: Omit<TimelineEntry, "id">) => void;
  deleteTimelineEntry: (id: string) => void;
  updateMetrics: (date: string, partial: Partial<Omit<DailyMetrics, "date">>) => void;
  getMealsForDate: (date: string) => Meal[];
  getTimelineForDate: (date: string) => TimelineEntry[];
  getHabitStreak: (habit: Habit) => number;
};

const todayStr = () => new Date().toISOString().split("T")[0];

const defaultMetrics = (date: string): DailyMetrics => ({
  date,
  sleep: 0,
  sleepQuality: 3,
  water: 0,
  steps: 0,
  stress: 2,
  mood: 3,
  focusTime: 0,
});

function calcScore(m: DailyMetrics, habits: Habit[], meals: Meal[]): number {
  const today = m.date;
  const sleepScore = Math.min(20, (m.sleep / 8) * 20);
  const waterScore = Math.min(10, (m.water / 8) * 10);
  const stepsScore = Math.min(15, (m.steps / 10000) * 15);
  const todayMeals = meals.filter((ml) => ml.date === today);
  const mealScore = Math.min(15, (Math.min(todayMeals.length, 3) / 3) * 15);
  const todayHabits = habits.filter((h) => h.completedDates.includes(today));
  const habitScore = habits.length > 0 ? Math.min(15, (todayHabits.length / habits.length) * 15) : 0;
  const focusScore = Math.min(15, (m.focusTime / 480) * 15);
  const stressScore = Math.min(10, ((5 - m.stress + 1) / 5) * 10);
  return Math.round(sleepScore + waterScore + stepsScore + mealScore + habitScore + focusScore + stressScore);
}

function getStreak(habit: Habit): number {
  if (habit.completedDates.length === 0) return 0;
  const sorted = [...habit.completedDates].sort().reverse();
  let streak = 0;
  const today = new Date();
  let check = new Date(today);
  for (let i = 0; i < 365; i++) {
    const ds = check.toISOString().split("T")[0];
    if (sorted.includes(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

const LifestyleContext = createContext<LifestyleContextType>({} as LifestyleContextType);

export function LifestyleProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LifestyleData>({ habits: [], meals: [], timeline: [], metrics: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) {
        try { setData(JSON.parse(v)); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const save = useCallback((d: LifestyleData) => {
    setData(d);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }, []);

  const today = todayStr();
  const todayMetrics = data.metrics.find((m) => m.date === today) ?? defaultMetrics(today);
  const todayScore = calcScore(todayMetrics, data.habits, data.meals);

  const addHabit = useCallback((h: Omit<Habit, "id" | "completedDates" | "createdAt">) => {
    setData((prev) => {
      const next = { ...prev, habits: [...prev.habits, { ...h, id: Date.now().toString(), completedDates: [], createdAt: new Date().toISOString() }] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, habits: prev.habits.filter((h) => h.id !== id) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleHabit = useCallback((id: string, date: string) => {
    setData((prev) => {
      const next = {
        ...prev,
        habits: prev.habits.map((h) =>
          h.id !== id ? h : {
            ...h,
            completedDates: h.completedDates.includes(date)
              ? h.completedDates.filter((d) => d !== date)
              : [...h.completedDates, date],
          }
        ),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addMeal = useCallback((m: Omit<Meal, "id">) => {
    setData((prev) => {
      const next = { ...prev, meals: [...prev.meals, { ...m, id: Date.now().toString() }] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteMeal = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, meals: prev.meals.filter((m) => m.id !== id) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addTimelineEntry = useCallback((e: Omit<TimelineEntry, "id">) => {
    setData((prev) => {
      const next = { ...prev, timeline: [...prev.timeline, { ...e, id: Date.now().toString() }] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteTimelineEntry = useCallback((id: string) => {
    setData((prev) => {
      const next = { ...prev, timeline: prev.timeline.filter((e) => e.id !== id) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateMetrics = useCallback((date: string, partial: Partial<Omit<DailyMetrics, "date">>) => {
    setData((prev) => {
      const existing = prev.metrics.find((m) => m.date === date) ?? defaultMetrics(date);
      const updated = { ...existing, ...partial };
      const next = { ...prev, metrics: [...prev.metrics.filter((m) => m.date !== date), updated] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getMealsForDate = useCallback((date: string) => data.meals.filter((m) => m.date === date), [data.meals]);
  const getTimelineForDate = useCallback((date: string) => data.timeline.filter((e) => e.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)), [data.timeline]);
  const getHabitStreak = useCallback((habit: Habit) => getStreak(habit), []);

  if (!loaded) return null;

  return (
    <LifestyleContext.Provider value={{
      habits: data.habits, meals: data.meals, timeline: data.timeline, metrics: data.metrics,
      todayMetrics, todayScore,
      addHabit, deleteHabit, toggleHabit,
      addMeal, deleteMeal,
      addTimelineEntry, deleteTimelineEntry,
      updateMetrics,
      getMealsForDate, getTimelineForDate, getHabitStreak,
    }}>
      {children}
    </LifestyleContext.Provider>
  );
}

export function useLifestyle() {
  return useContext(LifestyleContext);
}
