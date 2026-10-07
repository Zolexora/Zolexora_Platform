import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  linkWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
};

const phoneRecaptchaVerifiers = new Map();

export function isRealFirebaseConfigured() {
  const key = process.env.REACT_APP_FIREBASE_API_KEY;
  return Boolean(key && process.env.REACT_APP_FIREBASE_PROJECT_ID === 'zolexoramarketplace');
}

export async function signInWithEmailViaFirebase(email, password) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function registerWithEmailViaFirebase(email, password) {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function createEmailAccountViaFirebase(email, password) {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return { user: result.user, idToken: await result.user.getIdToken(true) };
}

export async function linkEmailCredentialToCurrentUser(email, password) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Google session expired. Please sign in with Google again.');
  const normalizedEmail = email.trim().toLowerCase();
  const existing = user.providerData.find((provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID);
  if (existing) {
    if (existing.email && existing.email.toLowerCase() !== normalizedEmail) {
      throw new Error('This Firebase account is already linked to a different email address.');
    }
    return { user, idToken: await user.getIdToken(true) };
  }
  try {
    const result = await linkWithCredential(user, EmailAuthProvider.credential(normalizedEmail, password));
    return { user: result.user, idToken: await result.user.getIdToken(true) };
  } catch (error) {
    if (error?.code === 'auth/provider-already-linked') {
      const refreshed = getFirebaseAuth().currentUser;
      const provider = refreshed?.providerData.find((item) => item.providerId === EmailAuthProvider.PROVIDER_ID);
      if (refreshed && (!provider?.email || provider.email.toLowerCase() === normalizedEmail)) {
        return { user: refreshed, idToken: await refreshed.getIdToken(true) };
      }
    }
    throw error;
  }
}

export function createPhoneConfirmation(containerId, phone, linkCurrentUser = false) {
  const auth = getFirebaseAuth();
  phoneRecaptchaVerifiers.get(containerId)?.clear();
  const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  phoneRecaptchaVerifiers.set(containerId, verifier);
  if (linkCurrentUser && auth.currentUser) return linkWithPhoneNumber(auth.currentUser, phone, verifier);
  return signInWithPhoneNumber(auth, phone, verifier);
}

export function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  if (process.env.NODE_ENV !== 'production') auth.settings.appVerificationDisabledForTesting = true;
  return auth;
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account consent" });
  return provider;
}

async function toGoogleSignIn(result) {
  const user = result.user;
  if (!user.email) {
    throw new Error("No verified email returned from Google Account.");
  }
  return {
    email: user.email,
    name: user.displayName,
    photoUrl: user.photoURL,
    idToken: await user.getIdToken(),
    providerId: user.providerData?.[0]?.providerId || 'google.com',
    user,
  };
}

export async function confirmPhoneViaFirebase(confirmation, code) {
  const result = await confirmation.confirm(code);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function beginGoogleSignInRedirect() {
  await signInWithRedirect(getFirebaseAuth(), createGoogleProvider());
}

export async function getGoogleSignInRedirectResult() {
  const result = await getRedirectResult(getFirebaseAuth());
  return result ? toGoogleSignIn(result) : null;
}

export async function signInWithGoogleViaFirebase() {
  return toGoogleSignIn(await signInWithPopup(getFirebaseAuth(), createGoogleProvider()));
}

export async function linkGoogleToCurrentFirebaseUser() {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error('Sign in with email and password before linking Google.');
  return toGoogleSignIn(await linkWithPopup(auth.currentUser, createGoogleProvider()));
}

export async function signOutFirebase() {
  await signOut(getFirebaseAuth());
}
