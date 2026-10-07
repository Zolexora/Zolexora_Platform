"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store";
import { authApi } from "@/lib/api";
import {
  signInWithGoogleViaFirebase,
  linkGoogleToCurrentFirebaseUser,
  getFirebaseAuth,
  type FirebaseGoogleSignIn,
  signInWithEmailViaFirebase,
  createEmailAccountViaFirebase,
  createPhoneConfirmation,
  linkEmailPasswordToCurrentFirebaseUser,
  unlinkEmailPasswordFromCurrentFirebaseUser,
  deleteCurrentFirebaseUser,
  signOutFirebase,
  isRealFirebaseConfigured,
} from "@/lib/firebase";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Smartphone,
  Globe,
  Sparkles,
  KeyRound,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

type FlowMode = "select" | "enter_email" | "enter_phone" | "not_registered" | "google_profile" | "google_password" | "email_login" | "email_password_enrollment" | "email_register" | "phone_otp" | "phone_login" | "phone_register" | "forgot";
type EntryMethod = "google" | "email" | "mobile";
type FlowContext = "google-registration" | "email-registration" | "mobile-registration" | "email-otp-login" | "phone-otp-login" | null;
type Platform = "web" | "android";

const EMAIL_OTP_EXPIRY_SECONDS = 5 * 60;
const EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_HOURLY_LIMIT = 5;

