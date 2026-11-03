import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { runtimeConfig } from "./runtime";

/** Firebase of the Zolexora auth service's project: only used to verify Google sign-in and SMS codes. */
export function firebaseAuth(): Auth {
  return getAuth(getApps().length ? getApp() : initializeApp(runtimeConfig().firebase));
}
