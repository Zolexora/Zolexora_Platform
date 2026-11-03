import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import { resolveAuthUrl } from "../env.js";
import { useAuth } from "../react/use-auth.js";

/**
 * Track 1 "Continue with Google / Email / Phone" as a headless hook: the product renders the screens
 * for `step`, the hook talks to Firebase and the Zolexora auth service.
 *
 *   start ─ Google ─ existing ─────────────────────────────────────────▶ done
 *         │        └ new ─▶ enter_phone ▶ verify_phone ▶ profile ─────▶ done
 *         ├ Email ─ existing ─▶ password ─────────────────────────────▶ done
 *         │       └ new ─▶ verify_email ▶ enter_phone ▶ verify_phone ▶ profile ▶ done
 *         └ Phone ─ existing ─▶ password ─────────────────────────────▶ done
 *                 └ new ─▶ verify_phone ▶ enter_email ▶ verify_email ▶ profile ▶ done
 *
 * The phone steps are skipped for Google/email sign-ups when the service has
 * MOBILE_OTP_VERIFICATION=false. Phone numbers are verified with Firebase PNV when the app supplies
 * `getPnvToken` (native apps), otherwise with Firebase's SMS code (needs an element with
 * id `recaptchaContainerId` on the page for the invisible reCAPTCHA).
 */
export type PublicSignInStep =
  | "start"
  | "password"
  | "verify_email"
  | "enter_email"
  | "enter_phone"
  | "verify_phone"
  | "profile"
  | "done";

export interface UsePublicSignInOptions {
  /** Firebase Auth from the product's Firebase app (`getAuth(app)`), or a getter so Firebase starts on first use. */
  firebaseAuth: Auth | (() => Auth);
  product?: string;
  authUrl?: string;
  recaptchaContainerId?: string;
  /** Native apps: return a Firebase PNV token for the number, or null to fall back to the SMS code. */
  getPnvToken?: (phoneNumber: string) => Promise<string | null>;
  onSignedIn?: (session: any) => void;
}

export class PublicSignInError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

const FIREBASE_MESSAGES: Record<string, string> = {
  "auth/invalid-verification-code": "That code is not correct.",
  "auth/code-expired": "That code has expired. Send a new one.",
  "auth/invalid-phone-number": "Enter the phone number in international format, e.g. +919876543210.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/popup-closed-by-user": "Google sign-in was closed.",
  "auth/popup-blocked": "Allow pop-ups to continue with Google.",
};

const toError = (err: any): PublicSignInError =>
  err instanceof PublicSignInError
    ? err
    : new PublicSignInError(FIREBASE_MESSAGES[err?.code] ?? err?.message ?? "Something went wrong.", err?.code ?? "UNKNOWN");

