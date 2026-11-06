import { TURNSTILE, buildTestApp, testTokens } from "./helpers/fakes.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryAuthRepository } from "./helpers/in-memory-auth.repository.js";
import { BLOCKED_WEBMAIL_DOMAINS } from "@zolexora/utils";

// Employee provisioning requires an org admin (or platform admin) token.
// Employees are invited (ADR 0005 §6.2); a platform admin can invite into any business.
const orgAdminAuth = () => ({
  authorization: `Bearer ${testTokens().signJwt({ uid: "00000000-0000-4000-8000-000000000201", is_platform_admin: true, type: "platform_admin" })}`,
});


describe("Milestone 2 Adversarial & Empirical Probing: Authentication Tracks", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let repo: InMemoryAuthRepository;

  const VALID_TURNSTILE = TURNSTILE.VALID_TOKEN;
  const VALID_ORG = "ZX-ORG-4B8T-9M2K-7Y4X";
  const VALID_EMP_PASS = "CorporateSecurePass123!";
  const VALID_ADMIN_PASS = "MasterSuperadminSecret2026!";

  beforeEach(async () => {
    repo = new InMemoryAuthRepository();
    app = await buildTestApp(repo);
  });

  afterEach(async () => {
    await app.close();
  });

  // =========================================================================
  // TRACK 1: Dual Verification, OTP Expiration, Product Routing Matrix
  // =========================================================================
  describe("Track 1: Global Identity & Dual Verification Probes", () => {
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
          url: "/api/v1/organizations/ZX-ORG-4B8T-9M2K-7Y4X/invites",
          headers: orgAdminAuth(),
          payload: { kind: "employee", email: `employee@${domain}` },
        });
        expect(resLower.statusCode).toBe(400);
        expect(resLower.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");

        // Uppercase
        const resUpper = await app.inject({
          method: "POST",
          url: "/api/v1/organizations/ZX-ORG-4B8T-9M2K-7Y4X/invites",
          headers: orgAdminAuth(),
          payload: { kind: "employee", email: `EMPLOYEE@${domain.toUpperCase()}` },
        });
        expect(resUpper.statusCode).toBe(400);
        expect(resUpper.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");

        // Mixed case
        const mixed = domain.slice(0, 2).toUpperCase() + domain.slice(2);
        const resMixed = await app.inject({
          method: "POST",
          url: "/api/v1/organizations/ZX-ORG-4B8T-9M2K-7Y4X/invites",
          headers: orgAdminAuth(),
          payload: { kind: "employee", email: `user@${mixed}` },
        });
        expect(resMixed.statusCode).toBe(400);
        expect(resMixed.json().code).toBe("AUTH_WEBMAIL_DOMAIN_FORBIDDEN");
      }
    });

    it("T2-ADV-04: Probes perimeter evasion attempts on webmail domains", async () => {
      // 1. Subdomain evasion (e.g. user@mail.gmail.com)
      const resSubdomain = await app.inject({
        method: "POST",
        url: "/api/v1/organizations/ZX-ORG-4B8T-9M2K-7Y4X/invites",
          headers: orgAdminAuth(),
        payload: { kind: "employee", email: "user@mail.gmail.com" },
      });
      // Documenting whether subdomains bypass exact string matching
      const subdomainBlocked = resSubdomain.statusCode === 400;

      // 2. Legitimate corporate domain with 'gmail' in the name (must NOT be blocked)
      const resLegit = await app.inject({
        method: "POST",
        url: "/api/v1/organizations/ZX-ORG-4B8T-9M2K-7Y4X/invites",
          headers: orgAdminAuth(),
        payload: { kind: "employee", email: "contact@notgmail.com" },
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
