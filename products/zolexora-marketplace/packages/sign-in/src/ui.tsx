import React from "react";
import { TurnstileWidget } from "@zolexora/auth-client/turnstile";

export const styles = {
  card: { maxWidth: 400, margin: "40px auto", padding: 28, borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,.06)", fontFamily: "inherit" },
  title: { fontSize: 20, fontWeight: 700, margin: 0, textAlign: "center", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", margin: "6px 0 20px", textAlign: "center" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 14 },
  input: { width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14 },
  button: { width: "100%", padding: "11px 14px", borderRadius: 10, border: 0, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  ghost: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  link: { background: "none", border: 0, color: "#4b5563", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 14 },
  notice: { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 14 },
  row: { display: "flex", justifyContent: "space-between", marginTop: 14 },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, margin: "16px 0" },
} satisfies Record<string, React.CSSProperties>;

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.subtitle}>{subtitle || " "}</p>
      {children}
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} required {...props} />
    </label>
  );
}

export function Message({ error, notice }: { error?: string | null; notice?: string | null }) {
  if (error) return <div role="alert" style={styles.error}>{error}</div>;
  if (notice) return <div style={styles.notice}>{notice}</div>;
  return null;
}

export function Turnstile({ siteKey, action, onToken }: { siteKey: string; action: string; onToken: (t: string) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
      <TurnstileWidget siteKey={siteKey} action={action} onVerify={onToken} onExpire={() => onToken("")} />
    </div>
  );
}

/** POSTs to a Zolexora auth-service endpoint; throws the service's message on failure. */
export async function authPost(authUrl: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`${authUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || "Request failed");
  return data;
}
