import { create } from "zustand";

/** Marketplace profile of the signed-in seller (GET /users/me); the session is the auth service's. */
interface AuthState {
  user: any | null;
  login: (user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
