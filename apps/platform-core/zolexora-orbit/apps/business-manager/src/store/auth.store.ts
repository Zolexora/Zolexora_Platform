/**
 * Auth store for the Business Manager.
 * Uses @zolexora/auth-client/business-session for token management.
 * The business session is opened via the Auth Service's existing employee login flow.
 */
import { create } from "zustand";
import {
  BUSINESS_SESSION_STORAGE_KEY,
  BUSINESS_SESSION_EXPIRED_EVENT,
  type BusinessSession,
} from "@zolexora/auth-client/business-session";

interface AuthState {
  session: BusinessSession | null;
  isLoading: boolean;
  hydrate: () => void;
  setSession: (session: BusinessSession | null) => void;
  clearSession: () => void;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isLoading: true,

  hydrate() {
    try {
      const raw = localStorage.getItem(BUSINESS_SESSION_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw) as BusinessSession;
        // Discard expired sessions
        if (session.expires_at > Date.now()) {
          set({ session, isLoading: false });
          return;
        }
      }
    } catch {}
    set({ session: null, isLoading: false });
  },

  setSession(session) {
    if (session) {
      localStorage.setItem(BUSINESS_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(BUSINESS_SESSION_STORAGE_KEY);
    }
    set({ session });
  },

  clearSession() {
    localStorage.removeItem(BUSINESS_SESSION_STORAGE_KEY);
    set({ session: null });
    window.dispatchEvent(new Event(BUSINESS_SESSION_EXPIRED_EVENT));
  },

  getAccessToken() {
    const { session } = get();
    if (!session) return null;
    if (session.expires_at <= Date.now()) {
      get().clearSession();
      return null;
    }
    return session.access_token;
  },
}));
