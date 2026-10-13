import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type User,
} from "@react-native-firebase/auth";
import { exchangeFirebaseToken } from "./session";
import { generateZolexoraId } from "./zolexora-id";

export interface NativeAuthOptions {
  apiBaseUrl: string;
  allowBuyerRegistration?: boolean;
}

export const nativeAuth = {
  instance: getAuth,
  signInWithEmail: (email: string, password: string) =>
    signInWithEmailAndPassword(getAuth(), email.trim().toLowerCase(), password),
  createEmailAccount: (email: string, password: string) =>
    createUserWithEmailAndPassword(getAuth(), email.trim().toLowerCase(), password),
  signInWithGoogleIdToken: (idToken: string) =>
    signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken)),
  sendPhoneCode: (phoneNumber: string) => signInWithPhoneNumber(getAuth(), phoneNumber),
  sendEmailVerification: (user: User) => sendEmailVerification(user),
  sendPasswordReset: (email: string) => sendPasswordResetEmail(getAuth(), email.trim().toLowerCase()),
  signOut: () => signOut(getAuth()),
};

/** Firebase credential plus Marketplace's opaque native session with Zolexora ID. */
export function createNativeMarketplaceAuth(options: NativeAuthOptions) {
  const exchange = async (user: User, registrationName?: string, zolexoraId?: string) =>
    exchangeFirebaseToken({
      idToken: await user.getIdToken(),
      apiBaseUrl: options.apiBaseUrl,
      zolexora_id: zolexoraId,
      registrationName,
      allowBuyerRegistration: options.allowBuyerRegistration,
      native: true,
    });

  return {
    signInWithEmail: async (email: string, password: string, registrationName?: string) => {
      const credential = await nativeAuth.signInWithEmail(email, password);
      return exchange(credential.user, registrationName || credential.user.displayName || undefined);
    },
    createEmailAccount: async (email: string, password: string, name: string) => {
      const credential = await nativeAuth.createEmailAccount(email, password);
      const zolexoraId = generateZolexoraId();
      const displayName = name.trim() ? `${name.trim()} [${zolexoraId}]` : zolexoraId;
      await updateProfile(credential.user, { displayName });
      await nativeAuth.sendEmailVerification(credential.user);
      return { user: credential.user, registrationName: name, zolexoraId };
    },
    signInWithGoogleIdToken: async (idToken: string) => {
      const credential = await nativeAuth.signInWithGoogleIdToken(idToken);
      return exchange(credential.user, credential.user.displayName || undefined);
    },
    sendPhoneCode: nativeAuth.sendPhoneCode,
    confirmPhoneCode: async (confirmation: { confirm(code: string): Promise<{ user: User }> }, code: string, name?: string) =>
      exchange((await confirmation.confirm(code)).user, name),
    sendPasswordReset: nativeAuth.sendPasswordReset,
    signOut: nativeAuth.signOut,
  };
}
