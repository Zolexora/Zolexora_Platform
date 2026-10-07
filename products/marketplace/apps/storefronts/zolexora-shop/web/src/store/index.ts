import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, cartApi, type CartItem, type User } from "@/lib/api";

// ── Auth Store ────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: false,
      login: (user) => set({ user }),
      logout: () => {
        void authApi.logout().catch(() => {});
        set({ user: null });
        try {
          useCartStore.getState().clear();
        } catch {
          // ignore
        }
      },
      fetchMe: async () => {
        // A logged-out browser has no CSRF cookie, so there cannot be a valid
        // opaque session cookie either. Avoid an expected 401 request on every
        // public page load (the API still protects /auth/me for direct calls).
        if (typeof document !== "undefined" && !document.cookie.includes("z_csrf=")) {
          set({ user: null, loading: false });
          return;
        }
        set({ loading: true });
        try {
          const user = await authApi.me();
          set({ user });
        } catch {
          set({ user: null });
        } finally {
          set({ loading: false });
        }
      },
    }),
    { name: "z_auth", partialize: (s) => ({ user: s.user }) }
  )
);

// ── Cart Store ────────────────────────────────────────────────────────────────
interface CartState {
  items: CartItem[];
  count: number;
  loading: boolean;
  fetch: () => Promise<void>;
  addItem: (product_id: string, qty?: number) => Promise<void>;
  removeItem: (product_id: string) => Promise<void>;
  updateQty: (product_id: string, qty: number) => Promise<void>;
  clear: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  count: 0,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const res: unknown = await cartApi.get();
      if (Array.isArray(res)) {
        set({ items: res, count: res.length });
      } else if (res && typeof res === "object" && "lines" in res && Array.isArray((res as { lines: unknown[] }).lines)) {
        const payload = res as { lines: Array<{ product_id: string; product_title: string; image?: string; seller_id: string; seller_name: string; quantity: number; unit_price: { amount_minor: number; currency: string } | number }>; item_count?: number };
        const mappedItems: CartItem[] = payload.lines.map((l) => ({
          id: l.product_id,
          product_id: l.product_id,
          quantity: l.quantity,
          product: {
            id: l.product_id,
            title: l.product_title,
            price: typeof l.unit_price === "object" ? l.unit_price : { amount_minor: Number(l.unit_price || 0) * 100, currency: "INR" },
            images: l.image ? [l.image] : [],
            category: "General",
            description: "",
            seller_id: l.seller_id,
            seller_name: l.seller_name,
            stock: 999,
          } as unknown as CartItem["product"],
        }));
        set({ items: mappedItems, count: payload.item_count ?? mappedItems.length });
      } else {
        set({ items: [], count: 0 });
      }
    } catch {
      set({ items: [], count: 0 });
    } finally {
      set({ loading: false });
    }
  },
  addItem: async (product_id, qty = 1) => {
    await cartApi.add(product_id, qty);
    await get().fetch();
  },
  removeItem: async (product_id) => {
    await cartApi.remove(product_id);
    await get().fetch();
  },
  updateQty: async (product_id, qty) => {
    await cartApi.update(product_id, qty);
    await get().fetch();
  },
  clear: () => set({ items: [], count: 0 }),
}));
