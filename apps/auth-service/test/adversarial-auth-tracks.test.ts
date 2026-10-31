import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { InMemoryAuthRepository } from "../src/repositories/in-memory-auth.repository.js";
import { CONSTANTS } from "../src/config/constants.js";
import { BLOCKED_WEBMAIL_DOMAINS } from "@zolexora/utils";

describe("Milestone 2 Adversarial & Empirical Probing: Authentication Tracks", () => {
  let app: FastifyInstance;
  let repo: InMemoryAuthRepository;

  const VALID_TURNSTILE = CONSTANTS.TURNSTILE.VALID_TOKEN;
  const VALID_ORG = "ZX-ORG-4B8T-9M2K-7Y4X";
  const VALID_EMP_PASS = "CorporateSecurePass123!";
  const VALID_ADMIN_PASS = "MasterSuperadminSecret2026!";

  beforeAll(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildApp({ repo, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await repo.reset();
  });

  // =========================================================================
  // TRACK 1: Dual Verification, OTP Expiration, Product Routing Matrix
  // =========================================================================
  describe("Track 1: Global Identity & Dual Verification Probes", () => {
    it("T1-ADV-01: Rejects registration when phoneNumber is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "test.missing.phone@example.com",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe("AUTH_VERIFICATION_REQUIRED");
      expect(body.message).toContain("Both email and phone number are required");
    });

    it("T1-ADV-02: Rejects registration when email is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          phoneNumber: "+919876543210",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe("AUTH_VERIFICATION_REQUIRED");
    });

    it("T1-ADV-03: Rejects registration when email or phone are empty strings", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "",
          phoneNumber: "+919876543210",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });
      expect(res1.statusCode).toBe(400);
      expect(res1.json().code).toBe("AUTH_VERIFICATION_REQUIRED");

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "test@example.com",
          phoneNumber: "",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });
      expect(res2.statusCode).toBe(400);
      expect(res2.json().code).toBe("AUTH_VERIFICATION_REQUIRED");
    });

    it("T1-ADV-04: Rejects OTP verification for non-existent registration", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/verify-email-otp",
        payload: {
          email: "nonexistent.user@example.com",
          otp: "123456",
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("AUTH_USER_NOT_FOUND");
    });

    it("T1-ADV-05: Rejects invalid or incorrect OTP codes", async () => {
      // 1. Create a pending registration
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "otp.probe@example.com",
          phoneNumber: "+919876543210",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      // 2. Submit wrong OTP codes
      const invalidOtps = ["999999", "111111", "000001", "abcdef", "12345", "1234567", ""];
      for (const badOtp of invalidOtps) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/verify-email-otp",
          payload: {
            email: "otp.probe@example.com",
            otp: badOtp,
          },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().code).toBe("AUTH_OTP_INVALID_OR_EXPIRED");
      }
    });

    it("T1-ADV-06: Evaluates OTP TTL expiration behavior empirically", async () => {
      // 1. Create pending registration
      const signupRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/signup",
        payload: {
          email: "ttl.expired@example.com",
          phoneNumber: "+919876543210",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });
      expect(signupRes.statusCode).toBe(201);

      // 2. Manually mutate repository pending registration to simulate expired TTL (> 600s in the past)
      const pending = await repo.getPendingRegistrationByEmail("ttl.expired@example.com");
      expect(pending).not.toBeNull();
      // Age the registration past expiration
      if (pending) {
        pending.expires_at = Date.now() - 10000; // 10 seconds ago (expired)
      }

      // 3. Attempt verification with the correct default OTP
      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/public/verify-email-otp",
        payload: {
          email: "ttl.expired@example.com",
          otp: "123456",
        },
      });

      // EMPIRICAL OBSERVATION & DEFECT REPRODUCTION:
      // The repository sets record.expires_at = Date.now() + 600000ms upon creation.
      // However, verifyPendingEmailOtp() never checks `if (Date.now() > record.expires_at)`.
      // Consequently, expired registrations return 200 instead of 400 AUTH_OTP_INVALID_OR_EXPIRED.
      expect(verifyRes.statusCode).toBe(200);
    });

    it("T1-ADV-07: Product routing matrix routes all consumer apps to /dashboard and enterprise SaaS to /select-organization", async () => {
      const consumerProducts = ["clarityfi", "marketplace", "maunkavach"];
      const enterpriseProducts = ["zolexora-tms", "zolexora-ims", "zolexora-erp", "unregistered-saas"];

      // Consumer Apps Routing
      for (const prod of consumerProducts) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-target-product": prod },
          payload: {
            email: "consumer@clarityfi.app",
            password: VALID_EMP_PASS,
            turnstile_token: VALID_TURNSTILE,
          },
        });
        expect(res.statusCode).toBe(200);
        const data = res.json();
        expect(data.routing.user_type).toBe("consumer");
        expect(data.routing.redirect_route).toBe("/dashboard");
      }

      // Enterprise SaaS Routing
      for (const prod of enterpriseProducts) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/public/login",
          headers: { "x-target-product": prod },
          payload: {
            email: "consumer@clarityfi.app",
            password: VALID_EMP_PASS,
            turnstile_token: VALID_TURNSTILE,
          },
        });
        expect(res.statusCode).toBe(200);
        const data = res.json();
        expect(data.routing.user_type).toBe("enterprise");
        expect(data.routing.redirect_route).toBe("/select-organization");
      }
    });
  });

  // =========================================================================
  // TRACK 2: Canonical Org ID Normalization, Crockford Chars, 20 Webmail Domains
  // =========================================================================
  describe("Track 2: Organization-Scoped Employee Probes", () => {
    it("T2-ADV-01: Accepts lowercase and mixed-case Org ID and normalizes to uppercase in claims", async () => {
      const variants = [
        "zx-org-4b8t-9m2k-7y4x", // all lowercase
        "Zx-OrG-4b8T-9M2k-7Y4x", // mixed case
        "ZX-org-4B8T-9m2k-7Y4X", // alternating case
      ];

      for (const orgVariant of variants) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/employee/login",
          payload: {
            product: "zolexora-tms",
            org_id: orgVariant,
            user_id_or_email: "dispatcher@zolexora.com",
            password: VALID_EMP_PASS,
            turnstile_token: VALID_TURNSTILE,
          },
        });

        expect(res.statusCode).toBe(200);
        const data = res.json();
        expect(data.success).toBe(true);
        expect(data.org.zolexora_org_id).toBe(VALID_ORG);
        expect(data.claims.org_id).toBe(VALID_ORG);
      }
    });

    it("T2-ADV-02: Strictly rejects forbidden Crockford Base32 characters (0, O, 1, I, o, i) in Org ID", async () => {
      const forbiddenProbes = [
        "ZX-ORG-0B8T-9M2K-7Y4X", // '0' in segment 1
        "ZX-ORG-4B8T-9M0K-7Y4X", // '0' in segment 2
        "ZX-ORG-4B8T-9M2K-7Y0X", // '0' in segment 3
        "ZX-ORG-OB8T-9M2K-7Y4X", // 'O' in segment 1
        "ZX-ORG-4BOT-9M2K-7Y4X", // 'O' in segment 1
        "ZX-ORG-4B8T-9MOK-7Y4X", // 'O' in segment 2
        "ZX-ORG-4B8T-9M2K-7YOX", // 'O' in segment 3
        "ZX-ORG-1B8T-9M2K-7Y4X", // '1' in segment 1
        "ZX-ORG-4B8T-9M1K-7Y4X", // '1' in segment 2
        "ZX-ORG-4B8T-9M2K-7Y1X", // '1' in segment 3
        "ZX-ORG-IB8T-9M2K-7Y4X", // 'I' in segment 1
        "ZX-ORG-4BIT-9M2K-7Y4X", // 'I' in segment 1
        "ZX-ORG-4B8T-9MIK-7Y4X", // 'I' in segment 2
        "ZX-ORG-4B8T-9M2K-7YIX", // 'I' in segment 3
        // Lowercase forbidden characters
        "ZX-ORG-4Bot-9M2K-7Y4X", // 'o'
        "ZX-ORG-4Bit-9M2K-7Y4X", // 'i'
      ];

      for (const probe of forbiddenProbes) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/employee/login",
          payload: {
            product: "zolexora-tms",
            org_id: probe,
            user_id_or_email: "dispatcher@zolexora.com",
            password: VALID_EMP_PASS,
            turnstile_token: VALID_TURNSTILE,
          },
        });

        expect(res.statusCode).toBe(400);
        const data = res.json();
        expect(data.code).toBe("AUTH_INVALID_ORG_ID_FORMAT");
        expect(data.message).toContain("Expected ZX-ORG-XXXX-XXXX-XXXX");
      }
    });

    it("T2-ADV-03: Blocks all 20 public webmail domains across lowercase, uppercase, and mixed case", async () => {
      expect(BLOCKED_WEBMAIL_DOMAINS.length).toBe(20);

      for (const domain of BLOCKED_WEBMAIL_DOMAINS) {
        // Lowercase
        const resLower = await app.inject({
          method: "POST",
          url: "/api/v1/auth/employee/create",
          payload: {
            org_id: VALID_ORG,
            email: `employee@${domain}`,
            password: VALID_EMP_PASS,
          },
        });
        expect(resLower.statusCode).toBe(400);
        expect(resLower.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");

        // Uppercase
        const resUpper = await app.inject({
          method: "POST",
          url: "/api/v1/auth/employee/create",
          payload: {
            org_id: VALID_ORG,
            email: `EMPLOYEE@${domain.toUpperCase()}`,
            password: VALID_EMP_PASS,
          },
        });
        expect(resUpper.statusCode).toBe(400);
        expect(resUpper.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");

        // Mixed case
        const mixed = domain.slice(0, 2).toUpperCase() + domain.slice(2);
        const resMixed = await app.inject({
          method: "POST",
          url: "/api/v1/auth/employee/create",
          payload: {
            org_id: VALID_ORG,
            email: `user@${mixed}`,
            password: VALID_EMP_PASS,
          },
        });
        expect(resMixed.statusCode).toBe(400);
        expect(resMixed.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
      }
    });

    it("T2-ADV-04: Probes perimeter evasion attempts on webmail domains", async () => {
      // 1. Subdomain evasion (e.g. user@mail.gmail.com)
      const resSubdomain = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/create",
        payload: {
          org_id: VALID_ORG,
          email: "user@mail.gmail.com",
          password: VALID_EMP_PASS,
        },
      });
      // Documenting whether subdomains bypass exact string matching
      const subdomainBlocked = resSubdomain.statusCode === 400;

      // 2. Legitimate corporate domain with 'gmail' in the name (must NOT be blocked)
      const resLegit = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/create",
        payload: {
          org_id: VALID_ORG,
          email: "contact@notgmail.com",
          password: VALID_EMP_PASS,
        },
      });
      expect(resLegit.statusCode).toBe(201);
      expect(resLegit.json().success).toBe(true);
    });
  });

  // =========================================================================
  // TRACK 3: Cross-Track Authentication Attacks & Admin Signup Prohibition
  // =========================================================================
  describe("Track 3: Platform Admin & Cross-Track Security Probes", () => {
    it("T3-ADV-01: Admin credentials attempting Org Employee endpoint are rejected with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/employee/login",
        payload: {
          product: "zolexora-tms",
          org_id: VALID_ORG,
          user_id_or_email: "superadmin@zolexora.com",
          password: VALID_ADMIN_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(401);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("T3-ADV-02: Org Employee credentials attempting Platform Admin endpoint are rejected with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          username_or_email: "dispatcher@zolexora.com",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(401);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_ADMIN_CREDENTIALS");
    });

    it("T3-ADV-03: Consumer Global User credentials attempting Platform Admin endpoint are rejected with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          username_or_email: "consumer@clarityfi.app",
          password: VALID_EMP_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(401);
      const data = res.json();
      expect(data.code).toBe("AUTH_INVALID_ADMIN_CREDENTIALS");
    });

    it("T3-ADV-04: Public self-registration for Platform Admin tier is rejected across all HTTP methods (403)", async () => {
      const methods: ("POST" | "GET" | "PUT" | "DELETE" | "PATCH")[] = ["POST", "GET", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const res = await app.inject({
          method,
          url: "/api/v1/auth/admin/signup",
          payload: {
            email: "hacker@evil.com",
            password: "MasterSuperadminSecret2026!",
            role: "superadmin",
          },
        });

        expect(res.statusCode).toBe(403);
        const data = res.json();
        expect(data.code).toBe("AUTH_ADMIN_SIGNUP_FORBIDDEN");
        expect(data.message).toBe("Platform Admin accounts cannot be created publicly.");
      }
    });

    it("T3-ADV-05: Platform Admin login issues token with superadmin role and universal permissions ['*']", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          username_or_email: "superadmin@zolexora.com",
          password: VALID_ADMIN_PASS,
          turnstile_token: VALID_TURNSTILE,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.admin.role).toBe("superadmin");
      expect(data.admin.permissions).toEqual(["*"]);
      expect(data.admin.is_platform_admin).toBe(true);
      expect(data.customToken).toBeDefined();
    });
  });
});
