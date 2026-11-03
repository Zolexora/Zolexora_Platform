import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "zolexora_session";

export interface MobileConfig {
  apiUrl: string;
  authServiceUrl: string;
  turnstileSiteKey: string;
}

/** app.config.js `extra`, filled from Infisical when Expo/EAS runs; there are no defaults. */
export function mobileConfig(): MobileConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const read = (key: keyof MobileConfig, source: string) => {
    const value = String(extra[key] ?? "").trim().replace(/\/+$/, "");
    if (!value) throw new Error(`${source} is not configured (Infisical /Zolexora_Marketplace)`);
    return value;
  };
  return {
    apiUrl: read("apiUrl", "MARKETPLACE_API_URL"),
    authServiceUrl: read("authServiceUrl", "AUTH_SERVICE_PUBLIC_URL"),
    turnstileSiteKey: read("turnstileSiteKey", "TURNSTILE_SITE_KEY"),
  };
}

/** The Zolexora auth-service session token (bearer for the marketplace API). */
export const sessionToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const storeSessionToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearSessionToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

/** Revokes the session at the auth service (best effort) and forgets it locally. */
export async function signOut(): Promise<void> {
  const token = await sessionToken();
  if (token) {
    await fetch(`${mobileConfig().authServiceUrl}/api/v1/auth/tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ revocation_type: "single_token", reason: "user_logout" }),
    }).catch(() => {});
  }
  await clearSessionToken();
}
