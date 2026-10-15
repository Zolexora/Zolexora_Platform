import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPhoneNumber,
  linkWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  RecaptchaVerifier,
  signOut,
  unlink,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import type { FirebaseClientConfig, ZolexoraUserProfile } from "./types";
import { generateZolexoraId } from "./zolexora-id";

/**
 * Resolves Firebase configuration from parameters or environment variables.
 * Works seamlessly across Vite, Next.js, Create-React-App, and Node.js runtimes.
 */
export function resolveFirebaseConfig(customConfig?: Partial<FirebaseClientConfig>): FirebaseClientConfig {
  const getEnv = (key: string): string => {
    try {
      // @ts-ignore
      if (typeof import.meta !== "undefined" && import.meta?.env?.[key]) {
        // @ts-ignore
        return String(import.meta.env[key]);
      }
    } catch {}
    try {
      if (typeof process !== "undefined" && process?.env?.[key]) {
        return String(process.env[key]);
      }
    } catch {}
    return "";
  };

  const resolveKey = (suffix: string, fallback: string): string => {
    // 1. Direct match for TMS Account 1 (Infisical alias)
    const tmsVal = getEnv(`NEXT_PUBLIC_FIREBASE_ACC1_TMS_${suffix}`) || getEnv(`VITE_FIREBASE_ACC1_TMS_${suffix}`);
    if (tmsVal) return tmsVal;

    // 2. Standard product-level env vars
    const standardVal =
      getEnv(`VITE_FIREBASE_${suffix}`) ||
      getEnv(`NEXT_PUBLIC_FIREBASE_${suffix}`) ||
      getEnv(`FIREBASE_${suffix}`);
    if (standardVal) return standardVal;

    // 3. Dynamic scan for any account-scoped key in runtime environment (e.g., ACC2_MKT_*, etc.)
    try {
      // @ts-ignore
      const metaEnv = typeof import.meta !== "undefined" && import.meta?.env;
      if (metaEnv) {
        for (const k of Object.keys(metaEnv)) {
          if ((k.startsWith("NEXT_PUBLIC_FIREBASE_ACC") || k.startsWith("VITE_FIREBASE_ACC")) && k.endsWith(`_${suffix}`)) {
            const v = String(metaEnv[k]);
            if (v) return v;
          }
        }
      }
    } catch {}

    try {
      if (typeof process !== "undefined" && process?.env) {
        for (const k of Object.keys(process.env)) {
          if ((k.startsWith("NEXT_PUBLIC_FIREBASE_ACC") || k.startsWith("VITE_FIREBASE_ACC")) && k.endsWith(`_${suffix}`)) {
            const v = String(process.env[k]);
            if (v) return v;
          }
        }
      }
    } catch {}

    return fallback;
  };

  return {
    apiKey: customConfig?.apiKey || resolveKey("API_KEY", "AIzaSyDummyKeyForZolexoraPlatform2026"),
    authDomain: customConfig?.authDomain || resolveKey("AUTH_DOMAIN", "zolexora-platform.firebaseapp.com"),
    projectId: customConfig?.projectId || resolveKey("PROJECT_ID", "zolexora-platform"),
    appId: customConfig?.appId || resolveKey("APP_ID", "1:1234567890:web:abcdef123456"),
    messagingSenderId: customConfig?.messagingSenderId || resolveKey("MESSAGING_SENDER_ID", "") || undefined,
    storageBucket: customConfig?.storageBucket || resolveKey("STORAGE_BUCKET", "") || undefined,
  };
}

let cachedAuth: Auth | null = null;

/**
 * Returns the initialized Web Firebase Auth instance.
 * If called without arguments, automatically resolves config from environment.
 * Reuses the singleton instance across the application.
 */
export function getWebFirebaseAuth(config?: Partial<FirebaseClientConfig>): Auth {
  if (cachedAuth && !config) {
    return cachedAuth;
  }
  const resolved = resolveFirebaseConfig(config);
  const appName = "zolexora-user-auth-firebase";
  const app = getApps().some((candidate) => candidate.name === appName)
    ? getApp(appName)
    : initializeApp(resolved, appName);
  cachedAuth = getAuth(app);
  return cachedAuth;
}

