import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseAuthConfig } from "./types";

type CookieAdapter = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]): void;
};

export function createSupabaseBrowserAuthClient(config: SupabaseAuthConfig) {
  return createBrowserClient(config.url, config.publishableKey);
}

export function createSupabaseServerAuthClient(config: SupabaseAuthConfig, cookies: CookieAdapter) {
  return createServerClient(config.url, config.publishableKey, { cookies });
}