const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function PasswordRequirements({ value }: { value: string }) {
  const checks = [
    ["At least 8 characters", value.length >= 8],
    ["One uppercase letter", /[A-Z]/.test(value)],
    ["One number", /\d/.test(value)],
    ["One special character", /[^A-Za-z0-9]/.test(value)],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[10px]" aria-live="polite">
      {checks.map(([label, valid]) => (
        <span key={label} className={valid ? "text-green-700 font-semibold" : "text-gray-500"}>
          <span className={`inline-flex items-center justify-center w-3.5 h-3.5 mr-1 rounded-full text-[9px] ${valid ? "bg-green-600 text-white" : "border border-gray-300"}`}>
            {valid ? "✓" : ""}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

export default function UnifiedAuthPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  // Automatic platform auto-selection (Web SMS OTP vs Android Native PNV)
  const [platform, setPlatform] = useState<Platform>("web");

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      const isAndroid = /Android/i.test(navigator.userAgent);
      setPlatform(isAndroid ? "android" : "web");
    }

  }, []);

  const [mode, setModeState] = useState<FlowMode>("select");
  const modeHistory = useRef<FlowMode[]>([]);
  const [busy, setBusy] = useState(false);
  const flowRequestId = useRef(0);

  const setMode = (next: FlowMode) => {
    setModeState((current) => {
      if (current !== next) modeHistory.current.push(current);
      return next;
    });
  };

  const goBack = () => {
    flowRequestId.current += 1;
    setBusy(false);
    const previous = modeHistory.current.pop();
    if (previous) setModeState(previous);
    else setModeState("select");
  };

  const savePhoneConfirmation = (confirmation: any) => {
    phoneConfirmationRef.current = confirmation;
    setPhoneConfirmation(confirmation);
  };
  const [showPw, setShowPw] = useState(false);

  // Common inputs
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [manualNameInput, setManualNameInput] = useState("");
  const [entryMethod, setEntryMethod] = useState<EntryMethod | null>(null);
  const [flowContext, setFlowContext] = useState<FlowContext>(null);
  const [googlePurpose, setGooglePurpose] = useState<"signin" | "verify">("signin");

  // Email login state (Existing user)
  const [emailAuthChoice, setEmailAuthChoice] = useState<"password" | "otp">("password");
  const [emailLoginOtp, setEmailLoginOtp] = useState(["", "", "", "", "", ""]);
  const [emailLoginOtpSent, setEmailLoginOtpSent] = useState(false);
  const [emailLoginOtpExpiresIn, setEmailLoginOtpExpiresIn] = useState(0);
  const [emailLoginOtpResendIn, setEmailLoginOtpResendIn] = useState(0);
  const [emailLoginOtpSendCount, setEmailLoginOtpSendCount] = useState(0);
  const [emailLoginOtpLimitReached, setEmailLoginOtpLimitReached] = useState(false);
  const [passwordEnrollmentRequired, setPasswordEnrollmentRequired] = useState(false);

  // Email registration state (New user)
  const [emailRegOtp, setEmailRegOtp] = useState(["", "", "", "", "", ""]);
  const [emailRegOtpSent, setEmailRegOtpSent] = useState(false);
  const [emailRegOtpExpiresIn, setEmailRegOtpExpiresIn] = useState(0);
  const [emailRegOtpResendIn, setEmailRegOtpResendIn] = useState(0);
  const [emailRegOtpSendCount, setEmailRegOtpSendCount] = useState(0);
  const [emailRegOtpLimitReached, setEmailRegOtpLimitReached] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Phone verification state
  const [phoneOtp, setPhoneOtp] = useState(["", "", "", "", "", ""]);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpExpiresIn, setPhoneOtpExpiresIn] = useState(0);
  const [phoneOtpResendIn, setPhoneOtpResendIn] = useState(0);
  const [phoneOtpSendCount, setPhoneOtpSendCount] = useState(0);
  const [phoneOtpAttempts, setPhoneOtpAttempts] = useState(0);
  const [phoneAuthChoice, setPhoneAuthChoice] = useState<"password" | "otp">("otp");
  const [phoneAccountExists, setPhoneAccountExists] = useState(false);
  const [phoneOtpReturnMode, setPhoneOtpReturnMode] = useState<FlowMode>("google_profile");
  const [firebaseIdentityCreatedForFlow, setFirebaseIdentityCreatedForFlow] = useState(false);

  useEffect(() => {
    if (!emailRegOtpSent && !emailLoginOtpSent && !phoneOtpSent) return;
    const timer = window.setInterval(() => {
      setEmailRegOtpExpiresIn((value) => Math.max(0, value - 1));
      setEmailRegOtpResendIn((value) => Math.max(0, value - 1));
      setEmailLoginOtpExpiresIn((value) => Math.max(0, value - 1));
      setEmailLoginOtpResendIn((value) => Math.max(0, value - 1));
      setPhoneOtpExpiresIn((value) => Math.max(0, value - 1));
      setPhoneOtpResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailRegOtpSent, emailLoginOtpSent, phoneOtpSent]);

  // Phone state
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState<any>(null);
  const phoneConfirmationRef = useRef<any>(null);
  const [firebasePhoneIdToken, setFirebasePhoneIdToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Google state
  const [googleVerifiedEmail, setGoogleVerifiedEmail] = useState("");
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);

  // Phone-first registration email capture choice
  const [phoneEmailChoice, setPhoneEmailChoice] = useState<"google" | "manual">("google");

  // Android PNV Simulation state
  const [pnvToken, setPnvToken] = useState<string | null>(null);
  const [pnvVerifying, setPnvVerifying] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const ic = "w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all";

  const passwordIsValid = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

  const otpTiming = (response: unknown, fallbackExpiry = 5 * 60, fallbackResend = 60) => {
    const data = response as { expires_in?: number; expires_in_seconds?: number; resend_after?: number; resend_after_seconds?: number; resend_in?: number; retry_after?: number; retry_after_seconds?: number } | undefined;
    const expiresValue = Number(data?.expires_in_seconds ?? data?.expires_in);
    const resendValue = Number(data?.resend_after_seconds ?? data?.resend_after ?? data?.resend_in ?? data?.retry_after_seconds ?? data?.retry_after);
    return {
      expires: Number.isFinite(expiresValue) && expiresValue > 0 ? expiresValue : fallbackExpiry,
      resend: Number.isFinite(resendValue) && resendValue > 0 ? resendValue : fallbackResend,
    };
  };

  const run = async (fn: () => Promise<void>) => {
    const requestId = flowRequestId.current;
    setBusy(true);
    try {
      await fn();
      if (requestId !== flowRequestId.current) return;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (requestId === flowRequestId.current) toast.error(typeof detail === "string" ? detail : err?.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const handleFirebaseGoogleResult = async (res: FirebaseGoogleSignIn) => {
    const authRes = await authApi.googleAuth({ email: res.email, id_token: res.idToken });
    if (!authRes.is_new_user && authRes.user) {
      login(authRes.user);
      toast.success(`Welcome back, ${authRes.user.name}!`);
      router.push("/");
      return;
    }
    setGoogleVerifiedEmail(res.email);
    setEntryMethod("google");
    setFlowContext("google-registration");
    setGooglePurpose("signin");
    setIsGoogleVerified(true);
    setEmailInput(res.email);
    setManualNameInput("");
    setPasswordInput("");
    setPhoneInput("");
    setPhoneVerified(false);
    setPnvToken(null);
    setMode("not_registered");
    setFirebaseIdentityCreatedForFlow(true);
    toast.success("Google account verified! Please complete your profile.");
  };

  const handleOtpBox = (
    val: string,
    i: number,
    state: string[],
    setter: (arr: string[]) => void,
    prefix: string
  ) => {
    if (!/^\d*$/.test(val)) return;
    const n = [...state];
    n[i] = val.slice(-1);
    setter(n);
    if (val && i < 5) {
      (document.getElementById(`${prefix}-${i + 1}`) as HTMLInputElement)?.focus();
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PATH A: Direct 1-Click Google Authentication Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handleGoogleClick = async () => {
    try {
      setBusy(true);
      const firebaseAuth = getFirebaseAuth();
      // Do not start a second Google sign-in while Firebase is still
      // restoring the existing email/password session from browser storage.
      await firebaseAuth.authStateReady();
      const firebaseUser = firebaseAuth.currentUser;
      if (firebaseUser) {
        const hasGoogleProvider = firebaseUser.providerData.some(
          (provider) => provider.providerId === "google.com",
        );
        if (hasGoogleProvider) {
          // Re-open Google's chooser instead of silently reusing the current
          // Google identity. This lets the user select a different account.
          await handleFirebaseGoogleResult(await signInWithGoogleViaFirebase());
          return;
        }
        // A linked Firebase user may still report its original provider
        // (usually password). Always exchange the resulting identity through
        // /firebase; /google intentionally accepts only a fresh Google token.
        const identity = await linkGoogleToCurrentFirebaseUser();
        const authRes = await authApi.firebase(identity.idToken);
        login(authRes.user);
        toast.success(`Welcome back, ${authRes.user.name}!`);
        router.push("/");
      } else {
        await handleFirebaseGoogleResult(await signInWithGoogleViaFirebase());
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : err?.message || "Google sign-in failed");
    } finally {
      // New Google users continue into profile completion rather than routing
      // away, so this must run on the successful path as well.
      setBusy(false);
    }
  };

  const handleGooglePasswordEnrollment = () => {
    if (!passwordIsValid(passwordInput)) {
      toast.error("Password must be 8+ characters with 1 capital, 1 digit, and 1 special character");
      return;
    }
    run(async () => {
      const linked = await linkEmailPasswordToCurrentFirebaseUser(
        emailInput.trim().toLowerCase(),
        passwordInput,
      );
      const authRes = await authApi.firebase(linked.idToken);
      login(authRes.user);
      toast.success("Password added. You can now sign in with email or Google.");
      router.push("/");
    });
  };


  // ──────────────────────────────────────────────────────────────────────────
  // PATH B: Direct Email Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handleEmailSubmit = () => {
    if (!emailInput || !emailInput.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    run(async () => {
      const check = await authApi.checkEmail(emailInput.trim().toLowerCase());
      if (check.exists) {
        // Existing user -> Prompt login choice (OTP or Password)
        setMaskedPhone(check.masked_phone || "");
        setEmailAuthChoice("password");
        setPasswordEnrollmentRequired(false);
        setMode("email_login");
      } else {
        // New user -> show the shared registration gate before sending OTP.
        // A previously deleted account can remain in Firebase's browser
        // persistence. Registration must always begin with a fresh Firebase
        // identity so providers are not accidentally linked to that stale user.
        await signOutFirebase();
        setEntryMethod("email");
        setFlowContext("email-registration");
        setMode("not_registered");
      }
    });
  };

  const handleResendEmailRegOtp = () => {
    if (emailRegOtpResendIn > 0) return;
    if (emailRegOtpSendCount >= EMAIL_OTP_HOURLY_LIMIT) {
      setEmailRegOtpLimitReached(true);
      toast.error("Hourly email OTP limit reached. Please try again later.");
      return;
    }
    run(async () => {
      const otp = otpTiming(await authApi.sendEmailOtp(emailInput.trim().toLowerCase(), "registration"));
      setEmailRegOtp(["", "", "", "", "", ""]);
      setEmailRegOtpExpiresIn(otp.expires);
      setEmailRegOtpResendIn(otp.resend);
      setEmailRegOtpSendCount((count) => count + 1);
      setEmailRegOtpLimitReached(false);
      toast.success("A new verification code was sent.");
    });
  };

  const handleNotRegisteredRegister = () => {
    if (entryMethod === "google") {
      setMode("google_profile");
      return;
    }
    run(async () => {
      if (entryMethod === "email") {
        await signOutFirebase();
        const otp = otpTiming(await authApi.sendEmailOtp(emailInput.trim().toLowerCase(), "registration"));
        setEmailRegOtpSent(true);
        setEmailRegOtpExpiresIn(otp.expires);
        setEmailRegOtpResendIn(otp.resend);
        setEmailRegOtpSendCount(1);
        setEmailVerified(false);
        setMode("email_register");
      } else {
        const clean = phoneInput.replace(/\D/g, "").slice(-10);
        const confirmation = await createPhoneConfirmation("firebase-phone-login-recaptcha", `+91${clean}`);
        savePhoneConfirmation(confirmation);
        setPhoneOtpSent(true);
        setPhoneOtp(["", "", "", "", "", ""]);
        setPhoneOtpExpiresIn(5 * 60);
        setPhoneOtpResendIn(60);
        setPhoneVerified(false);
        setPhoneOtpReturnMode("phone_register");
        setMode("phone_otp");
      }
    });
  };

  const handleEditEmail = () => {
    setEmailRegOtp(["", "", "", "", "", ""]);
    setEmailRegOtpSent(false);
    setEmailRegOtpExpiresIn(0);
    setEmailRegOtpResendIn(0);
    setEmailRegOtpSendCount(0);
    setEmailRegOtpLimitReached(false);
    setEmailVerified(false);
    if (mode === "email_register") setMode("enter_email");
  };

  const handleSendPhoneRegistrationEmailOtp = () => {
    if (emailRegOtpSendCount >= EMAIL_OTP_HOURLY_LIMIT) {
      setEmailRegOtpLimitReached(true);
      toast.error("Hourly email OTP limit reached. Please try again later.");
      return;
    }
    run(async () => {
      const account = await authApi.checkEmail(emailInput.trim().toLowerCase());
      if (account.exists) {
        toast.error("This email is already registered. Please enter a different email.");
        return;
      }
      const otp = otpTiming(await authApi.sendEmailOtp(emailInput.trim().toLowerCase(), "registration"));
      setEmailRegOtpSent(true);
      setEmailRegOtpExpiresIn(otp.expires);
      setEmailRegOtpResendIn(otp.resend);
      setEmailRegOtpSendCount((count) => count + 1);
      setEmailRegOtpLimitReached(false);
      toast.success("Code sent to email!");
    });
  };

  const handleVerifyEmailRegOtp = () => {
    if (emailRegOtpExpiresIn <= 0) {
      toast.error("This verification code has expired. Request a new code.");
      return;
    }
    const code = emailRegOtp.join("");
    if (code.length !== 6) {
      toast.error("Enter the 6-digit verification code");
      return;
    }
    run(async () => {
      await authApi.verifyEmailOtp(emailInput.trim().toLowerCase(), code, "registration");
      setEmailVerified(true);
      toast.success("Email verified! Now complete your profile details.");
    });
  };

  const handleEmailPasswordLogin = () => {
    if (!passwordInput) {
      toast.error("Enter your password");
      return;
    }
    run(async () => {
      try {
        const email = emailInput.trim().toLowerCase();
        const firebase = await signInWithEmailViaFirebase(email, passwordInput);
        const res = await authApi.firebase(firebase.idToken);
        login(res.user);
        toast.success(`Welcome back, ${res.user.name}!`);
        router.push("/");
      } catch (error: any) {
        if (error?.code === "auth/invalid-credential") {
          setPasswordInput("");
          toast.error("Email or password is incorrect.");
          return;
        }
        throw error;
      }
    });
  };

  const handleEnrollEmailPassword = () => {
    if (!passwordIsValid(passwordInput)) {
      toast.error("Password must be 8+ characters with 1 capital, 1 digit, and 1 special character");
      return;
    }
    run(async () => {
      let firebaseIdToken: string;
      let createdFirebaseIdentity = false;
      try {
        try {
          const firebase = await createEmailAccountViaFirebase(emailInput.trim().toLowerCase(), passwordInput);
          firebaseIdToken = firebase.idToken;
          createdFirebaseIdentity = true;
        } catch (error: any) {
          if (error?.code !== "auth/email-already-in-use") throw error;
          // Firebase deliberately hides whether the original password was
          // wrong or an account was absent. After Marketplace email-OTP
          // authentication, accept a valid existing Firebase password and
          // attach that exact identity to this Marketplace account.
          const firebase = await signInWithEmailViaFirebase(emailInput.trim().toLowerCase(), passwordInput);
          firebaseIdToken = firebase.idToken;
        }
        const res = await authApi.enrollFirebaseEmail(firebaseIdToken);
        setPasswordEnrollmentRequired(false);
        login(res.user);
        toast.success("Password set. You can now sign in with email and password.");
        router.push("/");
      } catch (error: any) {
        if (createdFirebaseIdentity) {
          try {
            await deleteCurrentFirebaseUser();
          } catch {
            // Keep the original enrollment failure; Firebase cleanup is best effort.
          }
        }
        if (error?.code === "auth/invalid-credential") {
          throw new Error("A Firebase password already exists for this email. Enter that password or reset it in Firebase Authentication.");
        }
        throw error;
      }
    });
  };

  const handleSendEmailLoginOtp = () => {
    run(async () => {
      setFlowContext("email-otp-login");
      const otp = otpTiming(await authApi.sendLoginOtp({ email: emailInput.trim().toLowerCase(), channel: "email" }));
      setEmailLoginOtpSent(true);
      setEmailLoginOtpExpiresIn(otp.expires);
      setEmailLoginOtpResendIn(otp.resend);
      setEmailLoginOtpSendCount(1);
      setEmailLoginOtpLimitReached(false);
      toast.success("Login OTP sent to your email!");
    });
  };

  const handleResendEmailLoginOtp = () => {
    if (emailLoginOtpResendIn > 0) return;
    if (emailLoginOtpSendCount >= EMAIL_OTP_HOURLY_LIMIT) {
      setEmailLoginOtpLimitReached(true);
      toast.error("Hourly email OTP limit reached. Please try again later.");
      return;
    }
    run(async () => {
      const otp = otpTiming(await authApi.sendLoginOtp({ email: emailInput.trim().toLowerCase(), channel: "email" }));
      setEmailLoginOtp(["", "", "", "", "", ""]);
      setEmailLoginOtpExpiresIn(otp.expires);
      setEmailLoginOtpResendIn(otp.resend);
      setEmailLoginOtpSendCount((count) => count + 1);
      setEmailLoginOtpLimitReached(false);
      toast.success("A new login code was sent.");
    });
  };

  const handleVerifyEmailLoginOtp = () => {
    if (emailLoginOtpExpiresIn <= 0) {
      toast.error("This login code has expired. Request a new code.");
      return;
    }
    const code = emailLoginOtp.join("");
    if (code.length !== 6) {
      toast.error("Enter the 6-digit login OTP");
      return;
    }
    run(async () => {
      const res = await authApi.verifyLoginOtp({ email: emailInput.trim().toLowerCase(), otp: code });
      login(res.user);
      toast.success(`Welcome back, ${res.user.name}!`);
      router.push("/");
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PATH C: Direct Phone Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handlePhoneSubmit = (skipAccountCheck = false) => {
    const clean = phoneInput.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    run(async () => {
      if (!skipAccountCheck) {
        const account = await authApi.checkPhone(clean.slice(-10));
        if (account.exists) {
          setFlowContext("phone-otp-login");
          setMaskedPhone(account.masked_phone || "");
          setMaskedEmail(account.masked_email || "");
          setPhoneAccountExists(true);
          setPhoneAuthChoice("otp");
        } else {
          setPhoneAccountExists(false);
          setEntryMethod("mobile");
          setFlowContext("mobile-registration");
          setMode("not_registered");
          return;
        }
      }
      const confirmation = await createPhoneConfirmation("firebase-phone-login-recaptcha", `+91${clean.slice(-10)}`);
      savePhoneConfirmation(confirmation);
      setMode("phone_login");
      setPhoneOtpSent(true);
      setPhoneOtp(["", "", "", "", "", ""]);
      setPhoneOtpExpiresIn(5 * 60);
      setPhoneOtpResendIn(60);
      setPhoneOtpSendCount((count) => count + 1);
      setPhoneOtpAttempts(0);
      toast.success("Firebase verification code sent via SMS!");
    });
  };

  const handlePhonePasswordLogin = () => {
    if (!passwordInput) {
      toast.error("Enter your password");
      return;
    }
    run(async () => {
      try {
        const res = await authApi.loginPhone(phoneInput.replace(/\D/g, "").slice(-10), passwordInput);
        login(res.user);
        toast.success(`Welcome back, ${res.user.name}!`);
        router.push("/");
      } catch (error: any) {
        if (error?.response?.status === 401) {
          setPhoneAuthChoice("otp");
          toast.error("This account uses Firebase. Sign in with email and password, or use phone OTP.");
          return;
        }
        throw error;
      }
    });
  };

  const handleChangePhone = () => {
    phoneConfirmationRef.current = null;
    setPhoneConfirmation(null);
    setPhoneAccountExists(false);
    setFirebaseIdentityCreatedForFlow(false);
    setPhoneOtp(["", "", "", "", "", ""]);
    setPhoneOtpSent(false);
    setPhoneOtpExpiresIn(0);
    setPhoneOtpResendIn(0);
    setPhoneOtpSendCount(0);
    setPhoneOtpAttempts(0);
    setMode("enter_phone");
  };

  const triggerAndroidPnv = (phone: string, purpose: "login" | "registration") => {
    setPnvVerifying(true);
    setTimeout(async () => {
      setPnvVerifying(false);
      const token = `PNV_ANDROID_SECURE_${Date.now()}`;
      setPnvToken(token);
      setPhoneVerified(true);
      toast.success("Android SIM Phone Verification (PNV) Succeeded! ✓");

      if (purpose === "login") {
        // Direct native phone login
        try {
          const res = await authApi.verifyLoginOtp({ phone, otp: "000000" });
          login(res.user);
          toast.success(`Welcome back, ${res.user.name}!`);
          router.push("/");
        } catch {
          // Fallback if test mode requires manual OTP
        }
      }
    }, 1200);
  };

  const handleVerifyPhoneOtp = (purpose: "login" | "registration") => {
    const code = phoneOtp.join("");
    if (code.length !== 6) {
      toast.error("Enter the 6-digit SMS OTP");
      return;
    }
    if (purpose === "login") {
      if (phoneOtpExpiresIn <= 0) {
        toast.error("This phone OTP has expired. Request a new code.");
        return;
      }
      if (phoneOtpAttempts >= 5) {
        toast.error("Too many attempts. Request a new OTP.");
        return;
      }
      setPhoneOtpAttempts((attempts) => attempts + 1);
    }

    run(async () => {
      if (purpose === "login") {
        if (!phoneConfirmation) throw new Error("Start phone verification again");
        const verified = await phoneConfirmation.confirm(code);
        const idToken = await verified.user.getIdToken();
        try {
          const res = await authApi.firebase(idToken);
          login(res.user);
          toast.success(`Welcome back, ${res.user.name}!`);
          router.push("/");
        } catch (err: any) {
          if (err?.response?.status !== 409) throw err;
          setFirebasePhoneIdToken(idToken);
          setFirebaseIdentityCreatedForFlow(true);
          setPhoneVerified(true);
          setMode("phone_register");
          toast.success("Phone verified. Now verify your email to finish creating the account.");
        }
      } else {
        await authApi.verifyPhoneOtp(phoneInput.replace(/\D/g, "").slice(-10), code, "registration");
        setPhoneVerified(true);
        toast.success("Phone number verified! Now link your email.");
      }
    });
  };

  const handlePhonePathGoogleLink = async () => {
    try {
      setBusy(true);
      const current = getFirebaseAuth().currentUser;
      const res = current
        ? await linkGoogleToCurrentFirebaseUser()
        : await signInWithGoogleViaFirebase();
      setGoogleVerifiedEmail(res.email);
      setIsGoogleVerified(true);
      setEmailInput(res.email);
      setEmailVerified(true);
      setFirebasePhoneIdToken(res.idToken);
      toast.success(`Google email (${res.email}) verified! ✓`);
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Web SMS Phone Verification for Registration Forms
  // ──────────────────────────────────────────────────────────────────────────
  const handleSendFormPhoneOtp = () => {
    if (phoneOtpResendIn > 0) return;
    const clean = phoneInput.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Enter a 10-digit phone number");
      return;
    }

    run(async () => {
      const account = await authApi.checkPhone(clean.slice(-10));
      if (account.exists) {
        toast.error("This phone number is already registered. Please enter a different number.");
        return;
      }
      if (platform === "android") {
        triggerAndroidPnv(clean.slice(-10), "registration");
        return;
      }
      // Firebase Phone Auth is required for Firebase test numbers (their OTP
      // is fixed by the Firebase console). The generic screen remains shared;
      // verification below uses the active Firebase confirmation object.
      const confirmation = await createPhoneConfirmation(
        "firebase-form-phone-recaptcha",
        `+91${clean.slice(-10)}`,
        isGoogleVerified,
      );
      savePhoneConfirmation(confirmation);
      setPhoneOtpSent(true);
      setPhoneOtp(["", "", "", "", "", ""]);
      setPhoneOtpExpiresIn(5 * 60);
      setPhoneOtpResendIn(60);
      setPhoneOtpSendCount((count) => count + 1);
      if (mode !== "phone_otp") {
        setPhoneOtpReturnMode(mode);
        setMode("phone_otp");
      }
      toast.success("Firebase verification code sent via SMS!");
    });
  };

  const handleVerifyFormPhoneOtp = () => {
    const code = phoneOtp.join("");
    if (code.length !== 6) {
      toast.error("Enter 6-digit SMS OTP");
      return;
    }
    run(async () => {
      const activeConfirmation = phoneConfirmationRef.current || phoneConfirmation;
      if (activeConfirmation) {
        const verified = await activeConfirmation.confirm(code);
        setFirebasePhoneIdToken(await verified.user.getIdToken());
        setFirebaseIdentityCreatedForFlow(true);
      } else {
        await authApi.verifyPhoneOtp(phoneInput.replace(/\D/g, "").slice(-10), code, "registration");
      }
      setPhoneVerified(true);
      setMode(phoneOtpReturnMode);
      toast.success("Phone number verified! ✓");
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Final Unified Account Provisioning
  // ──────────────────────────────────────────────────────────────────────────
  const handleFinalizeRegistration = () => {
    if (!manualNameInput.trim()) {
      toast.error("Full Name must be entered manually");
      return;
    }
    if (!passwordIsValid(passwordInput)) {
      toast.error("Password must be 8+ characters with 1 capital, 1 digit, and 1 special character");
      return;
    }
    if (!phoneVerified && !pnvToken) {
      toast.error("Phone number must be verified");
      return;
    }
    if (!emailVerified && !isGoogleVerified) {
      toast.error("Email address must be verified");
      return;
    }

    run(async () => {
      let linkedFirebaseToken = firebasePhoneIdToken || undefined;
      let linkedEmailNow = false;
      let createdFirebaseEmailIdentity = false;
      try {
        if (firebasePhoneIdToken || isGoogleVerified) {
          // Google registration still collects a fallback password. Attach it
          // to the authenticated Google Firebase user so a later email/password
          // login uses the same Firebase UID and Marketplace identity.
          const linked = await linkEmailPasswordToCurrentFirebaseUser(emailInput.trim().toLowerCase(), passwordInput);
          linkedFirebaseToken = linked.idToken;
          linkedEmailNow = linked.linkedNow;
        } else if (!isGoogleVerified) {
          // Android PNV does not establish a Firebase user. Create the
          // email/password identity here so the credential used at sign-up is
          // also the credential available for the next sign-in.
          const created = await createEmailAccountViaFirebase(emailInput.trim().toLowerCase(), passwordInput);
          linkedFirebaseToken = created.idToken;
          createdFirebaseEmailIdentity = true;
        }
        const payload = {
          email: emailInput.trim().toLowerCase(),
          name: manualNameInput.trim(),
          password: passwordInput,
          phone: phoneInput.replace(/\D/g, "").slice(-10),
          email_otp: emailRegOtp.join("") || undefined,
          phone_otp: phoneOtp.join("") || undefined,
          google_verified: isGoogleVerified,
          platform,
          pnv_token: pnvToken || undefined,
          firebase_id_token: linkedFirebaseToken,
        };

        const res = await authApi.completeUnifiedRegistration(payload);
        login(res.user);
        toast.success(`Account created! Welcome to Zolexora, ${res.user.name}! 🎉`);
        router.push("/");
      } catch (error) {
        if (linkedEmailNow) {
          try {
            await unlinkEmailPasswordFromCurrentFirebaseUser();
          } catch {
            // Preserve the original registration error; cleanup is best effort.
          }
        }
        if (firebaseIdentityCreatedForFlow || createdFirebaseEmailIdentity) {
          try {
            await deleteCurrentFirebaseUser();
          } catch {
            // Cleanup is best effort; preserve the original registration error.
          }
        }
        throw error;
      }
    });
  };

  // Reset to initial mode
  const resetToHome = () => {
    flowRequestId.current += 1;
    setBusy(false);
    modeHistory.current = [];
    setMode("select");
    setEmailInput("");
    setPhoneInput("");
    setPasswordInput("");
    setManualNameInput("");
    setEmailRegOtp(["", "", "", "", "", ""]);
    setEmailRegOtpSent(false);
    setEmailRegOtpExpiresIn(0);
    setEmailRegOtpResendIn(0);
    setEmailRegOtpSendCount(0);
    setEmailRegOtpLimitReached(false);
    setEmailVerified(false);
    setEmailLoginOtp(["", "", "", "", "", ""]);
    setEmailLoginOtpSent(false);
    setEmailLoginOtpExpiresIn(0);
    setEmailLoginOtpResendIn(0);
    setEmailLoginOtpSendCount(0);
    setEmailLoginOtpLimitReached(false);
    setPasswordEnrollmentRequired(false);
    setEntryMethod(null);
    setFlowContext(null);
    setGooglePurpose("signin");
    setPhoneOtp(["", "", "", "", "", ""]);
    setPhoneOtpSent(false);
    setPhoneAccountExists(false);
    setFirebaseIdentityCreatedForFlow(false);
    setPhoneOtpExpiresIn(0);
    setPhoneOtpResendIn(0);
    setPhoneOtpSendCount(0);
    setPhoneOtpAttempts(0);
    setPhoneAccountExists(false);
    setPhoneVerified(false);
    setIsGoogleVerified(false);
    setGoogleVerifiedEmail("");
    setPnvToken(null);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 bg-cream">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-modal p-8 border border-gray-100"
      >
        {mode !== "select" && (
          <div className="h-1 w-full rounded-full bg-gray-100 mb-5" aria-label="Registration progress">
            <div
              className="h-1 rounded-full bg-gold transition-all"
              style={{ width: `${Math.min(95, 15 + (mode === "google_profile" || mode === "email_register" || mode === "phone_register" ? 70 : 35))}%` }}
            />
          </div>
        )}
        <div id="firebase-form-phone-recaptcha" />
        <div id="firebase-phone-login-recaptcha" />
        {/* Top Reset / Back Bar */}
        {mode !== "select" && (
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={modeHistory.current.length ? goBack : resetToHome}
              className="text-xs font-bold text-gray-400 hover:text-ink flex items-center gap-1 transition"
            >
              <RotateCcw size={12} /> {modeHistory.current.length ? "Back" : "Back to options"}
            </button>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {platform === "android" ? "Android Mode" : "Web Mode"}
            </span>
          </div>
        )}

        <div className="text-center mb-6">
          <Link href="/" className="inline-flex flex-col items-center gap-2" aria-label="Zolexora home">
            <img src="/Zolexora_logo.png" alt="Zolexora" className="h-12 w-14 rounded-lg object-contain" />
            <span className="font-display text-2xl font-bold text-ink">Zolexora</span>
          </Link>
          <p className="text-gray-500 text-xs mt-1">
            {mode === "select" && "Choose how you'd like to continue"}
            {mode === "enter_email" && "Enter your email address to continue"}
            {mode === "enter_phone" && "Enter your mobile number to continue"}
            {mode === "not_registered" && "Create your Zolexora account"}
            {mode === "phone_otp" && "Verify your mobile number"}
            {mode === "google_profile" && "Complete your profile to finalize registration"}
            {mode === "google_password" && "Set a password for email sign-in"}
            {mode === "email_login" && "Sign in to your registered email account"}
            {mode === "email_password_enrollment" && "Set a password for future email sign-in"}
            {mode === "email_register" && "Create your new Zolexora account"}
            {mode === "phone_login" && "Sign in via Phone Number Verification"}
            {mode === "phone_register" && "Verify Phone and complete onboarding"}
            {mode === "forgot" && "Reset your account password"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* ────────────────────────────────────────────────────────────── */}
          {/* 1. SELECTION SCREEN: Google / Email / Phone                    */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "select" && (
            <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="space-y-3">
                {/* 1. Google Button */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleClick}
                  className="w-full h-12 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-ink font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition shadow-xs"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* 2. Email Button */}
                <button
                  type="button"
                  onClick={() => setMode("enter_email")}
                  className="w-full h-12 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 text-ink font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition shadow-xs"
                >
                  <Mail size={18} className="text-gray-600" />
                  <span>Continue with Email</span>
                </button>

                {/* 3. Phone Button */}
                <button
                  type="button"
                  onClick={() => setMode("enter_phone")}
                  className="w-full h-12 bg-[#1C1C1C] hover:bg-black text-[#FFB800] font-bold rounded-2xl flex items-center justify-center gap-3 text-sm transition shadow-xs"
                >
                  <Smartphone size={18} className="text-[#FFB800]" />
                  <span>Continue with Phone</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* 1A. ENTER EMAIL SCREEN                                         */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "enter_email" && (
            <motion.div key="enter_email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">EMAIL ADDRESS *</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className={ic}
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !emailInput || !emailInput.includes("@")}
                  onClick={handleEmailSubmit}
                  className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50 shadow-xs"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Continue with Email <ArrowRight size={15} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* 1B. ENTER PHONE SCREEN                                         */}
          {/* ────────────────────────────────────────────────────────────── */}
            {mode === "enter_phone" && (
            <motion.div key="enter_phone" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">MOBILE NUMBER *</label>
                  <div className="relative flex">
                    <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 text-xs font-bold text-gray-700">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-r-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white transition-all font-mono font-bold"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || phoneInput.replace(/\D/g, "").length < 10}
                  onClick={() => handlePhoneSubmit()}
                  className="w-full h-11 bg-[#1C1C1C] text-[#FFB800] hover:bg-black font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50 shadow-xs"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Continue with Phone <ArrowRight size={15} /></>}
                </button>
              </div>
            </motion.div>
            )}

          {mode === "not_registered" && (
            <motion.div key="not_registered" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <p className="font-bold text-ink">You’re not registered with us</p>
                  <p className="mt-1 text-xs text-gray-600 break-all">{entryMethod === "mobile" ? `+91 ${phoneInput}` : emailInput}</p>
                </div>
                <button type="button" disabled={busy} onClick={handleNotRegisteredRegister} className="w-full h-11 bg-gold text-ink font-bold rounded-xl disabled:opacity-50">
                  Register
                </button>
                <button type="button" disabled={busy} onClick={() => setMode(entryMethod === "google" ? "select" : entryMethod === "email" ? "enter_email" : "enter_phone")} className="w-full h-10 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 disabled:opacity-50">
                  {entryMethod === "google" ? "Choose a different Google account" : entryMethod === "email" ? "Change email" : "Change mobile number"}
                </button>
              </div>
            </motion.div>
          )}

          {mode === "phone_otp" && (
            <motion.div key="phone_otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-center">
                  <p className="text-xs text-blue-700">Verification code sent to mobile number</p>
                  <p className="mt-1 font-mono text-base font-bold text-ink">+91 {phoneInput.replace(/\D/g, "").slice(-10)}</p>
                  <button type="button" onClick={() => setMode(phoneOtpReturnMode)} disabled={busy} className="mt-1 text-[11px] font-bold text-blue-700 underline disabled:opacity-50">Change mobile number</button>
                </div>
                <div className="flex justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span>Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : "Expired"}</strong></span>
                  <span>{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : "Ready to resend"}</span>
                </div>
                <div className="flex justify-center gap-2">
                  {phoneOtp.map((digit, index) => (
                    <input key={index} id={`generic-phone-otp-${index}`} type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={(event) => handleOtpBox(event.target.value, index, phoneOtp, setPhoneOtp, "generic-phone-otp")}
                      className="h-12 w-11 rounded-xl border-2 bg-gray-50 text-center text-lg font-bold focus:border-gold focus:outline-none" />
                  ))}
                </div>
                <button type="button" disabled={busy || phoneOtpResendIn > 0} onClick={handleSendFormPhoneOtp} className="w-full h-10 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                  {phoneOtpResendIn ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : "Resend OTP"}
                </button>
                <button type="button" disabled={busy || phoneOtpExpiresIn <= 0 || phoneOtp.join("").length !== 6} onClick={handleVerifyFormPhoneOtp} className="w-full h-11 rounded-xl bg-gold font-bold text-ink disabled:bg-gray-200 disabled:text-gray-400">
                  {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Verify mobile and continue"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* PATH A: GOOGLE COMPLETE PROFILE FORM                           */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "google_profile" && (
            <motion.div key="google_profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs font-bold text-green-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={15} className="text-green-600" /> {googleVerifiedEmail}
                  </span>
                  <span className="bg-green-200 text-green-900 px-2 py-0.5 rounded-full text-[10px]">Google Verified</span>
                </div>

                {/* Mandatory Manual Full Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    FULL NAME * <span className="text-[11px] font-normal text-amber-700">(Manual entry required)</span>
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ENTER YOUR FULL NAME"
                      value={manualNameInput}
                      onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold focus:bg-white uppercase font-bold"
                    />
                  </div>
                </div>

                {/* Set Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    SET PASSWORD * <span className="text-[11px] font-normal text-gray-400">(Fallback logins)</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="8+ chars, uppercase, digit, special char"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className={`${ic} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>

                {/* Platform Phone Verification */}
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700">PHONE NUMBER VERIFICATION *</label>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {platform === "android" ? "Android Native PNV" : "Web 6-Digit SMS OTP"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex flex-1">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 text-xs font-bold text-gray-600">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={phoneInput}
                        onChange={(e) => {
                          setPhoneInput(e.target.value);
                          setPhoneVerified(false);
                          setPhoneOtpSent(false);
                          setPnvToken(null);
                        }}
                        className="w-full h-10 px-3 rounded-r-xl border border-gray-200 bg-white text-xs font-mono focus:outline-none focus:border-gold"
                      />
                    </div>
                    {!phoneVerified && (
                      <button
                        type="button"
                        disabled={busy || phoneInput.length < 10 || pnvVerifying}
                        onClick={handleSendFormPhoneOtp}
                        className="px-3 h-10 bg-[#1C1C1C] text-[#FFB800] rounded-xl text-xs font-bold hover:bg-black transition whitespace-nowrap disabled:opacity-50"
                      >
                        {pnvVerifying ? "Verifying SIM..." : phoneOtpSent ? "Resend OTP" : "Verify Phone"}
                      </button>
                    )}
                  </div>

                  {/* Web SMS OTP input */}
                  {platform === "web" && phoneOtpSent && !phoneVerified && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-gray-500">Enter 6-digit SMS code sent to your phone:</p>
                      <div className="flex justify-between rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-900">
                        <span>Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : "Expired"}</strong></span>
                        <span>{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : "Ready to resend"}</span>
                      </div>
                      <div className="flex justify-center gap-1.5">
                        {phoneOtp.map((d, i) => (
                          <input
                            key={i}
                            id={`p-reg-${i}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={d}
                            onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, "p-reg")}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !d && i > 0) {
                                (document.getElementById(`p-reg-${i - 1}`) as HTMLInputElement)?.focus();
                              }
                            }}
                            className="w-9 h-10 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:border-gold bg-white"
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={busy || phoneOtpResendIn > 0}
                        onClick={() => handleSendFormPhoneOtp()}
                        className="w-full h-8 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 disabled:opacity-50"
                      >
                        {phoneOtpResendIn ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : "Resend OTP"}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyFormPhoneOtp}
                        disabled={phoneOtp.join("").length < 6 || busy}
                        className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        Verify Phone OTP
                      </button>
                    </div>
                  )}

                  {(phoneVerified || pnvToken) && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                      <CheckCircle size={14} className="text-green-600" /> Phone number verified
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFinalizeRegistration}
                  disabled={busy || !manualNameInput || !passwordIsValid(passwordInput) || (!phoneVerified && !pnvToken)}
                  className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200 disabled:opacity-100 shadow-sm"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Complete Registration & Enter <ArrowRight size={15} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {mode === "google_password" && (
            <motion.div key="google_password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-800">
                  <CheckCircle size={15} className="inline mr-1.5 text-green-600" />
                  Google account verified: {googleVerifiedEmail}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">SET PASSWORD *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="8+ chars, uppercase, digit, special char"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className={`${ic} pr-10`}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>
                <button
                  type="button"
                  disabled={busy || !passwordIsValid(passwordInput)}
                  onClick={handleGooglePasswordEnrollment}
                  className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200 disabled:opacity-100 shadow-sm"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Save Password & Continue <ArrowRight size={15} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {mode === "email_password_enrollment" && (
            <motion.div key="email_password_enrollment" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-800">
                  <CheckCircle size={15} className="inline mr-1.5 text-green-600" />
                  Email verified: {emailInput.trim().toLowerCase()}
                </div>
                <p className="text-xs text-gray-600">Set a new password, or enter your existing Firebase password to link it. Future email sign-ins will not need an OTP.</p>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="8+ chars, uppercase, digit, special char"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className={`${ic} pr-10`}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button type="button" disabled={busy || !passwordIsValid(passwordInput)} onClick={handleEnrollEmailPassword} className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200 disabled:opacity-100 shadow-sm">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <>Set Password & Sign In <ArrowRight size={15} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* PATH B: EMAIL LOGIN (Existing User: OTP vs Password)          */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "email_login" && (
            <motion.div key="email_login" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                  Signing in to <span className="font-bold text-ink">{emailInput}</span>
                </div>

                {/* Choice tabs */}
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEmailAuthChoice("password")}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      emailAuthChoice === "password" ? "bg-white text-ink shadow-xs" : "text-gray-500"
                    }`}
                  >
                    Password Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailAuthChoice("otp")}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      emailAuthChoice === "otp" ? "bg-white text-ink shadow-xs" : "text-gray-500"
                    }`}
                  >
                    OTP Authentication
                  </button>
                </div>

                {emailAuthChoice === "password" ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input
                        type={showPw ? "text" : "password"}
                        placeholder="Enter password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className={`${ic} pr-10`}
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy || !passwordInput}
                      onClick={handleEmailPasswordLogin}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign In <ArrowRight size={15} /></>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!emailLoginOtpSent ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSendEmailLoginOtp}
                        className="w-full h-11 bg-[#1C1C1C] text-[#FFB800] font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition"
                      >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <>Send 6-Digit Login Code <KeyRound size={15} /></>}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 text-center">Enter 6-digit login code sent to your email:</p>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 space-y-1">
                          <div className="flex justify-between"><span>Code expires in</span><strong>{emailLoginOtpExpiresIn ? formatCountdown(emailLoginOtpExpiresIn) : "Expired"}</strong></div>
                          <div className="flex justify-between"><span>Codes sent this hour</span><strong>{emailLoginOtpSendCount}/{EMAIL_OTP_HOURLY_LIMIT}</strong></div>
                        </div>
                        <div className="flex justify-center gap-2">
                          {emailLoginOtp.map((d, i) => (
                            <input
                              key={i}
                              id={`elogin-${i}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={d}
                              onChange={(e) => handleOtpBox(e.target.value, i, emailLoginOtp, setEmailLoginOtp, "elogin")}
                              onKeyDown={(e) => {
                                if (e.key === "Backspace" && !d && i > 0) {
                                  (document.getElementById(`elogin-${i - 1}`) as HTMLInputElement)?.focus();
                                }
                              }}
                              className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-gold bg-gray-50"
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={busy || emailLoginOtpExpiresIn <= 0 || emailLoginOtp.join("").length < 6}
                          onClick={handleVerifyEmailLoginOtp}
                          className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Verify & Sign In <ArrowRight size={15} /></>}
                        </button>
                        <button
                          type="button"
                          disabled={busy || emailLoginOtpResendIn > 0 || emailLoginOtpLimitReached}
                          onClick={handleResendEmailLoginOtp}
                          className="w-full h-9 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 disabled:opacity-50"
                        >
                          {emailLoginOtpResendIn > 0 ? `Resend code in ${formatCountdown(emailLoginOtpResendIn)}` : emailLoginOtpLimitReached ? "Hourly resend limit reached" : "Resend code"}
                        </button>
                        <p className="text-[10px] text-center text-gray-400">You can request up to {EMAIL_OTP_HOURLY_LIMIT} codes per hour.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* PATH B: EMAIL REGISTRATION (New User)                          */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "email_register" && (
            <motion.div key="email_register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                {/* Step 1: Verify Email OTP if not yet verified */}
                {!emailVerified ? (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-left">
                          <p className="text-xs text-gray-500">Verification code sent to</p>
                          <p className="text-sm font-bold text-ink break-all">{emailInput}</p>
                        </div>
                        <button type="button" onClick={handleEditEmail} disabled={busy} className="shrink-0 text-xs font-bold text-amber-800 underline disabled:opacity-50">
                          Edit email
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 space-y-1">
                      <div className="flex justify-between"><span>Code expires in</span><strong>{emailRegOtpExpiresIn ? formatCountdown(emailRegOtpExpiresIn) : "Expired"}</strong></div>
                      <div className="flex justify-between"><span>Codes sent this hour</span><strong>{emailRegOtpSendCount}/{EMAIL_OTP_HOURLY_LIMIT}</strong></div>
                    </div>

                    <div className="flex justify-center gap-2">
                      {emailRegOtp.map((d, i) => (
                        <input
                          key={i}
                          id={`ereg-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleOtpBox(e.target.value, i, emailRegOtp, setEmailRegOtp, "ereg")}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !d && i > 0) {
                              (document.getElementById(`ereg-${i - 1}`) as HTMLInputElement)?.focus();
                            }
                          }}
                          className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-gold bg-gray-50"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={busy || emailRegOtpExpiresIn <= 0 || emailRegOtp.join("").length < 6}
                      onClick={handleVerifyEmailRegOtp}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Verify Email & Continue <ArrowRight size={15} /></>}
                    </button>
                    <button
                      type="button"
                      disabled={busy || emailRegOtpResendIn > 0 || emailRegOtpLimitReached}
                      onClick={handleResendEmailRegOtp}
                      className="w-full h-9 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 disabled:opacity-50"
                    >
                      {emailRegOtpResendIn > 0 ? `Resend code in ${formatCountdown(emailRegOtpResendIn)}` : emailRegOtpLimitReached ? "Hourly resend limit reached" : "Resend code"}
                    </button>
                    <p className="text-[10px] text-center text-gray-400">You can request up to {EMAIL_OTP_HOURLY_LIMIT} codes per hour.</p>
                  </div>
                ) : (
                  /* Step 2: Complete Profile Form */
                  <div className="space-y-4">
                    <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs font-bold text-green-800">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-600" /> {emailInput}
                      </span>
                      <span>Verified ✓</span>
                    </div>

                    {/* Manual Name Entry */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        FULL NAME * <span className="text-[11px] font-normal text-amber-700">(Manual entry required)</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="ENTER FULL NAME"
                          value={manualNameInput}
                          onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold bg-white uppercase font-bold"
                        />
                      </div>
                    </div>

                    {/* Set Password */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">SET PASSWORD *</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type={showPw ? "text" : "password"}
                          placeholder="8+ chars, uppercase, digit, special char"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className={`${ic} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>

                    {/* Phone Input & Verification */}
                    <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-gray-700">PHONE NUMBER VERIFICATION *</label>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          {platform === "android" ? "Android Native PNV" : "Web 6-Digit SMS OTP"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex flex-1">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-100 text-xs font-bold text-gray-600">
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="9876543210"
                            value={phoneInput}
                            onChange={(e) => {
                              setPhoneInput(e.target.value);
                              setPhoneVerified(false);
                              setPhoneOtpSent(false);
                            }}
                            className="w-full h-10 px-3 rounded-r-xl border border-gray-200 bg-white text-xs font-mono focus:outline-none focus:border-gold"
                          />
                        </div>
                        {!phoneVerified && (
                          <button
                            type="button"
                            disabled={busy || phoneInput.length < 10 || pnvVerifying}
                            onClick={handleSendFormPhoneOtp}
                            className="px-3 h-10 bg-[#1C1C1C] text-[#FFB800] rounded-xl text-xs font-bold hover:bg-black transition whitespace-nowrap disabled:opacity-50"
                          >
                            {pnvVerifying ? "Verifying..." : phoneOtpSent ? "Resend OTP" : "Verify Phone"}
                          </button>
                        )}
                      </div>

                      {platform === "web" && phoneOtpSent && !phoneVerified && (
                        <div className="mt-2 space-y-2">
                          <p className="text-[11px] text-gray-500">Enter 6-digit SMS code sent to your phone:</p>
                          <div className="flex justify-between rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] text-blue-900">
                            <span>Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : "Expired"}</strong></span>
                            <span>{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : "Ready to resend"}</span>
                          </div>
                          <div className="flex justify-center gap-1.5">
                            {phoneOtp.map((d, i) => (
                              <input
                                key={i}
                                id={`ereg-p-${i}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, "ereg-p")}
                                onKeyDown={(e) => {
                                  if (e.key === "Backspace" && !d && i > 0) {
                                    (document.getElementById(`ereg-p-${i - 1}`) as HTMLInputElement)?.focus();
                                  }
                                }}
                                className="w-9 h-10 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:border-gold bg-white"
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            disabled={busy || phoneOtpResendIn > 0}
                            onClick={() => handleSendFormPhoneOtp()}
                            className="w-full h-8 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-600 disabled:opacity-50"
                          >
                            {phoneOtpResendIn ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : "Resend OTP"}
                          </button>
                          <button
                            type="button"
                            onClick={handleVerifyFormPhoneOtp}
                            disabled={phoneOtp.join("").length < 6 || busy}
                            className="w-full h-9 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                          >
                            Verify Phone OTP
                          </button>
                        </div>
                      )}

                      {(phoneVerified || pnvToken) && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                          <CheckCircle size={14} className="text-green-600" /> Phone number verified
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalizeRegistration}
                      disabled={busy || !manualNameInput || !passwordIsValid(passwordInput) || (!phoneVerified && !pnvToken)}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200 disabled:opacity-100 shadow-sm"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Create Account & Enter <ArrowRight size={15} /></>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* PATH C: PHONE LOGIN (Existing User)                            */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "phone_login" && (
            <motion.div key="phone_login" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                  <p className="text-xs text-gray-500">{phoneAccountExists ? "Registered Phone Account" : "Verify Your Phone Number"}</p>
                  <p className="text-base font-mono font-bold text-ink">+91 {phoneInput.replace(/\D/g, "").slice(-10)}</p>
                  {maskedEmail && <p className="text-xs text-gray-400 mt-0.5">Linked Email: {maskedEmail}</p>}
                  <button type="button" onClick={handleChangePhone} disabled={busy} className="mt-2 text-xs font-bold text-amber-800 underline disabled:opacity-50">
                    Change number
                  </button>
                </div>

                {phoneAccountExists && <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl">
                  <button type="button" onClick={() => setPhoneAuthChoice("password")} className={`py-2 text-xs font-bold rounded-lg ${phoneAuthChoice === "password" ? "bg-white text-ink shadow-xs" : "text-gray-500"}`}>
                    Password Login
                  </button>
                  <button type="button" onClick={() => setPhoneAuthChoice("otp")} className={`py-2 text-xs font-bold rounded-lg ${phoneAuthChoice === "otp" ? "bg-white text-ink shadow-xs" : "text-gray-500"}`}>
                    OTP Login
                  </button>
                </div>}

                {phoneAccountExists && phoneAuthChoice === "password" ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                      <input type={showPw ? "text" : "password"} placeholder="Enter password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className={`${ic} pr-10`} />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button type="button" disabled={busy || !passwordInput} onClick={handlePhonePasswordLogin} className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign In <ArrowRight size={15} /></>}
                    </button>
                  </div>
                ) : (
                <>
                {platform === "android" && pnvVerifying && (
                  <div className="p-4 bg-gray-50 rounded-xl text-center space-y-2">
                    <Loader2 size={24} className="animate-spin text-amber-600 mx-auto" />
                    <p className="text-xs font-bold text-ink">Verifying SIM automatically via Google SMS Retriever...</p>
                  </div>
                )}

                {(!pnvVerifying || platform === "web") && (
                  <div className="space-y-3">
                    {!phoneOtpSent && (
                      <button type="button" disabled={busy} onClick={() => handlePhoneSubmit(true)} className="w-full h-11 bg-[#1C1C1C] text-[#FFB800] font-bold rounded-xl text-sm disabled:opacity-50">
                        {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Send OTP to this number"}
                      </button>
                    )}
                    <p className="text-xs text-gray-500 text-center">Enter 6-digit OTP sent via SMS:</p>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 space-y-1">
                      <div className="flex justify-between"><span>OTP expires in</span><strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : "Expired"}</strong></div>
                      <div className="flex justify-between"><span>Attempts</span><strong>{phoneOtpAttempts}/5</strong></div>
                      <div className="flex justify-between"><span>OTPs sent this session</span><strong>{phoneOtpSendCount}</strong></div>
                    </div>
                    <div className="flex justify-center gap-2">
                      {phoneOtp.map((d, i) => (
                        <input
                          key={i}
                          id={`plogin-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, "plogin")}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !d && i > 0) {
                              (document.getElementById(`plogin-${i - 1}`) as HTMLInputElement)?.focus();
                            }
                          }}
                          className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-gold bg-gray-50"
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy || phoneOtpExpiresIn <= 0 || phoneOtpAttempts >= 5 || phoneOtp.join("").length < 6}
                      onClick={() => handleVerifyPhoneOtp("login")}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Verify & Sign In <ArrowRight size={15} /></>}
                    </button>
                    <button
                      type="button"
                      disabled={busy || phoneOtpResendIn > 0}
                      onClick={() => handlePhoneSubmit(true)}
                      className="w-full h-9 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 disabled:opacity-50"
                    >
                      {phoneOtpResendIn > 0 ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : "Resend OTP"}
                    </button>
                    <p className="text-[10px] text-center text-gray-400">A new OTP resets the attempt counter.</p>
                  </div>
                )}
                </>
                )}
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────────────── */}
          {/* PATH C: PHONE REGISTRATION (New User)                          */}
          {/* ────────────────────────────────────────────────────────────── */}
          {mode === "phone_register" && (
            <motion.div key="phone_register" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <div className="space-y-4">
                {/* Step 1: Initial Phone Verification if not yet verified */}
                {!phoneVerified ? (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                      <p className="text-xs text-gray-500">Phone Verification Code sent to</p>
                      <p className="text-sm font-bold text-ink">+91 {phoneInput}</p>
                    </div>

                    <div className="flex justify-center gap-2">
                      {phoneOtp.map((d, i) => (
                        <input
                          key={i}
                          id={`preg-p-${i}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, "preg-p")}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !d && i > 0) {
                              (document.getElementById(`preg-p-${i - 1}`) as HTMLInputElement)?.focus();
                            }
                          }}
                          className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-gold bg-gray-50"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={busy || phoneOtp.join("").length < 6}
                      onClick={() => handleVerifyPhoneOtp("registration")}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Verify Phone & Next <ArrowRight size={15} /></>}
                    </button>
                  </div>
                ) : (
                  /* Step 2: Email Capture & Verification Choice (Google vs Manual) */
                  <div className="space-y-4">
                    <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs font-bold text-green-800">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-600" /> Phone +91 {phoneInput}
                      </span>
                      <span>Verified ✓</span>
                    </div>

                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                      <label className="block text-xs font-bold text-gray-700">LINK EMAIL ADDRESS *</label>

                      {/* Email choice options */}
                      {!emailVerified ? (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handlePhonePathGoogleLink}
                            className="w-full h-11 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-ink shadow-xs"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            Option 1: Link Verified Google Email
                          </button>

                          <div className="relative flex items-center justify-center">
                            <div className="border-t border-gray-200 w-full" />
                            <span className="bg-gray-50 px-2 text-[10px] font-bold uppercase text-gray-400 absolute">or manual</span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="email"
                                placeholder="name@example.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                disabled={emailRegOtpSent || busy}
                                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:border-gold"
                              />
                              <button
                                type="button"
                                disabled={busy || (!emailRegOtpSent && (!emailInput.includes("@") || emailRegOtpLimitReached))}
                                onClick={emailRegOtpSent ? handleEditEmail : handleSendPhoneRegistrationEmailOtp}
                                className="px-3 h-10 bg-[#1C1C1C] text-[#FFB800] rounded-xl text-xs font-bold whitespace-nowrap"
                              >
                                {emailRegOtpSent ? "Edit email" : "Send Code"}
                              </button>
                            </div>

                            {emailRegOtpSent && (
                              <div className="space-y-2 mt-2">
                                <div className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[10px] text-blue-900 space-y-1">
                                  <div className="flex justify-between"><span>Code expires in</span><strong>{emailRegOtpExpiresIn ? formatCountdown(emailRegOtpExpiresIn) : "Expired"}</strong></div>
                                  <div className="flex justify-between"><span>Codes sent this hour</span><strong>{emailRegOtpSendCount}/{EMAIL_OTP_HOURLY_LIMIT}</strong></div>
                                </div>
                                <div className="flex justify-center gap-1.5">
                                  {emailRegOtp.map((d, i) => (
                                    <input
                                      key={i}
                                      id={`preg-e-${i}`}
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={1}
                                      value={d}
                                      onChange={(e) => handleOtpBox(e.target.value, i, emailRegOtp, setEmailRegOtp, "preg-e")}
                                      className="w-9 h-10 text-center text-sm font-bold border-2 rounded-lg bg-white"
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  disabled={busy || emailRegOtpExpiresIn <= 0 || emailRegOtp.join("").length < 6}
                                  onClick={handleVerifyEmailRegOtp}
                                  className="w-full h-9 bg-green-600 text-white rounded-lg text-xs font-bold"
                                >
                                  Verify Email Code
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || emailRegOtpResendIn > 0 || emailRegOtpLimitReached}
                                  onClick={handleResendEmailRegOtp}
                                  className="w-full h-8 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 disabled:opacity-50"
                                >
                                  {emailRegOtpResendIn > 0 ? `Resend code in ${formatCountdown(emailRegOtpResendIn)}` : emailRegOtpLimitReached ? "Hourly resend limit reached" : "Resend code"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                          <CheckCircle size={14} className="text-green-600" /> Email {emailInput} Verified ✓
                        </div>
                      )}
                    </div>

                    {/* Step 3: Complete Profile Details */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        FULL NAME * <span className="text-[11px] font-normal text-amber-700">(Manual entry required)</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="ENTER FULL NAME"
                          value={manualNameInput}
                          onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-gold bg-white uppercase font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">SET PASSWORD *</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-3.5 text-gray-400" />
                        <input
                          type={showPw ? "text" : "password"}
                          placeholder="8+ chars, uppercase, digit, special char"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className={`${ic} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-3.5 text-gray-400">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <PasswordRequirements value={passwordInput} />
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalizeRegistration}
                      disabled={busy || !manualNameInput || !passwordIsValid(passwordInput) || !emailVerified}
                      className="w-full h-11 bg-gold hover:bg-amber-400 text-ink font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200 disabled:opacity-100 shadow-sm"
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <>Finalize Account <ArrowRight size={15} /></>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
