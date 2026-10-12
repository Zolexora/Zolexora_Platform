export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

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
