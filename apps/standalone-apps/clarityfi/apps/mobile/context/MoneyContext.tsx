import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  account: string;
}

export interface Account {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
  isDefault?: boolean;
}

export interface Budget {
  categoryName: string;
  month: string;
  limit: number;
}

export interface AppSettings {
  viewMode: "daily" | "weekly" | "monthly";
  showTotal: boolean;
  carryOver: boolean;
}

export type SyncStatus = "idle" | "syncing" | "ok" | "error";

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "cash", name: "Cash", emoji: "💵", color: "#71BB7B" },
  { id: "card", name: "Card", emoji: "💳", color: "#5B8DD9" },
  { id: "savings", name: "Savings", emoji: "🐷", color: "#D46B6B" },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: "awards", name: "Awards", type: "income", icon: "award", color: "#C9A840", isDefault: true },
  { id: "coupons", name: "Coupons", type: "income", icon: "tag", color: "#F97316", isDefault: true },
  { id: "grants", name: "Grants", type: "income", icon: "dollar-sign", color: "#5B8DD9", isDefault: true },
  { id: "lottery", name: "Lottery", type: "income", icon: "star", color: "#F59E0B", isDefault: true },
  { id: "refunds", name: "Refunds", type: "income", icon: "refresh-ccw", color: "#06B6D4", isDefault: true },
  { id: "rental", name: "Rental", type: "income", icon: "home", color: "#8B5CF6", isDefault: true },
  { id: "salary", name: "Salary", type: "income", icon: "briefcase", color: "#71BB7B", isDefault: true },
  { id: "sale", name: "Sale", type: "income", icon: "percent", color: "#D46B6B", isDefault: true },
];

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: "baby", name: "Baby", type: "expense", icon: "heart", color: "#EC4899", isDefault: true },
  { id: "beauty", name: "Beauty", type: "expense", icon: "scissors", color: "#D946EF", isDefault: true },
  { id: "bills", name: "Bills", type: "expense", icon: "file-text", color: "#F97316", isDefault: true },
  { id: "car", name: "Car", type: "expense", icon: "truck", color: "#3B82F6", isDefault: true },
  { id: "clothing", name: "Clothing", type: "expense", icon: "shopping-bag", color: "#8B5CF6", isDefault: true },
  { id: "emi_interest", name: "EMI Interest", type: "expense", icon: "credit-card", color: "#D46B6B", isDefault: true },
  { id: "education", name: "Education", type: "expense", icon: "book", color: "#F59E0B", isDefault: true },
  { id: "electronics", name: "Electronics", type: "expense", icon: "smartphone", color: "#0EA5E9", isDefault: true },
  { id: "entertainment", name: "Entertainment", type: "expense", icon: "film", color: "#7C3AED", isDefault: true },
  { id: "food", name: "Food", type: "expense", icon: "coffee", color: "#F97316", isDefault: true },
  { id: "health", name: "Health", type: "expense", icon: "activity", color: "#EF4444", isDefault: true },
  { id: "home", name: "Home", type: "expense", icon: "home", color: "#14B8A6", isDefault: true },
  { id: "insurance", name: "Insurance", type: "expense", icon: "shield", color: "#3B82F6", isDefault: true },
  { id: "other", name: "Other", type: "expense", icon: "grid", color: "#78716C", isDefault: true },
  { id: "shopping", name: "Shopping", type: "expense", icon: "shopping-cart", color: "#EC4899", isDefault: true },
  { id: "social", name: "Social", type: "expense", icon: "users", color: "#71BB7B", isDefault: true },
  { id: "sport", name: "Sport", type: "expense", icon: "target", color: "#F97316", isDefault: true },
  { id: "tax", name: "Tax", type: "expense", icon: "file-minus", color: "#78716C", isDefault: true },
  { id: "telephone", name: "Telephone", type: "expense", icon: "phone", color: "#3B82F6", isDefault: true },
  { id: "transportation", name: "Transportation", type: "expense", icon: "navigation", color: "#3B82F6", isDefault: true },
];

interface MoneyContextType {
  transactions: Transaction[];
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  budgets: Budget[];
  settings: AppSettings;
  isLoading: boolean;
  syncStatus: SyncStatus;

  addTransaction: (t: Omit<Transaction, "id">) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
  deleteAll: () => Promise<void>;
  resetAll: () => Promise<void>;

