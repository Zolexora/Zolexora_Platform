import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { config } from './runtime';

/** Firebase of the Zolexora auth service's project: only used to verify Google sign-in and SMS codes. */
export function firebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp({
    apiKey: config('FIREBASE_WEB_API_KEY'),
    authDomain: config('FIREBASE_WEB_AUTH_DOMAIN'),
    projectId: config('FIREBASE_WEB_PROJECT_ID'),
    appId: config('FIREBASE_WEB_APP_ID'),
  });
  return getAuth(app);
}
