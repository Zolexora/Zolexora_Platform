export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
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
