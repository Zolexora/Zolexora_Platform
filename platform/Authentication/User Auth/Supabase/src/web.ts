import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "./client";
import type { SupabaseClientConfig, ZolexoraUserProfile } from "./types";
import { generateZolexoraId } from "./zolexora-id";

export function getWebSupabaseAuth(config: SupabaseClientConfig): SupabaseClient {
  return createSupabaseAuthClient(config);
}

export function buildZolexoraProfile(user: User): ZolexoraUserProfile {
  const meta = user.user_metadata || {};
  const existingZolexoraId = (meta.zolexora_id as string) || (user.user_metadata?.full_name?.startsWith("ZX-") ? user.user_metadata.full_name : undefined);

  return {
    uid: user.id,
    zolexora_id: existingZolexoraId ?? generateZolexoraId(),
    email: user.email,
    phone_number: user.phone,
    display_name: meta.full_name || meta.display_name || null,
    email_verified: Boolean(user.email_confirmed_at),
    created_at: user.created_at,
  };
}

const withAuthResult = (user: User, sessionToken?: string | null, zolexoraId?: string) => {
  const profile = buildZolexoraProfile(user);
  if (zolexoraId) profile.zolexora_id = zolexoraId;
  return {
    user,
    idToken: sessionToken || "",
    profile,
    zolexoraId: profile.zolexora_id,
  };
};

export const webAuth = {
  signInWithEmail: async (client: SupabaseClient, email: string, password: string) => {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    return withAuthResult(data.user, data.session?.access_token);
  },

  createEmailAccount: async (client: SupabaseClient, email: string, password: string, displayName?: string) => {
    const zolexoraId = generateZolexoraId();
    const fullName = displayName ? `${displayName} [${zolexoraId}]` : zolexoraId;

    const { data, error } = await client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          zolexora_id: zolexoraId,
          full_name: fullName,
          display_name: fullName,
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Could not create user account.");
    return withAuthResult(data.user, data.session?.access_token, zolexoraId);
  },

  sendEmailVerification: async (client: SupabaseClient, email: string) => {
    const { error } = await client.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) throw error;
  },

  sendPasswordReset: async (client: SupabaseClient, email: string, redirectTo?: string) => {
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    if (error) throw error;
  },

  signInWithGoogle: async (client: SupabaseClient, redirectTo?: string) => {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
    return data;
  },

  linkGoogle: async (client: SupabaseClient, redirectTo?: string) => {
    const { data, error } = await client.auth.linkIdentity({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  },

  createPhoneConfirmation: async (client: SupabaseClient, _containerId: string, phone: string) => {
    const { data, error } = await client.auth.signInWithOtp({
      phone: phone.trim(),
    });
    if (error) throw error;
    return {
      confirm: async (code: string) => {
        const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
          phone: phone.trim(),
          token: code.trim(),
          type: "sms",
        });
        if (verifyError) throw verifyError;
        if (!verifyData.user) throw new Error("Verification failed.");
        return { user: verifyData.user };
      },
      data,
    };
  },

  confirmPhone: async (confirmation: { confirm(code: string): Promise<{ user: User }> }, code: string) => {
    const result = await confirmation.confirm(code);
    return withAuthResult(result.user);
  },

  deleteCurrentUser: async (client: SupabaseClient) => {
    const { error } = await client.auth.admin?.deleteUser
      ? await client.auth.admin.deleteUser((await client.auth.getUser()).data.user?.id || "")
      : { error: null };
    if (error) throw error;
  },

  signOut: async (client: SupabaseClient) => {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
};
