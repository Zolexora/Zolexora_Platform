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

export function getWebFirebaseAuth(config: FirebaseClientConfig): Auth {
  const appName = "zolexora-user-auth-firebase";
  const app = getApps().some((candidate) => candidate.name === appName)
    ? getApp(appName)
    : initializeApp(config, appName);
  return getAuth(app);
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

export const webAuth = {
  signInWithEmail: async (auth: Auth, email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return withAuthResult(credential.user);
  },
  createEmailAccount: async (auth: Auth, email: string, password: string, displayName?: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const zolexoraId = generateZolexoraId();
    // Persist displayName and zolexoraId
    await updateProfile(credential.user, {
      displayName: displayName ? `${displayName} [${zolexoraId}]` : zolexoraId,
    });
    return withAuthResult(credential.user, zolexoraId);
  },
  sendEmailVerification: (user: User) => sendEmailVerification(user),
  sendPasswordReset: (auth: Auth, email: string) => sendPasswordResetEmail(auth, email.trim().toLowerCase()),
  signInWithGoogle: async (auth: Auth) => {
    const credential = await signInWithPopup(auth, googleProvider());
    return withAuthResult(credential.user);
  },
  linkGoogle: async (user: User) => {
    const credential = await linkWithPopup(user, googleProvider());
    return withAuthResult(credential.user);
  },
  beginGoogleRedirect: (auth: Auth) => signInWithRedirect(auth, googleProvider()),
  getGoogleRedirectResult: async (auth: Auth) => {
    const result = await getRedirectResult(auth);
    return result ? withAuthResult(result.user) : null;
  },
  createPhoneConfirmation: (auth: Auth, containerId: string, phone: string, linkCurrentUser = false) => {
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
  unlinkEmail: async (auth: Auth) => {
    const user = auth.currentUser;
    if (user?.providerData.some((item) => item.providerId === EmailAuthProvider.PROVIDER_ID)) {
      await unlink(user, EmailAuthProvider.PROVIDER_ID);
    }
  },
  deleteCurrentUser: (auth: Auth) => auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve(),
  signOut: (auth: Auth) => signOut(auth),
};
