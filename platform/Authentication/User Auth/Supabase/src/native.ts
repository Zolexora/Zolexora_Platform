import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "./client";
import { exchangeSupabaseToken } from "./session";
import type { AuthStorage, SupabaseAuthConfig } from "./types";
import { generateZolexoraId } from "./zolexora-id";

/** Supply Expo SecureStore or AsyncStorage so sessions persist on device. */
export function createSupabaseNativeAuthClient(config: SupabaseAuthConfig, storage: AuthStorage) {
  return createSupabaseAuthClient(config, {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  });
}

export interface NativeAuthOptions {
  client: SupabaseClient;
  apiBaseUrl: string;
  allowBuyerRegistration?: boolean;
}

export const nativeAuth = {
  signInWithEmail: (client: SupabaseClient, email: string, password: string) =>
    client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
  createEmailAccount: (client: SupabaseClient, email: string, password: string, name?: string) => {
    const zolexoraId = generateZolexoraId();
    return client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          zolexora_id: zolexoraId,
          full_name: name ? `${name} [${zolexoraId}]` : zolexoraId,
        },
      },
    });
  },
  signInWithGoogleIdToken: (client: SupabaseClient, idToken: string) =>
    client.auth.signInWithIdToken({ provider: "google", token: idToken }),
  sendPhoneCode: (client: SupabaseClient, phoneNumber: string) =>
    client.auth.signInWithOtp({ phone: phoneNumber }),
  sendEmailVerification: (client: SupabaseClient, email: string) =>
    client.auth.resend({ type: "signup", email }),
  sendPasswordReset: (client: SupabaseClient, email: string) =>
    client.auth.resetPasswordForEmail(email),
  signOut: (client: SupabaseClient) => client.auth.signOut(),
};

/** Supabase credential plus Marketplace's opaque native session with Zolexora ID. Identical to Firebase native auth. */
export function createNativeMarketplaceAuth(options: NativeAuthOptions) {
  const exchange = async (user: User, token: string, registrationName?: string, zolexoraId?: string) =>
    exchangeSupabaseToken({
      idToken: token,
      apiBaseUrl: options.apiBaseUrl,
      zolexora_id: zolexoraId ?? (user.user_metadata?.zolexora_id as string),
      registrationName,
      allowBuyerRegistration: options.allowBuyerRegistration,
      native: true,
    });

  return {
    signInWithEmail: async (email: string, password: string, registrationName?: string) => {
      const { data, error } = await nativeAuth.signInWithEmail(options.client, email, password);
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("Sign in failed.");
      return exchange(data.user, data.session.access_token, registrationName || (data.user.user_metadata?.full_name as string));
    },
    createEmailAccount: async (email: string, password: string, name: string) => {
      const { data, error } = await nativeAuth.createEmailAccount(options.client, email, password, name);
      if (error) throw error;
      if (!data.user) throw new Error("Account creation failed.");
      const zolexoraId = (data.user.user_metadata?.zolexora_id as string) || generateZolexoraId();
      return { user: data.user, registrationName: name, zolexoraId };
    },
    signInWithGoogleIdToken: async (idToken: string) => {
      const { data, error } = await nativeAuth.signInWithGoogleIdToken(options.client, idToken);
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("Google sign in failed.");
      return exchange(data.user, data.session.access_token, data.user.user_metadata?.full_name as string);
    },
    sendPhoneCode: (phoneNumber: string) => nativeAuth.sendPhoneCode(options.client, phoneNumber),
    confirmPhoneCode: async (phone: string, code: string, name?: string) => {
      const { data, error } = await options.client.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("Phone verification failed.");
      return exchange(data.user, data.session.access_token, name);
    },
    sendPasswordReset: (email: string) => nativeAuth.sendPasswordReset(options.client, email),
    signOut: () => nativeAuth.signOut(options.client),
  };
}
