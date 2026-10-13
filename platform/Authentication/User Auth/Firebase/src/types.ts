export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

/**
 * User Profile — Identity and credentials of the authenticated individual.
 */
export interface ZolexoraUserProfile {
  uid: string;
  zolexora_id: string; // Canonical ZX-XXXX-XXXX-XXXX
  email?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  email_verified: boolean;
  created_at?: string;
}

/**
 * Org Profile — Identity, tenant ID, and RBAC scope of the active organisation.
 */
export interface ZolexoraOrgProfile {
  id: string;
  zolexora_org_id: string; // Canonical ZX-ORG-XXXX-XXXX-XXXX
  name: string;
  slug: string;
  role: "owner" | "admin" | "manager" | "member" | "viewer" | string;
  permissions: string[];
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Full Session payload containing User Profile and optional Org Profile.
 */
export interface ZolexoraAuthSession {
  user: ZolexoraUserProfile;
  org?: ZolexoraOrgProfile | null;
  token: string;
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
