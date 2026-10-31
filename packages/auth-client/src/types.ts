/**
 * Core User Data Model.
 */
export interface ZolexoraUser {
  uid: string;
  zolexora_id: string; // Crockford Base32: ZX-XXXX-XXXX-XXXX
  email: string;
  email_verified?: boolean;
  phone_number?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  status?: string;
  is_platform_admin?: boolean;
  created_at?: string;
}

/**
 * Organization and Multi-Tenant Context.
 */
export interface ZolexoraOrganization {
  org_id: string; // Crockford Base32: ZX-ORG-XXXX-XXXX-XXXX
  zolexora_org_id?: string;
  name?: string;
  role: string;
  permissions: string[];
}

/**
 * Track 1 (Global User-Centric) Sign In Parameters.
 */
export interface SignInParams {
  email_or_phone: string;
  password?: string;
  turnstileToken?: string;
  product?: string;
}

/**
 * Track 2 (Organization-Scoped Employee) Sign In Parameters.
 */
export interface OrgSignInParams {
  product?: string;
  org_id: string; // ZX-ORG-XXXX-XXXX-XXXX
  user_id_or_email: string;
  password?: string;
  turnstileToken?: string;
}

/**
 * Track 3 (Internal Platform Admin) Sign In Parameters.
 */
export interface AdminSignInParams {
  email: string;
  password?: string;
  turnstileToken?: string;
}

/**
 * Post-Authentication Routing Directives.
 */
export interface AuthRoutingInfo {
  user_type: "consumer" | "enterprise";
  redirect_route: string;
}

/**
 * Local Storage Session Model for Browser Persistence.
 */
export interface StoredSession {
  token: string;
  user: ZolexoraUser;
  org: ZolexoraOrganization | null;
  role: string | null;
  savedAt: number;
}

/**
 * Responses from Backend Login Routes.
 */
export interface Track1LoginResponse {
  success: boolean;
  customToken: string;
  user: {
    uid: string;
    zolexora_id: string;
    email: string;
    email_verified?: boolean;
  };
  routing?: AuthRoutingInfo;
  message?: string;
}

export interface Track2LoginResponse {
  success: boolean;
  customToken: string;
  claims: {
    zolexora_id: string;
    org_id: string;
    role: string;
    product: string;
    permissions: string[];
  };
  user: {
    uid: string;
    zolexora_id: string;
    email: string;
    status?: string;
  };
  org?: {
    zolexora_org_id: string;
    name?: string;
    role: string;
  };
  message?: string;
}

export interface Track3LoginResponse {
  success: boolean;
  customToken: string;
  admin: {
    id: string;
    zolexora_id: string;
    email: string;
    role: string;
    is_platform_admin: boolean;
    permissions: string[];
  };
  message?: string;
}
