import { getWebFirebaseAuth, webAuth, getIdToken } from "@zolexora/user-auth-firebase";

/**
 * Global Firebase Auth singleton. Automatically resolves project configuration from environment.
 */
export const auth = getWebFirebaseAuth();
export { webAuth, getIdToken };
