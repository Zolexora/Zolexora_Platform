import { create } from "zustand";
import { signOut } from "@zolexora/shop-mobile-sign-in";

/** Marketplace profile of the signed-in seller (GET /users/me); the session is the auth service's. */
interface AuthState {
  user: any | null;
  login: (user: any) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: async () => {
    await signOut();
    set({ user: null });
  },
}));