/**
 * Convenience helper to get the active Firebase ID token without passing an Auth instance.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getWebFirebaseAuth();
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

const phoneVerifiers = new Map<string, RecaptchaVerifier>();

export async function buildZolexoraProfile(user: User): Promise<ZolexoraUserProfile> {
  const tokenResult = await user.getIdTokenResult();
  const existingZolexoraId = (tokenResult.claims.zolexora_id as string) || (user.displayName?.startsWith("ZX-") ? user.displayName : undefined);
  
  return {
    uid: user.uid,
    zolexora_id: existingZolexoraId ?? generateZolexoraId(),
    email: user.email,
    phone_number: user.phoneNumber,
    display_name: user.displayName,
    email_verified: user.emailVerified,
    created_at: user.metadata.creationTime,
  };
}

const withAuthResult = async (user: User, zolexoraId?: string) => {
  const idToken = await user.getIdToken();
  const profile = await buildZolexoraProfile(user);
  if (zolexoraId) profile.zolexora_id = zolexoraId;
  return { user, idToken, profile, zolexoraId: profile.zolexora_id };
};

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
};

function isAuth(val: unknown): val is Auth {
  return typeof val === "object" && val !== null && "currentUser" in val;
}

/**
 * High-level auth actions. Can be called with (auth, ...) or directly with (...)
 * defaulting to the global singleton Auth instance.
 */
export const webAuth = {
  signInWithEmail: async (arg1: Auth | string, arg2?: string, arg3?: string) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const email = (isAuth(arg1) ? arg2 : arg1) as string;
    const password = (isAuth(arg1) ? arg3 : arg2) as string;
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return withAuthResult(credential.user);
  },

  createEmailAccount: async (arg1: Auth | string, arg2?: string, arg3?: string, arg4?: string) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const email = (isAuth(arg1) ? arg2 : arg1) as string;
    const password = (isAuth(arg1) ? arg3 : arg2) as string;
    const displayName = isAuth(arg1) ? arg4 : arg3;
    const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const zolexoraId = generateZolexoraId();
    await updateProfile(credential.user, {
      displayName: displayName ? `${displayName} [${zolexoraId}]` : zolexoraId,
    });
    return withAuthResult(credential.user, zolexoraId);
  },

  sendEmailVerification: (user: User) => sendEmailVerification(user),

  sendPasswordReset: async (arg1: Auth | string, arg2?: string) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const email = (isAuth(arg1) ? arg2 : arg1) as string;
    return sendPasswordResetEmail(auth, email.trim().toLowerCase());
  },

  signInWithGoogle: async (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const credential = await signInWithPopup(auth, googleProvider());
    return withAuthResult(credential.user);
  },

  linkGoogle: async (user: User) => {
    const credential = await linkWithPopup(user, googleProvider());
    return withAuthResult(credential.user);
  },

  beginGoogleRedirect: (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    return signInWithRedirect(auth, googleProvider());
  },

  getGoogleRedirectResult: async (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const result = await getRedirectResult(auth);
    return result ? withAuthResult(result.user) : null;
  },

  createPhoneConfirmation: (arg1: Auth | string, arg2: string, arg3?: string, arg4 = false) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const containerId = (isAuth(arg1) ? arg2 : arg1) as string;
    const phone = (isAuth(arg1) ? arg3 : arg2) as string;
    const linkCurrentUser = isAuth(arg1) ? arg4 : Boolean(arg3);

    phoneVerifiers.get(containerId)?.clear();
    const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    phoneVerifiers.set(containerId, verifier);
    if (linkCurrentUser && auth.currentUser) return linkWithPhoneNumber(auth.currentUser, phone, verifier);
    return signInWithPhoneNumber(auth, phone, verifier);
  },

  confirmPhone: async (confirmation: { confirm(code: string): Promise<{ user: User }> }, code: string) => {
    const result = await confirmation.confirm(code);
    return withAuthResult(result.user);
  },

  linkEmail: async (user: User, email: string, password: string) => {
    const credential = await linkWithCredential(user, EmailAuthProvider.credential(email.trim().toLowerCase(), password));
    return withAuthResult(credential.user);
  },

  unlinkEmail: async (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    const user = auth.currentUser;
    if (user?.providerData.some((item) => item.providerId === EmailAuthProvider.PROVIDER_ID)) {
      await unlink(user, EmailAuthProvider.PROVIDER_ID);
    }
  },

  deleteCurrentUser: (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    return auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve();
  },

  signOut: async (arg1?: Auth) => {
    const auth = isAuth(arg1) ? arg1 : getWebFirebaseAuth();
    return signOut(auth);
  },
};
