import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { FIREBASE_WEB_CONFIG } from './runtime';

/** Firebase only proves Google / phone ownership; sessions come from the Zolexora auth service. */
export const firebaseAuth = () => getAuth(getApps()[0] ?? initializeApp(FIREBASE_WEB_CONFIG()));
