import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  unlink,
  deleteUser,
  signOut,
  Auth,
  User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const phoneRecaptchaVerifiers = new Map<string, RecaptchaVerifier>();

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  // Firebase Console test numbers do not send SMS. Disable app verification
  // only for local development; production always uses reCAPTCHA protection.
  if (process.env.NODE_ENV !== "production") auth.settings.appVerificationDisabledForTesting = true;
  return auth;
}

export function isRealFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes("DummyKey") &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "zolexoramarketplace"
  );
}

export async function signInWithEmailViaFirebase(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function registerWithEmailViaFirebase(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function createEmailAccountViaFirebase(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken(true) };
}

export function createPhoneConfirmation(containerId: string, phone: string, linkCurrentUser = false) {
  const auth = getFirebaseAuth();
  phoneRecaptchaVerifiers.get(containerId)?.clear();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  phoneRecaptchaVerifiers.set(containerId, verifier);
  if (linkCurrentUser && auth.currentUser) {
    return linkWithPhoneNumber(auth.currentUser, phone, verifier);
  }
  return signInWithPhoneNumber(auth, phone, verifier);
}

export async function linkEmailPasswordToCurrentFirebaseUser(email: string, password: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Start phone verification again before creating your account.");
  const normalizedEmail = email.trim().toLowerCase();
  const existingPasswordProvider = user.providerData.find(
    (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID,
  );
  if (existingPasswordProvider) {
    if (existingPasswordProvider.email && existingPasswordProvider.email.toLowerCase() !== normalizedEmail) {
      throw new Error("This Firebase account is already linked to a different email address.");
    }
    return { user, idToken: await user.getIdToken(true), linkedNow: false };
  }
  try {
    const linked = await linkWithCredential(user, EmailAuthProvider.credential(normalizedEmail, password));
    return { user: linked.user, idToken: await linked.user.getIdToken(true), linkedNow: true };
  } catch (error: any) {
    // A repeated submit or Firebase refresh can race the provider link. Treat
    // an already-linked provider as success when it belongs to this email.
    if (error?.code === "auth/provider-already-linked") {
      const refreshed = getFirebaseAuth().currentUser;
      const provider = refreshed?.providerData.find(
        (item) => item.providerId === EmailAuthProvider.PROVIDER_ID,
      );
      if (refreshed && (!provider?.email || provider.email.toLowerCase() === normalizedEmail)) {
        return { user: refreshed, idToken: await refreshed.getIdToken(true), linkedNow: false };
      }
    }
    throw error;
  }
}

export async function unlinkEmailPasswordFromCurrentFirebaseUser() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  const provider = user.providerData.find((item) => item.providerId === EmailAuthProvider.PROVIDER_ID);
  if (provider) await unlink(user, EmailAuthProvider.PROVIDER_ID);
}

export async function deleteCurrentFirebaseUser() {
  const user = getFirebaseAuth().currentUser;
  if (user) await deleteUser(user);
}

export async function signOutFirebase() {
  await signOut(getFirebaseAuth());
}

export type FirebaseGoogleSignIn = {
  email: string;
  name: string | null;
  photoUrl: string | null;
  idToken: string;
  user: FirebaseUser;
};

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  // Do not silently reuse the browser's active Google identity. `consent`
  // also prevents an already-authorized account from completing without an
  // account-selection step in browsers that optimize `select_account` away.
  provider.setCustomParameters({ prompt: "select_account consent" });
  return provider;
}

async function toGoogleSignIn(result: { user: FirebaseUser }): Promise<FirebaseGoogleSignIn> {
  const user = result.user;
  if (!user.email) {
    throw new Error("No verified email returned from Google Account.");
  }
  return {
    email: user.email,
    name: user.displayName,
    photoUrl: user.photoURL,
    idToken: await user.getIdToken(),
    user,
  };
}

/** Redirect flow avoids the browser's COOP popup warnings. */
export async function beginGoogleSignInRedirect(): Promise<void> {
  window.sessionStorage.setItem("zolexora_google_redirect_pending", "1");
  await signInWithRedirect(getFirebaseAuth(), createGoogleProvider());
}

export async function getGoogleSignInRedirectResult(): Promise<FirebaseGoogleSignIn | null> {
  if (window.sessionStorage.getItem("zolexora_google_redirect_pending") !== "1") return null;
  const auth = getFirebaseAuth();
  const result = await getRedirectResult(auth);
  const user = result?.user || auth.currentUser;
  if (!user || !user.providerData.some((provider) => provider.providerId === "google.com")) return null;
  window.sessionStorage.removeItem("zolexora_google_redirect_pending");
  return toGoogleSignIn({ user });
}

export async function signInWithGoogleViaFirebase(): Promise<FirebaseGoogleSignIn> {
  return toGoogleSignIn(await signInWithPopup(getFirebaseAuth(), createGoogleProvider()));
}

export async function linkGoogleToCurrentFirebaseUser(): Promise<FirebaseGoogleSignIn> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error("Sign in with email and password before linking Google.");
  return toGoogleSignIn(await linkWithPopup(auth.currentUser, createGoogleProvider()));
}
