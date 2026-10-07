import { vi } from "vitest";

const store: Record<string, string> = {};
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
  getItemAsync: vi.fn(async (key: string) => {
    return store[key] || null;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete store[key];
  }),
}));
