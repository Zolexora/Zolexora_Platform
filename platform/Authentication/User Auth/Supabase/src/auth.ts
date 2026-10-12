import type { Provider, SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseAuthUserData } from "./types";

export const supabaseAuth = {
  signInWithPassword: async (client: SupabaseClient, email: string, password: string) => {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    return data;
  },
  signUp: async (client: SupabaseClient, email: string, password: string, options: SupabaseAuthUserData = {}) => {
    const { data, error } = await client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: options.emailRedirectTo, data: options.metadata },
    });
    if (error) throw error;
    return data;
  },
  signInWithOAuth: async (client: SupabaseClient, provider: Provider, redirectTo?: string) => {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) throw error;
    return data;
  },
  signInWithOtp: async (client: SupabaseClient, email: string, emailRedirectTo?: string) => {
    const { data, error } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    if (error) throw error;
    return data;
  },
  signInWithPhoneOtp: async (client: SupabaseClient, phone: string) => {
    const { data, error } = await client.auth.signInWithOtp({ phone: phone.trim() });
    if (error) throw error;
    return data;
  },
  verifyOtp: async (client: SupabaseClient, params:
    | { email: string; token: string; type: "email" | "magiclink" | "recovery" | "signup" | "invite" | "email_change" }
    | { phone: string; token: string; type: "sms" | "phone_change" }) => {
    const { data, error } = await client.auth.verifyOtp(params);
    if (error) throw error;
    return data;
  },
  resetPasswordForEmail: async (client: SupabaseClient, email: string, redirectTo?: string) => {
    const { data, error } = await client.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw error;
    return data;
  },
  updatePassword: async (client: SupabaseClient, password: string) => {
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    return data;
  },
  getUser: async (client: SupabaseClient) => {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user;
  },
  signOut: async (client: SupabaseClient) => {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
};
