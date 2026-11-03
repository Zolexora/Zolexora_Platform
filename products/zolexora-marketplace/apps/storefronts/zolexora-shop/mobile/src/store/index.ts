import { create } from "zustand";
import { sessionToken, signOut } from "@zolexora/marketplace-mobile-sign-in";

/** Marketplace profile of the Zolexora account whose session token is in SecureStore. */
interface AuthState {
  user: any | null;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  fetchMe: async () => {
    if (!(await sessionToken())) return set({ user: null });
    try {
      const { authApi } = await import("../lib/api");
      set({ user: await authApi.me() });
    } catch {
      set({ user: null });
    }
  },
  logout: async () => {
    await signOut();
    set({ user: null });
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
