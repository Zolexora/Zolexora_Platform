import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { FIREBASE_WEB_CONFIG } from './runtime';

/** Firebase is used only to prove Google / phone ownership; the session comes from the Zolexora auth service. */
export const firebaseAuth = () => getAuth(getApps()[0] ?? initializeApp(FIREBASE_WEB_CONFIG()));
