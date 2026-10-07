import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  user: any | null;
  token: string | null;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (token, user) => {
    await SecureStore.setItemAsync("z_token", token);
    set({ token, user });
  },
  logout: async () => {
    try { const { authApi } = await import("../lib/api"); await authApi.logout(); } catch {}
    await SecureStore.deleteItemAsync("z_token");
    set({ token: null, user: null });
  },
  fetchMe: async () => {
    const token = await SecureStore.getItemAsync("z_token");
    if (!token) return;
    try {
      const { authApi } = await import("../lib/api");
      const user = await authApi.me();
      set({ token, user });
    } catch {
      await SecureStore.deleteItemAsync("z_token");
      set({ user: null, token: null });
    }
  },
}));

interface CartState {
  count: number;
  setCount: (n: number) => void;
  increment: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
  increment: () => set((s) => ({ count: s.count + 1 })),
}));