export function usePublicSignIn(opts: UsePublicSignInOptions) {
  const { product = "zolexora-platform", recaptchaContainerId = "zx-recaptcha" } = opts;
  const getFirebase = () => (typeof opts.firebaseAuth === "function" ? opts.firebaseAuth() : opts.firebaseAuth);
  const baseUrl = resolveAuthUrl(opts.authUrl);
  const { applySession } = useAuth();

  const [step, setStep] = useState<PublicSignInStep>("start");
  const [email, setEmail] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PublicSignInError | null>(null);
  const [config, setConfig] = useState<{ mobile_verification_required: boolean } | null>(null);

  const signupToken = useRef<string | null>(null);
  const identifier = useRef<{ email?: string; phone_number?: string }>({});
  const confirmation = useRef<ConfirmationResult | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    fetch(`${baseUrl}/api/v1/auth/public/config`).then((r) => r.json()).then(setConfig).catch(() => {});
    return () => verifier.current?.clear();
  }, [baseUrl]);

  const post = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/public${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Target-Product": product },
        body: JSON.stringify({ product, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new PublicSignInError(data.message || "Request failed.", data.code || `HTTP_${res.status}`);
      }
      return data;
    },
    [baseUrl, product],
  );

  /** Runs one action with busy/error handling; returns whether it succeeded. */
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(toError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const finish = useCallback(
    async (session: any) => {
      applySession(session);
      await Promise.resolve().then(() => firebaseSignOut(getFirebase())).catch(() => {}); // the Zolexora session is the only session
      setStep("done");
      opts.onSignedIn?.(session);
    },
    [applySession, opts.firebaseAuth, opts.onSignedIn],
  );

  /** Applies a sign-up step response from the service. */
  const advance = useCallback(
    async (data: any) => {
      if (data.next === "done") return finish(data);
      if (data.signup_token) signupToken.current = data.signup_token;
      if (data.email) setEmail(data.email);
      if (data.phone_number) setPhoneNumber(data.phone_number);
      if (data.suggested_name) setSuggestedName(data.suggested_name);
      if (data.next === "verify_phone") setStep("enter_phone");
      else if (data.next === "verify_email") setStep(data.email ? "verify_email" : "enter_email");
      else setStep(data.next);
    },
    [finish],
  );

  const startSms = useCallback(
    async (phone: string) => {
      if (opts.getPnvToken) {
        const pnv_token = await opts.getPnvToken(phone).catch(() => null);
        if (pnv_token) return advance(await post("/signup/phone", { pnv_token, signup_token: signupToken.current }));
      }
      verifier.current?.clear();
      const auth = getFirebase();
      verifier.current = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
      confirmation.current = await signInWithPhoneNumber(auth, phone, verifier.current);
      setPhoneNumber(phone);
      setStep("verify_phone");
    },
    [advance, opts.firebaseAuth, opts.getPnvToken, post, recaptchaContainerId],
  );

  return {
    step,
    email,
    phoneNumber,
    suggestedName,
    busy,
    error,
    /** Whether the service requires a verified phone for every new account. */
    mobileVerificationRequired: config?.mobile_verification_required ?? true,

    continueWithGoogle: (turnstileToken: string) =>
      run(async () => {
        const cred = await signInWithPopup(getFirebase(), new GoogleAuthProvider());
        await advance(await post("/google", { id_token: await cred.user.getIdToken(), turnstile_token: turnstileToken }));
      }),

    continueWithEmail: (value: string, turnstileToken: string) =>
      run(async () => {
        const data = await post("/identify", { email: value.trim(), turnstile_token: turnstileToken });
        identifier.current = { email: value.trim().toLowerCase() };
        setEmail(value.trim().toLowerCase());
        setStep(data.exists ? "password" : "verify_email");
      }),

    continueWithPhone: (value: string, turnstileToken: string) =>
      run(async () => {
        const phone = value.replace(/[\s\-()]/g, "");
        const data = await post("/identify", { phone_number: phone, turnstile_token: turnstileToken });
        identifier.current = { phone_number: phone };
        setPhoneNumber(phone);
        if (data.exists) setStep("password");
        else await startSms(phone);
      }),

    signInWithPassword: (password: string, turnstileToken: string) =>
      run(async () => finish(await post("/login", { ...identifier.current, password, turnstile_token: turnstileToken }))),

    /** Phone-first sign-up: email the verification code. */
    sendEmailCode: (value: string) =>
      run(async () => {
        await post("/signup/email/send", { signup_token: signupToken.current, email: value.trim() });
        setEmail(value.trim().toLowerCase());
        setStep("verify_email");
      }),

    verifyEmailCode: (code: string) =>
      run(async () => advance(await post("/signup/email/verify", { email, otp: code.trim(), signup_token: signupToken.current ?? undefined }))),

    sendPhoneCode: (value: string) => run(() => startSms(value.replace(/[\s\-()]/g, ""))),

    verifyPhoneCode: (code: string) =>
      run(async () => {
        if (!confirmation.current) throw new PublicSignInError("Send the code first.", "NO_CODE_SENT");
        const cred = await confirmation.current.confirm(code.trim());
        const firebase_id_token = await cred.user.getIdToken();
        await advance(await post("/signup/phone", { firebase_id_token, signup_token: signupToken.current ?? undefined }));
      }),

    completeProfile: (displayName: string, password: string) =>
      run(async () => finish(await post("/signup/complete", { signup_token: signupToken.current, display_name: displayName, password }))),

    /** Back to the first screen; forgets everything entered so far. */
    restart: () => {
      signupToken.current = null;
      identifier.current = {};
      confirmation.current = null;
      setEmail(null);
      setPhoneNumber(null);
      setSuggestedName(null);
      setError(null);
      setStep("start");
    },
  };
}