  addAccount: (a: Omit<Account, "id">) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addCategory: (c: Omit<Category, "id">) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  setBudget: (categoryName: string, month: string, limit: number) => Promise<void>;
  removeBudget: (categoryName: string, month: string) => Promise<void>;
  copyBudgetsFromLastMonth: (month: string) => Promise<void>;

  updateSettings: (s: Partial<AppSettings>) => Promise<void>;

  syncToSheets: (urlOverride?: string) => Promise<void>;
  getAccountBalance: (accountId: string) => number;
  getMonthData: (year: number, month: number) => { income: number; expense: number; balance: number };
}

const MoneyContext = createContext<MoneyContextType | null>(null);

const KEYS = {
  transactions: "@mm_transactions_v2",
  accounts: "@mm_accounts_v1",
  incomeCategories: "@mm_income_cats_v1",
  expenseCategories: "@mm_expense_cats_v1",
  budgets: "@mm_budgets_v1",
  settings: "@mm_settings_v1",
  sheetsUrl: "@sheets_url_v1",
};

async function pushToSheets(txns: Transaction[], url: string, setStatus: (s: SyncStatus) => void) {
  setStatus("syncing");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: txns }),
    });
    const json = await res.json();
    setStatus(json.success ? "ok" : "error");
  } catch {
    setStatus("error");
  }
}

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(DEFAULT_INCOME_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    viewMode: "monthly",
    showTotal: true,
    carryOver: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  useEffect(() => {
    (async () => {
      try {
        const [txRaw, accRaw, incRaw, expRaw, budRaw, setRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.transactions),
          AsyncStorage.getItem(KEYS.accounts),
          AsyncStorage.getItem(KEYS.incomeCategories),
          AsyncStorage.getItem(KEYS.expenseCategories),
          AsyncStorage.getItem(KEYS.budgets),
          AsyncStorage.getItem(KEYS.settings),
        ]);
        if (txRaw) setTransactions(JSON.parse(txRaw));
        if (accRaw) setAccounts(JSON.parse(accRaw));
        if (incRaw) setIncomeCategories(JSON.parse(incRaw));
        if (expRaw) setExpenseCategories(JSON.parse(expRaw));
        if (budRaw) setBudgets(JSON.parse(budRaw));
        if (setRaw) setSettings(JSON.parse(setRaw));
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const saveTxns = useCallback(async (txns: Transaction[]) => {
    await AsyncStorage.setItem(KEYS.transactions, JSON.stringify(txns));
    setTransactions(txns);
    const url = await AsyncStorage.getItem(KEYS.sheetsUrl);
    if (url) pushToSheets(txns, url, setSyncStatus);
  }, []);

  const addTransaction = useCallback(async (t: Omit<Transaction, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const updated = [{ ...t, id }, ...transactions];
    await saveTxns(updated);
  }, [transactions, saveTxns]);

  const deleteTransaction = useCallback(async (id: string) => {
    await saveTxns(transactions.filter((t) => t.id !== id));
  }, [transactions, saveTxns]);

  const clearTransactions = useCallback(async () => { await saveTxns([]); }, [saveTxns]);

  const deleteAll = useCallback(async () => {
    await saveTxns([]);
    const newBudgets: Budget[] = [];
    await AsyncStorage.setItem(KEYS.budgets, JSON.stringify(newBudgets));
    setBudgets(newBudgets);
  }, [saveTxns]);

  const resetAll = useCallback(async () => {
    await saveTxns([]);
    await AsyncStorage.setItem(KEYS.accounts, JSON.stringify(DEFAULT_ACCOUNTS));
    await AsyncStorage.setItem(KEYS.incomeCategories, JSON.stringify(DEFAULT_INCOME_CATEGORIES));
    await AsyncStorage.setItem(KEYS.expenseCategories, JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
    await AsyncStorage.setItem(KEYS.budgets, JSON.stringify([]));
    setAccounts(DEFAULT_ACCOUNTS);
    setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
    setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
    setBudgets([]);
  }, [saveTxns]);

  const addAccount = useCallback(async (a: Omit<Account, "id">) => {
    const id = Date.now().toString();
    const updated = [...accounts, { ...a, id }];
    await AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updated));
    setAccounts(updated);
  }, [accounts]);

  const deleteAccount = useCallback(async (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    await AsyncStorage.setItem(KEYS.accounts, JSON.stringify(updated));
    setAccounts(updated);
  }, [accounts]);

  const addCategory = useCallback(async (c: Omit<Category, "id">) => {
    const id = Date.now().toString();
    const cat = { ...c, id };
    if (c.type === "income") {
      const updated = [...incomeCategories, cat];
      await AsyncStorage.setItem(KEYS.incomeCategories, JSON.stringify(updated));
      setIncomeCategories(updated);
    } else {
      const updated = [...expenseCategories, cat];
      await AsyncStorage.setItem(KEYS.expenseCategories, JSON.stringify(updated));
      setExpenseCategories(updated);
    }
  }, [incomeCategories, expenseCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    const incUpdated = incomeCategories.filter((c) => c.id !== id);
    const expUpdated = expenseCategories.filter((c) => c.id !== id);
    await AsyncStorage.setItem(KEYS.incomeCategories, JSON.stringify(incUpdated));
    await AsyncStorage.setItem(KEYS.expenseCategories, JSON.stringify(expUpdated));
    setIncomeCategories(incUpdated);
    setExpenseCategories(expUpdated);
  }, [incomeCategories, expenseCategories]);

  const setBudget = useCallback(async (categoryName: string, month: string, limit: number) => {
    const filtered = budgets.filter((b) => !(b.categoryName === categoryName && b.month === month));
    const updated = [...filtered, { categoryName, month, limit }];
    await AsyncStorage.setItem(KEYS.budgets, JSON.stringify(updated));
    setBudgets(updated);
  }, [budgets]);

  const removeBudget = useCallback(async (categoryName: string, month: string) => {
    const updated = budgets.filter((b) => !(b.categoryName === categoryName && b.month === month));
    await AsyncStorage.setItem(KEYS.budgets, JSON.stringify(updated));
    setBudgets(updated);
  }, [budgets]);

  const copyBudgetsFromLastMonth = useCallback(async (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevBudgets = budgets.filter((b) => b.month === prevMonth);
    const currentFiltered = budgets.filter((b) => b.month !== month);
    const newBudgets = [
      ...currentFiltered,
      ...prevBudgets.map((b) => ({ ...b, month })),
    ];
    await AsyncStorage.setItem(KEYS.budgets, JSON.stringify(newBudgets));
    setBudgets(newBudgets);
  }, [budgets]);

  const updateSettings = useCallback(async (s: Partial<AppSettings>) => {
    const updated = { ...settings, ...s };
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(updated));
    setSettings(updated);
  }, [settings]);

  const syncToSheets = useCallback(async (urlOverride?: string) => {
    const url = urlOverride ?? (await AsyncStorage.getItem(KEYS.sheetsUrl));
    if (!url) return;
    await pushToSheets(transactions, url, setSyncStatus);
  }, [transactions]);

  const getAccountBalance = useCallback((accountId: string): number => {
    return transactions
      .filter((t) => t.account === accountId)
      .reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum - t.amount), 0);
  }, [transactions]);

  const getMonthData = useCallback((year: number, month: number) => {
    const monthTxns = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const income = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    let carryOver = 0;
    if (settings.carryOver) {
      const firstDay = new Date(year, month, 1);
      carryOver = transactions
        .filter((t) => new Date(t.date) < firstDay)
        .reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum - t.amount), 0);
    }
    return { income, expense, balance: income - expense + carryOver };
  }, [transactions, settings.carryOver]);

  return (
    <MoneyContext.Provider
      value={{
        transactions, accounts, incomeCategories, expenseCategories,
        budgets, settings, isLoading, syncStatus,
        addTransaction, deleteTransaction, clearTransactions,
        deleteAll, resetAll,
        addAccount, deleteAccount,
        addCategory, deleteCategory,
        setBudget, removeBudget, copyBudgetsFromLastMonth,
        updateSettings, syncToSheets,
        getAccountBalance, getMonthData,
      }}
    >
      {children}
    </MoneyContext.Provider>
  );
}

export function useMoney() {
  const ctx = useContext(MoneyContext);
  if (!ctx) throw new Error("useMoney must be used within MoneyProvider");
  return ctx;
}
