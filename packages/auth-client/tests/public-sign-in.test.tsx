import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";

const fb = vi.hoisted(() => ({
  popup: vi.fn(),
  phone: vi.fn(),
  signOut: vi.fn(async () => {}),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  RecaptchaVerifier: class { clear() {} },
  signInWithPopup: fb.popup,
  signInWithPhoneNumber: fb.phone,
  signOut: fb.signOut,
}));

import { ZolexoraAuthProvider, useAuth } from "../src/react/index.js";
import { usePublicSignIn } from "../src/public-sign-in/index.js";

const BASE = "https://auth.test";
const SESSION = {
  success: true,
  next: "done",
  customToken: "zx.session.token",
  user: { uid: "u1", zolexora_id: "ZX-2345-6789-ABCD", email: "asha@example.com", email_verified: true },
  routing: { user_type: "consumer" },
};

/** Fake auth service: maps "POST /path" to a JSON response, records calls. */
function fakeService(routes: Record<string, any>) {
  const calls: { path: string; body: any }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(`${BASE}/api/v1/auth`, "");
    if (path === "/public/config") return Response.json({ mobile_verification_required: true });
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path, body });
    const reply = routes[path];
    if (!reply) return Response.json({ code: "NOT_FOUND", message: "no route" }, { status: 404 });
    return typeof reply === "function" ? reply(body) : Response.json(reply);
  }) as any;
  return calls;
}

const setup = () =>
  renderHook(
    () => ({ flow: usePublicSignIn({ firebaseAuth: {} as any, authUrl: BASE, product: "clarityfi" }), auth: useAuth() }),
    { wrapper: ({ children }) => <ZolexoraAuthProvider authUrl={BASE}>{children}</ZolexoraAuthProvider> },
  );

describe("usePublicSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("new email: code → phone (SMS) → profile → signed in", async () => {
    const calls = fakeService({
      "/public/identify": { success: true, exists: false, next: "verify_email" },
      "/public/signup/email/verify": { success: true, next: "verify_phone", signup_token: "t1", email: "asha@example.com" },
      "/public/signup/phone": { success: true, next: "profile", signup_token: "t2", email: "asha@example.com", phone_number: "+919800000001" },
      "/public/signup/complete": () => Response.json(SESSION, { status: 201 }),
    });
    fb.phone.mockResolvedValue({ confirm: async () => ({ user: { getIdToken: async () => "fb-phone-id-token" } }) });
    const { result } = setup();

    await act(() => result.current.flow.continueWithEmail("Asha@Example.com", "ts1"));
    expect(result.current.flow.step).toBe("verify_email");
    await act(() => result.current.flow.verifyEmailCode("123456"));
    expect(result.current.flow.step).toBe("enter_phone");
    await act(() => result.current.flow.sendPhoneCode("+91 98000 00001"));
    expect(fb.phone).toHaveBeenCalledWith({}, "+919800000001", expect.anything());
    expect(result.current.flow.step).toBe("verify_phone");
    await act(() => result.current.flow.verifyPhoneCode("654321"));
    expect(result.current.flow.step).toBe("profile");
    await act(() => result.current.flow.completeProfile("Asha Rao", "SecureNewUserPass123!"));

    expect(result.current.flow.step).toBe("done");
    expect(result.current.auth.user?.email).toBe("asha@example.com");
    expect(fb.signOut).toHaveBeenCalled(); // the Firebase session is dropped
    expect(calls.find((c) => c.path === "/public/signup/phone")!.body).toMatchObject({ firebase_id_token: "fb-phone-id-token", signup_token: "t1" });
    expect(calls.find((c) => c.path === "/public/signup/complete")!.body).toMatchObject({ signup_token: "t2", display_name: "Asha Rao" });
  });

  it("existing Google user is signed in straight away", async () => {
    fakeService({ "/public/google": SESSION });
    fb.popup.mockResolvedValue({ user: { getIdToken: async () => "fb-google-id-token" } });
    const { result } = setup();
    await act(() => result.current.flow.continueWithGoogle("ts"));
    expect(result.current.flow.step).toBe("done");
    expect(result.current.auth.isAuthenticated).toBe(true);
  });

  it("existing phone asks for the password and signs in with phone_number", async () => {
    const calls = fakeService({
      "/public/identify": { success: true, exists: true, next: "password" },
      "/public/login": SESSION,
    });
    const { result } = setup();
    await act(() => result.current.flow.continueWithPhone("+919876543210", "ts1"));
    expect(result.current.flow.step).toBe("password");
    await act(() => result.current.flow.signInWithPassword("pw-123456789012", "ts2"));
    expect(calls.at(-1)!.body).toMatchObject({ phone_number: "+919876543210", password: "pw-123456789012", turnstile_token: "ts2" });
    expect(result.current.flow.step).toBe("done");
  });

  it("new phone goes to the SMS code, then asks for an email", async () => {
    fakeService({
      "/public/identify": { success: true, exists: false, next: "verify_phone" },
      "/public/signup/phone": { success: true, next: "verify_email", signup_token: "t1", phone_number: "+919800000003" },
    });
    fb.phone.mockResolvedValue({ confirm: async () => ({ user: { getIdToken: async () => "tok" } }) });
    const { result } = setup();
    await act(() => result.current.flow.continueWithPhone("+919800000003", "ts"));
    expect(result.current.flow.step).toBe("verify_phone");
    await act(() => result.current.flow.verifyPhoneCode("111111"));
    expect(result.current.flow.step).toBe("enter_email");
  });

  it("shows service and Firebase errors without changing step", async () => {
    fakeService({ "/public/identify": () => Response.json({ code: "AUTH_INVALID_PHONE", message: "Use +91 format" }, { status: 400 }) });
    const { result } = setup();
    await act(() => result.current.flow.continueWithPhone("12345", "ts"));
    expect(result.current.flow.error?.code).toBe("AUTH_INVALID_PHONE");
    expect(result.current.flow.step).toBe("start");

    fb.popup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    await act(() => result.current.flow.continueWithGoogle("ts"));
    await waitFor(() => expect(result.current.flow.error?.message).toBe("Google sign-in was closed."));
  });
});
