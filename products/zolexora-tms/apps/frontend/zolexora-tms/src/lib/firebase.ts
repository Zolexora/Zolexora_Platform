import { getWebFirebaseAuth, webAuth, type FirebaseClientConfig } from "@zolexora/user-auth-firebase";

const firebaseConfig: FirebaseClientConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForZolexoraTMSPlatform2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zolexora-platform.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "zolexora-platform",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "zolexora-platform.appspot.com",
};

export const auth = getWebFirebaseAuth(firebaseConfig);
export { webAuth };

/**
 * Returns current Firebase ID token or null.
 */
export async function getIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}
