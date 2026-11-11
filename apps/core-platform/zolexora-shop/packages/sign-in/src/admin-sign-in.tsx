import React, { useState } from "react";
import { useAuth } from "@zolexora/auth-client/react";
import { Card, Field, Message, Turnstile, styles } from "./ui";

export interface AdminSignInProps {
  turnstileSiteKey: string;
  accent?: string;
  onSignedIn?: () => void;
}

/** Track 3: Zolexora platform admins (created and managed in platform-admin). */
export function AdminSignIn({ turnstileSiteKey, accent = "#111827", onSignedIn }: AdminSignInProps) {
  const { adminSignIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminSignIn({ email: email.trim(), password, turnstileToken });
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1);
    }
  };

  return (
    <Card title="Marketplace administration" subtitle="Sign in with your Zolexora platform admin account">
      <form onSubmit={submit}>
        <Field label="Email or username" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Turnstile key={turnstileKey} siteKey={turnstileSiteKey} action="track3-admin-login" onToken={setTurnstileToken} />
        <Message error={error} />
        <button style={{ ...styles.button, background: accent }} disabled={busy || !turnstileToken}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Card>
  );
}
