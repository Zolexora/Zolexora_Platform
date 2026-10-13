export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseClientConfig = SupabaseAuthConfig;

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SupabaseAuthOptions {
  storage?: AuthStorage;
  autoRefreshToken?: boolean;
  persistSession?: boolean;
  detectSessionInUrl?: boolean;
}

export interface SupabaseAuthUserData {
  emailRedirectTo?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ZolexoraUserProfile {
  uid: string;
  zolexora_id: string;
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  email_verified: boolean;
  created_at?: string;
}

export interface SessionExchangeOptions {
  idToken: string;
  apiBaseUrl: string;
  zolexora_id?: string;
  registrationName?: string;
  allowBuyerRegistration?: boolean;
  native?: boolean;
}

export interface MarketplaceSession<User = Record<string, unknown>> {
  user: User;
  zolexora_id?: string;
  session_token?: string | null;
}
