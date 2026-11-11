import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileConfig, storeSessionToken } from "./session";
import { TurnstileWebView } from "./turnstile";

type Step = "email" | "password" | "verify_email" | "verify_phone" | "profile" | "reset" | "reset_confirm" | "phone_blocked";

async function post<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${mobileConfig().authServiceUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || "Something went wrong.");
  return data;
}

/**
 * Track 1 sign-in for the marketplace apps: email first, then password (existing account) or the
 * emailed code, mobile number, name and password (new account). The session token is the Zolexora
 * auth service's; it is kept in SecureStore. Google and SMS verification need the web app.
 */
export function MobileSignIn({ brand, accent = "#111827", onSignedIn }: { brand: string; accent?: string; onSignedIn: () => void }) {
  const config = mobileConfig();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1); // Turnstile tokens are single-use
    }
  };
  const done = async (data: { customToken?: string }) => {
    if (!data.customToken) throw new Error("Sign-in failed.");
    await storeSessionToken(data.customToken);
    onSignedIn();
  };
  const signupStep = async (data: { next: string; signup_token: string }) => {
    setSignupToken(data.signup_token);
    if (data.next === "verify_phone") {
      const cfg = await fetch(`${config.authServiceUrl}/api/v1/auth/public/config`).then((r) => r.json()).catch(() => ({}));
      setStep(cfg.mobile_verification_required ? "phone_blocked" : "verify_phone");
    } else setStep(data.next as Step);
    setCode("");
  };
  const restart = () => { setStep("email"); setPassword(""); setCode(""); setSignupToken(""); setError(null); };

  const turnstile = (action: string) => (
    <TurnstileWebView key={turnstileKey} siteKey={config.turnstileSiteKey} action={action} baseUrl={config.authServiceUrl} onToken={setTurnstileToken} />
  );
  const field = (label: string, value: string, onChange: (v: string) => void, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#F9FAFB" }} {...props} />
    </View>
  );
  const button = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity onPress={onPress} disabled={busy || disabled}
      style={{ backgroundColor: accent, borderRadius: 10, padding: 14, alignItems: "center", opacity: busy || disabled ? 0.6 : 1 }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>}
    </TouchableOpacity>
  );
  const link = (label: string, onPress: () => void) => (
    <TouchableOpacity onPress={onPress} style={{ paddingVertical: 12, alignItems: "center" }}>
      <Text style={{ color: "#4B5563", textDecorationLine: "underline" }}>{label}</Text>
    </TouchableOpacity>
  );

  let title = "Sign in or create an account";
  let body: React.ReactNode = null;
  switch (step) {
    case "email":
      body = <>
        {field("Email", email, setEmail, { keyboardType: "email-address", autoComplete: "email" })}
        {turnstile("track1-public-continue")}
        {button("Continue", () => run(async () => {
          const data = await post("/api/v1/auth/public/identify", { email: email.trim(), turnstile_token: turnstileToken });
          setStep(data.next === "password" ? "password" : "verify_email");
        }), !turnstileToken || !email.trim())}
      </>;
      break;
    case "password":
      title = "Enter your password";
      body = <>
        {field("Password", password, setPassword, { secureTextEntry: true, autoComplete: "current-password" })}
        {turnstile("track1-public-login")}
        {button("Sign in", () => run(async () => done(await post("/api/v1/auth/public/login",
          { email: email.trim(), password, product: "marketplace", turnstile_token: turnstileToken }))), !turnstileToken || !password)}
        {link("Forgot password?", () => { setError(null); setStep("reset"); })}
        {link("Use a different email", restart)}
      </>;
      break;
    case "verify_email":
      title = "Verify your email";
      body = <>
        <Text style={{ color: "#6B7280", marginBottom: 12 }}>Enter the code sent to {email.trim()}</Text>
        {field("Verification code", code, setCode, { keyboardType: "number-pad", autoComplete: "one-time-code" })}
        {button("Verify email", () => run(async () => signupStep(await post("/api/v1/auth/public/signup/email/verify",
          { email: email.trim(), otp: code.trim(), signup_token: signupToken || undefined }))), !code.trim())}
        {link("Use a different email", restart)}
      </>;
      break;
    case "verify_phone":
      title = "Your mobile number";
      body = <>
        {field("Phone (with country code)", phone, setPhone, { keyboardType: "phone-pad", autoComplete: "tel", placeholder: "+919876543210" })}
        {button("Continue", () => run(async () => signupStep(await post("/api/v1/auth/public/signup/phone",
          { signup_token: signupToken, phone_number: phone.replace(/\s+/g, "") }))), !phone.trim())}
        {link("Start over", restart)}
      </>;
      break;
    case "phone_blocked":
      title = "Verify your mobile number";
      body = <>
        <Text style={{ color: "#6B7280", marginBottom: 12 }}>
          New accounts need an SMS-verified mobile number. Create your account on the {brand} website, then sign in here.
        </Text>
        {link("Back", restart)}
      </>;
      break;
    case "profile":
      title = "Finish your account";
      body = <>
        {field("Full name", name, setName, { autoCapitalize: "words", autoComplete: "name" })}
        {field("Set a password (12+ characters)", password, setPassword, { secureTextEntry: true, autoComplete: "new-password" })}
        {button("Create account", () => run(async () => done(await post("/api/v1/auth/public/signup/complete",
          { signup_token: signupToken, display_name: name.trim(), password, product: "marketplace" }))), !name.trim() || password.length < 12)}
      </>;
      break;
    case "reset":
      title = "Reset your password";
      body = <>
        {field("Email", email, setEmail, { keyboardType: "email-address", autoComplete: "email" })}
        {turnstile("track1-public-reset-password")}
        {button("Send code", () => run(async () => {
          await post("/api/v1/auth/public/reset-password", { email: email.trim(), turnstile_token: turnstileToken });
          setPassword("");
          setStep("reset_confirm");
        }), !turnstileToken || !email.trim())}
        {link("Back to sign in", restart)}
      </>;
      break;
    case "reset_confirm":
      title = "Choose a new password";
      body = <>
        <Text style={{ color: "#6B7280", marginBottom: 12 }}>If {email.trim()} has an account, a code was sent to it.</Text>
        {field("Reset code", code, setCode, { keyboardType: "number-pad", autoComplete: "one-time-code" })}
        {field("New password (12+ characters)", password, setPassword, { secureTextEntry: true, autoComplete: "new-password" })}
        {button("Change password", () => run(async () => {
          await post("/api/v1/auth/public/reset-password/confirm", { email: email.trim(), otp: code.trim(), new_password: password });
          restart();
          setNotice("Password changed. Sign in with your new password.");
        }), !code.trim() || password.length < 12)}
      </>;
      break;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>{brand}</Text>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 20 }}>{title}</Text>
        {notice && <Text style={{ color: "#047857", marginBottom: 12, textAlign: "center" }}>{notice}</Text>}
        {body}
        {error && <Text style={{ color: "#B91C1C", marginTop: 12, textAlign: "center" }}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
