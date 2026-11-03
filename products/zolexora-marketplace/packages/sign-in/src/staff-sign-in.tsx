import React, { useState } from "react";
import { useAuth } from "@zolexora/auth-client/react";
import { isPublicWebmailDomain, isValidZolexoraOrgId } from "@zolexora/auth-client";
import { Card, Field, Message, Turnstile, styles } from "./ui";

export interface StaffSignInProps {
  turnstileSiteKey: string;
  brand?: string;
  accent?: string;
  onSignedIn?: () => void;
}

/** Track 2: staff of a Zolexora organisation (ZX-ORG id), created by its owner in the auth service. */
export function StaffSignIn({ turnstileSiteKey, brand = "Zolexora", accent = "#111827", onSignedIn }: StaffSignInProps) {
  const { orgSignIn } = useAuth();
  const [orgId, setOrgId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webmail = staffId.includes("@") && isPublicWebmailDomain(staffId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrgId = orgId.trim().toUpperCase();
    if (!isValidZolexoraOrgId(cleanOrgId)) {
      setError("Invalid Organisation ID. Expected ZX-ORG-XXXX-XXXX-XXXX");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await orgSignIn({ product: "marketplace", org_id: cleanOrgId, user_id_or_email: staffId.trim(), password, turnstileToken });
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
    <Card title={`${brand} staff`} subtitle="Sign in to your organisation">
      <form onSubmit={submit}>
        <Field label="Organisation ID" placeholder="ZX-ORG-XXXX-XXXX-XXXX" value={orgId} onChange={(e) => setOrgId(e.target.value.toUpperCase())} />
        <Field label="Corporate email or user ID" autoComplete="username" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
        {webmail && <Message error="Staff accounts use a corporate email or employee ID." />}
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Turnstile key={turnstileKey} siteKey={turnstileSiteKey} action="track2-employee-login" onToken={setTurnstileToken} />
        <Message error={error} />
        <button style={{ ...styles.button, background: accent }} disabled={busy || webmail || !turnstileToken}>{busy ? "Signing in…" : "Sign in as staff"}</button>
      </form>
    </Card>
  );
}
