import { getApps, getApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithPopup,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  linkWithCredential,
  EmailAuthProvider,
  signInWithRedirect,
  linkWithPopup,
  signOut,
  User as FirebaseUser,
  RecaptchaVerifier,
} from "firebase/auth";

const phoneRecaptchaVerifiers = new Map<string, RecaptchaVerifier>();

const app = () => getApps().length ? getApp() : initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
});

const auth = () => {
  const instance = getAuth(app());
  if (process.env.NODE_ENV !== "production") instance.settings.appVerificationDisabledForTesting = true;
  return instance;
};

export async function beginGoogleSignInRedirect() {
  await signInWithRedirect(auth(), new GoogleAuthProvider());
}

export async function getGoogleSignInRedirectResult() {
  const result = await getRedirectResult(auth());
  return result ? { user: result.user, idToken: await result.user.getIdToken() } : null;
}

export async function signInWithGoogleViaFirebase() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account consent" });
  const result = await signInWithPopup(auth(), provider);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export function getFirebaseAuth() {
  return auth();
}

export async function linkGoogleToCurrentFirebaseUser() {
  const currentUser = auth().currentUser;
  if (!currentUser) throw new Error("Sign in with email and password before linking Google.");
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account consent" });
  const result = await linkWithPopup(currentUser, provider);
  return { user: result.user, idToken: await result.user.getIdToken(true) };
}

export async function signOutFirebase() {
  await signOut(auth());
}

export async function signInWithEmailViaFirebase(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function createEmailAccountViaFirebase(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken(true) };
}

export async function registerWithEmailViaFirebase(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export function createPhoneConfirmation(containerId: string, phone: string, linkCurrentUser = false) {
  const instance = auth();
  phoneRecaptchaVerifiers.get(containerId)?.clear();
  const verifier = new RecaptchaVerifier(instance, containerId, { size: "invisible" });
  phoneRecaptchaVerifiers.set(containerId, verifier);
  if (linkCurrentUser && instance.currentUser) return linkWithPhoneNumber(instance.currentUser, phone, verifier);
  return signInWithPhoneNumber(instance, phone, verifier);
}

export async function confirmPhoneViaFirebase(confirmation: any, code: string) {
  const result = await confirmation.confirm(code);
  return { user: result.user, idToken: await result.user.getIdToken(true) };
}

export async function linkEmailCredentialToCurrentUser(email: string, password: string) {
  const user = auth().currentUser;
  if (!user) throw new Error("Firebase session expired. Please start verification again.");
  const normalized = email.trim().toLowerCase();
  const existing = user.providerData.find((provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID);
  if (existing) return { user, idToken: await user.getIdToken(true) };
  const linked = await linkWithCredential(user, EmailAuthProvider.credential(normalized, password));
  return { user: linked.user, idToken: await linked.user.getIdToken(true) };
}
