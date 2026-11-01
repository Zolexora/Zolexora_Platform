import { describe, it, expect } from "vitest";
import { RegistrationStateMachine, RegistrationAttemptData } from "../src/state-machine";

describe("Unified Firebase Authentication State Machine", () => {
  const createMockAttempt = (overrides: Partial<RegistrationAttemptData> = {}): RegistrationAttemptData => ({
    attemptId: "reg_test_123",
    signupMethod: "email",
    platform: "web",
    status: "identity_pending",
    email: "user@zolexora.com",
    emailVerified: false,
    phoneNumber: "+15551234567",
    phoneVerified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  });

  describe("State Transitions", () => {
    it("allows valid transitions from identity_pending", () => {
      expect(RegistrationStateMachine.canTransition("identity_pending", "contact_verification")).toBe(true);
      expect(RegistrationStateMachine.canTransition("identity_pending", "cancelled")).toBe(true);
      expect(RegistrationStateMachine.canTransition("identity_pending", "expired")).toBe(true);
    });

    it("rejects unauthorized skips like identity_pending -> active", () => {
      expect(RegistrationStateMachine.canTransition("identity_pending", "active")).toBe(false);
      expect(RegistrationStateMachine.canTransition("identity_pending", "finalizing")).toBe(false);
      expect(RegistrationStateMachine.canTransition("identity_pending", "profile_pending")).toBe(false);
    });

    it("allows contact_verification -> profile_pending", () => {
      expect(RegistrationStateMachine.canTransition("contact_verification", "profile_pending")).toBe(true);
    });

    it("allows profile_pending -> finalizing and finalizing -> active", () => {
      expect(RegistrationStateMachine.canTransition("profile_pending", "finalizing")).toBe(true);
      expect(RegistrationStateMachine.canTransition("finalizing", "active")).toBe(true);
    });

    it("terminal states (active, expired, cancelled) cannot transition anywhere", () => {
      expect(RegistrationStateMachine.canTransition("active", "identity_pending")).toBe(false);
      expect(RegistrationStateMachine.canTransition("expired", "contact_verification")).toBe(false);
      expect(RegistrationStateMachine.canTransition("cancelled", "finalizing")).toBe(false);
    });
  });

  describe("Contact Satisfaction & Expiration Checks", () => {
    it("requires both email and phone to be verified before contacts are satisfied", () => {
      const attempt = createMockAttempt();
      expect(RegistrationStateMachine.areContactsSatisfied(attempt)).toBe(false);

      attempt.emailVerified = true;
      expect(RegistrationStateMachine.areContactsSatisfied(attempt)).toBe(false);

      attempt.phoneVerified = true;
      expect(RegistrationStateMachine.areContactsSatisfied(attempt)).toBe(true);
    });

    it("detects expired attempts correctly", () => {
      const activeAttempt = createMockAttempt();
      expect(RegistrationStateMachine.isExpired(activeAttempt)).toBe(false);

      const expiredAttempt = createMockAttempt({
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      expect(RegistrationStateMachine.isExpired(expiredAttempt)).toBe(true);
      expect(RegistrationStateMachine.determineNextState(expiredAttempt)).toBe("expired");
    });

    it("determines next state dynamically based on verifications", () => {
      const attempt = createMockAttempt({ status: "contact_verification" });
      expect(RegistrationStateMachine.determineNextState(attempt)).toBe("contact_verification");

      attempt.emailVerified = true;
      attempt.phoneVerified = true;
      expect(RegistrationStateMachine.determineNextState(attempt)).toBe("profile_pending");
    });
  });

  describe("Custom Email Challenge (OTP) Hashing & Verification", () => {
    it("generates a 6-digit numeric OTP", () => {
      for (let i = 0; i < 20; i++) {
        const otp = RegistrationStateMachine.generateOtp();
        expect(otp).toMatch(/^\d{6}$/);
      }
    });

    it("securely hashes and verifies OTP with salt using timingSafeEqual", () => {
      const otp = "849201";
      const salt = "a7f39c28b14e";
      const hash = RegistrationStateMachine.hashOtp(otp, salt);

      expect(RegistrationStateMachine.verifyOtp(otp, salt, hash)).toBe(true);
      expect(RegistrationStateMachine.verifyOtp("123456", salt, hash)).toBe(false);
      expect(RegistrationStateMachine.verifyOtp(otp, "wrong_salt", hash)).toBe(false);
    });
  });
});
