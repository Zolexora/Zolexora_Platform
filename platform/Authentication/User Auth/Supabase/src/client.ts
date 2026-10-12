import { createClient } from "@supabase/supabase-js";
import type { SupabaseAuthConfig, SupabaseAuthOptions } from "./types";

export function createSupabaseAuthClient(
  config: SupabaseAuthConfig,
  options: SupabaseAuthOptions = {},
) {
  const url = config.url.trim();
  const key = config.publishableKey.trim();
  if (!url || !key) throw new Error("Supabase URL and publishable key are required.");

  return createClient(url, key, {
    auth: {
      autoRefreshToken: options.autoRefreshToken ?? true,
      persistSession: options.persistSession ?? true,
      detectSessionInUrl: options.detectSessionInUrl ?? true,
      ...(options.storage ? { storage: options.storage } : {}),
    },
  });
}
