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
  type Auth,
  type User,
} from "firebase/auth";
import type { FirebaseClientConfig } from "./types";

export function getWebFirebaseAuth(config: FirebaseClientConfig): Auth {
  const appName = "zolexora-user-auth-firebase";
  const app = getApps().some((candidate) => candidate.name === appName)
    ? getApp(appName)
    : initializeApp(config, appName);
  return getAuth(app);
}

const phoneVerifiers = new Map<string, RecaptchaVerifier>();
const withIdToken = async (user: User) => ({ user, idToken: await user.getIdToken() });
const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
};

export const webAuth = {
  signInWithEmail: async (auth: Auth, email: string, password: string) =>
    withIdToken((await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)).user),
  createEmailAccount: async (auth: Auth, email: string, password: string) =>
    withIdToken((await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)).user),
  sendEmailVerification: (user: User) => sendEmailVerification(user),
  sendPasswordReset: (auth: Auth, email: string) => sendPasswordResetEmail(auth, email.trim().toLowerCase()),
  signInWithGoogle: async (auth: Auth) => withIdToken((await signInWithPopup(auth, googleProvider())).user),
  linkGoogle: async (user: User) => withIdToken((await linkWithPopup(user, googleProvider())).user),
  beginGoogleRedirect: (auth: Auth) => signInWithRedirect(auth, googleProvider()),
  getGoogleRedirectResult: async (auth: Auth) => {
    const result = await getRedirectResult(auth);
    return result ? withIdToken(result.user) : null;
  },
  createPhoneConfirmation: (auth: Auth, containerId: string, phone: string, linkCurrentUser = false) => {
    phoneVerifiers.get(containerId)?.clear();
    const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    phoneVerifiers.set(containerId, verifier);
    if (linkCurrentUser && auth.currentUser) return linkWithPhoneNumber(auth.currentUser, phone, verifier);
    return signInWithPhoneNumber(auth, phone, verifier);
  },
  confirmPhone: async (confirmation: { confirm(code: string): Promise<{ user: User }> }, code: string) =>
    withIdToken((await confirmation.confirm(code)).user),
  linkEmail: async (user: User, email: string, password: string) =>
    withIdToken((await linkWithCredential(user, EmailAuthProvider.credential(email.trim().toLowerCase(), password))).user),
  unlinkEmail: async (auth: Auth) => {
    const user = auth.currentUser;
    if (user?.providerData.some((item) => item.providerId === EmailAuthProvider.PROVIDER_ID)) {
      await unlink(user, EmailAuthProvider.PROVIDER_ID);
    }
  },
  deleteCurrentUser: (auth: Auth) => auth.currentUser ? deleteUser(auth.currentUser) : Promise.resolve(),
  signOut: (auth: Auth) => signOut(auth),
};
