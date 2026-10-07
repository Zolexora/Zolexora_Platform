import { create } from "zustand";

interface AuthState {
  user: any | null;
  login: (user: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: async (user) => {
    set({ user });
  },
  logout: async () => {
    try {
      const { authApi } = await import("../lib/api");
      await authApi.logout();
    } catch {}
    set({ user: null });
  },
}));
