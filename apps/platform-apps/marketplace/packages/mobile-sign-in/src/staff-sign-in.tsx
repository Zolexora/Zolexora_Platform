import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileConfig, storeSessionToken } from "./session";
import { TurnstileWebView } from "./turnstile";

const ORG_ID = /^ZX-ORG-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

/** Track 2: staff of a Zolexora organisation sign in with its ZX-ORG id (auth-service employee login). */
export function MobileStaffSignIn({ brand, accent = "#111827", onSignedIn }: { brand: string; accent?: string; onSignedIn: () => void }) {
  const config = mobileConfig();
  const [orgId, setOrgId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleanOrgId = orgId.trim().toUpperCase();
    if (!ORG_ID.test(cleanOrgId)) { setError("Invalid Organisation ID. Expected ZX-ORG-XXXX-XXXX-XXXX"); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${config.authServiceUrl}/api/v1/auth/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Turnstile-Token": turnstileToken },
        body: JSON.stringify({ product: "marketplace", org_id: cleanOrgId, user_id_or_email: staffId.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false || !data.customToken) throw new Error(data.message || data.error?.message || "Sign-in failed.");
      await storeSessionToken(data.customToken);
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1); // Turnstile tokens are single-use
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#F9FAFB" }} {...props} />
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" }}>{brand} staff</Text>
        <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4, marginBottom: 20 }}>Sign in to your organisation</Text>
        {field("Organisation ID", orgId, (v) => setOrgId(v.toUpperCase()), { autoCapitalize: "characters", placeholder: "ZX-ORG-XXXX-XXXX-XXXX" })}
        {field("Corporate email or user ID", staffId, setStaffId, { autoComplete: "username" })}
        {field("Password", password, setPassword, { secureTextEntry: true, autoComplete: "password" })}
        <TurnstileWebView key={turnstileKey} siteKey={config.turnstileSiteKey} action="track2-employee-login" baseUrl={config.authServiceUrl} onToken={setTurnstileToken} />
        {error && <Text style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>{error}</Text>}
        <TouchableOpacity onPress={submit} disabled={busy || !turnstileToken}
          style={{ backgroundColor: accent, borderRadius: 10, padding: 14, alignItems: "center", opacity: busy || !turnstileToken ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Sign in as staff</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
