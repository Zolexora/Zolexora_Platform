import { getWebFirebaseAuth, webAuth, getIdToken } from '@zolexora/user-auth-firebase';

/**
 * Admin Firebase auth — uses NEXT_PUBLIC_TMS_ADMIN_FIREBASE_* env keys.
 * The resolver in web.ts automatically picks these up from window.__ENV__.
 */
export const auth = getWebFirebaseAuth();
export { webAuth, getIdToken };
