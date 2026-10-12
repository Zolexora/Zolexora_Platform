export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

export interface SessionExchangeOptions {
  idToken: string;
  apiBaseUrl: string;
  registrationName?: string;
  allowBuyerRegistration?: boolean;
  native?: boolean;
}

export interface MarketplaceSession<User = Record<string, unknown>> {
  user: User;
  session_token?: string | null;
}
