import React, { useState } from "react";
import type { Auth } from "firebase/auth";
import { usePublicSignIn } from "@zolexora/auth-client/public-sign-in";
import { Card, Field, Message, Turnstile, authPost, styles } from "./ui";

export interface PublicSignInProps {
  /** Zolexora auth service public URL (Infisical: AUTH_SERVICE_PUBLIC_URL). */
  authUrl: string;
  /** Cloudflare Turnstile site key (Infisical: TURNSTILE_SITE_KEY). */
  turnstileSiteKey: string;
  /** Firebase Auth of the auth service's Firebase project (Google + SMS verification). */
  firebaseAuth: Auth | (() => Auth);
  /** Shown under the first title, e.g. "Zolexora Shop". */
  brand: string;
  /** Button colour. */
  accent?: string;
  /** Called once the auth-service session is stored. */
  onSignedIn?: () => void;
}

type Mode = "flow" | "reset" | "reset_confirm";

/**
 * Track 1 sign-in for buyers and sellers: Continue with Google, email or phone. New accounts verify
 * their email (and phone when the auth service requires it), then set a name and password. The
 * session belongs to the Zolexora auth service; ZolexoraAuthProvider stores it.
 */
export function PublicSignIn({ authUrl, turnstileSiteKey, firebaseAuth, brand, accent = "#111827", onSignedIn }: PublicSignInProps) {
  const flow = usePublicSignIn({ firebaseAuth, authUrl, product: "marketplace", onSignedIn });
  const [mode, setMode] = useState<Mode>("flow");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const button = { ...styles.button, background: accent };
  // Turnstile tokens are single-use: render a fresh widget after every attempt.
  const withTurnstile = async (action: (token: string) => Promise<unknown>) => {
    const token = turnstileToken;
    setTurnstileToken("");
    try {
      await action(token);
    } finally {
      setTurnstileKey((k) => k + 1);
    }
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setTurnstileKey((k) => k + 1);
    }
  };
  const submit = (action: () => unknown) => (e: React.FormEvent) => {
    e.preventDefault();
    action();
  };
  const restart = () => {
    flow.restart();
    setPassword("");
    setCode("");
    setNotice(null);
  };
  const startOver = <button type="button" style={styles.link} onClick={restart}>Use a different account</button>;
  const flowError = <Message error={flow.error?.message ?? null} notice={notice} />;
  const turnstile = (action: string) => <Turnstile key={turnstileKey} siteKey={turnstileSiteKey} action={action} onToken={setTurnstileToken} />;

  if (mode === "reset") {
    return (
      <Card title="Reset your password" subtitle="We'll email you a reset code">
        <form onSubmit={submit(() => run(async () => {
          await authPost(authUrl, "/api/v1/auth/public/reset-password", { email: email.trim(), turnstile_token: turnstileToken });
          setMode("reset_confirm");
        }))}>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {turnstile("track1-public-reset-password")}
          <Message error={error} />
          <button style={button} disabled={busy || !turnstileToken}>{busy ? "Sending…" : "Send code"}</button>
          <div style={styles.row}><button type="button" style={styles.link} onClick={() => setMode("flow")}>Back to sign in</button></div>
        </form>
      </Card>
    );
  }
  if (mode === "reset_confirm") {
    return (
      <Card title="Choose a new password" subtitle={`If ${email} has an account, a code was sent to it`}>
        <form onSubmit={submit(() => run(async () => {
          await authPost(authUrl, "/api/v1/auth/public/reset-password/confirm", { email: email.trim(), otp: code.trim(), new_password: password });
          restart();
          setMode("flow");
          setNotice("Password changed. Sign in with your new password.");
        }))}>
          <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Field label="New password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Message error={error} />
          <button style={button} disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </form>
      </Card>
    );
  }

  switch (flow.step) {
    case "start":
      return (
        <Card title="Sign in or create an account" subtitle={brand}>
          <button type="button" style={styles.ghost} disabled={flow.busy || !turnstileToken}
            onClick={() => withTurnstile((t) => flow.continueWithGoogle(t))}>
            Continue with Google
          </button>
          <div style={styles.tabs}>
            {(["email", "phone"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                style={{ ...styles.link, textDecoration: "none", padding: 8, borderRadius: 8, background: method === m ? "#fff" : "transparent", fontWeight: 600 }}>
                {m === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>
          <form onSubmit={submit(() => withTurnstile((t) => (method === "email" ? flow.continueWithEmail(email, t) : flow.continueWithPhone(phone, t))))}>
            {method === "email"
              ? <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              : <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />}
            {turnstile("track1-public-continue")}
            {flowError}
            <button style={button} disabled={flow.busy || !turnstileToken}>{flow.busy ? "Please wait…" : "Continue"}</button>
          </form>
          <div id="zx-recaptcha" />
        </Card>
      );
    case "password":
      return (
        <Card title="Enter your password" subtitle={flow.email ?? flow.phoneNumber ?? ""}>
          <form onSubmit={submit(() => withTurnstile((t) => flow.signInWithPassword(password, t)))}>
            <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {turnstile("track1-public-login")}
            {flowError}
            <button style={button} disabled={flow.busy || !turnstileToken}>{flow.busy ? "Signing in…" : "Sign in"}</button>
            <div style={styles.row}>
              {startOver}
              <button type="button" style={styles.link} onClick={() => { setEmail(flow.email ?? ""); setMode("reset"); }}>Forgot password?</button>
            </div>
          </form>
        </Card>
      );
    case "verify_email":
      return (
        <Card title="Verify your email" subtitle={`Enter the code sent to ${flow.email}`}>
          <form onSubmit={submit(() => flow.verifyEmailCode(code).then((ok) => { if (ok) setCode(""); }))}>
            <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            {flowError}
            <button style={button} disabled={flow.busy}>{flow.busy ? "Checking…" : "Verify email"}</button>
            <div style={styles.row}>{startOver}</div>
          </form>
        </Card>
      );
    case "enter_email":
      return (
        <Card title="Add your email" subtitle="We'll email you a verification code">
          <form onSubmit={submit(() => flow.sendEmailCode(email))}>
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {flowError}
            <button style={button} disabled={flow.busy}>{flow.busy ? "Sending…" : "Send code"}</button>
            <div style={styles.row}>{startOver}</div>
          </form>
        </Card>
      );
    case "enter_phone":
      return (
        <Card title="Your mobile number" subtitle={flow.mobileVerificationRequired ? "We'll text you a verification code" : "Used for delivery updates"}>
          <form onSubmit={submit(() => flow.sendPhoneCode(phone))}>
            <Field label="Phone (with country code)" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {flowError}
            <button style={button} disabled={flow.busy}>{flow.busy ? "Please wait…" : flow.mobileVerificationRequired ? "Send code" : "Continue"}</button>
            <div style={styles.row}>{startOver}</div>
          </form>
          <div id="zx-recaptcha" />
        </Card>
      );
    case "verify_phone":
      return (
        <Card title="Enter the SMS code" subtitle={`Sent to ${flow.phoneNumber}`}>
          <form onSubmit={submit(() => flow.verifyPhoneCode(code).then((ok) => { if (ok) setCode(""); }))}>
            <Field label="SMS code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            {flowError}
            <button style={button} disabled={flow.busy}>{flow.busy ? "Checking…" : "Verify number"}</button>
            <div style={styles.row}>{startOver}</div>
          </form>
        </Card>
      );
    case "profile":
      return (
        <Card title="Finish your account" subtitle={[flow.email, flow.phoneNumber].filter(Boolean).join(" · ")}>
          <form onSubmit={submit(() => flow.completeProfile(name || flow.suggestedName || "", password))}>
            <Field label="Full name" autoComplete="name" value={name || flow.suggestedName || ""} onChange={(e) => setName(e.target.value)} />
            <Field label="Set a password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
            {flowError}
            <button style={button} disabled={flow.busy}>{flow.busy ? "Creating…" : "Create account"}</button>
          </form>
        </Card>
      );
    default:
      return <Card title="Signing you in…" />;
  }
}
