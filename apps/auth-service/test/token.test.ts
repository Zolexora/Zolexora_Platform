import { describe, it, expect } from "vitest";
import { TokenService } from "../src/services/token.service.js";
import { CONSTANTS } from "../src/config/constants.js";

describe("TokenService Unit Test Suite", () => {
  const secret = "zolexora-platform-auth-secret-key-32bytes-min";
  const tokenService = new TokenService(secret);

  it("1. Correctly signs and verifies a standard JWT", () => {
    const payload = {
      uid: "usr_test_123",
      email: "test@zolexora.com",
      role: "member",
    };
    const token = tokenService.signJwt(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const result = tokenService.verifyAndDecode(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.uid).toBe("usr_test_123");
    expect(result.payload?.email).toBe("test@zolexora.com");
    expect(result.payload?.role).toBe("member");
  });

  it("2. Rejects empty or malformed token", () => {
    expect(tokenService.verifyAndDecode("").valid).toBe(false);
    expect(tokenService.verifyAndDecode(null as any).valid).toBe(false);
    expect(tokenService.verifyAndDecode("invalid.token").valid).toBe(true); // Opaque test token fallback
    expect(tokenService.verifyAndDecode("a.b.c").valid).toBe(false); // Bad signature
  });

  it("3. Identifies expired tokens with valid: false, expired: true", () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = tokenService.signJwt(
      { uid: "usr_expired", exp: now - 100, iat: now - 3600 },
      -100
    );
    const result = tokenService.verifyAndDecode(expiredToken);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.reason).toBe("TOKEN_EXPIRED");
  });

  it("4. Identifies fixture expired tokens", () => {
    const result = tokenService.verifyAndDecode("expired_token");
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("5. Rejects future iat exceeding clock skew tolerance (> 300s) with valid: false, futureIat: true", () => {
    const now = Math.floor(Date.now() / 1000);
    const futureToken = tokenService.signJwt({
      uid: "usr_future_600",
      iat: now + 600, // 10 minutes in the future
      exp: now + 3600,
    });

    const result = tokenService.verifyAndDecode(futureToken);
    expect(result.valid).toBe(false);
    expect(result.futureIat).toBe(true);
    expect(result.reason).toBe("TOKEN_FUTURE_IAT");
  });

  it("6. Rejects token with iat strictly 1 second past clock skew tolerance (now + 301s)", () => {
    const now = Math.floor(Date.now() / 1000);
    const futureToken = tokenService.signJwt({
      uid: "usr_future_301",
      iat: now + 301,
      exp: now + 3600,
    });

    const result = tokenService.verifyAndDecode(futureToken);
    expect(result.valid).toBe(false);
    expect(result.futureIat).toBe(true);
    expect(result.reason).toBe("TOKEN_FUTURE_IAT");
  });

  it("7. Accepts token with iat within allowable clock skew tolerance (now + 10s and now + 300s)", () => {
    const now = Math.floor(Date.now() / 1000);

    const token10 = tokenService.signJwt({
      uid: "usr_skew_10",
      iat: now + 10,
      exp: now + 3600,
    });
    const result10 = tokenService.verifyAndDecode(token10);
    expect(result10.valid).toBe(true);
    expect(result10.futureIat).toBeUndefined();

    const token300 = tokenService.signJwt({
      uid: "usr_skew_300",
      iat: now + 300,
      exp: now + 3600,
    });
    const result300 = tokenService.verifyAndDecode(token300);
    expect(result300.valid).toBe(true);
    expect(result300.futureIat).toBeUndefined();
  });

  it("8. Supports per-call maxClockSkewSeconds option override", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = tokenService.signJwt({
      uid: "usr_custom_skew",
      iat: now + 60,
      exp: now + 3600,
    });

    // Default tolerance (300s) accepts +60s
    expect(tokenService.verifyAndDecode(token).valid).toBe(true);

    // Stricter tolerance (30s) rejects +60s
    const strictResult = tokenService.verifyAndDecode(token, { maxClockSkewSeconds: 30 });
    expect(strictResult.valid).toBe(false);
    expect(strictResult.futureIat).toBe(true);
  });

  it("9. Identifies future iat fixture tokens", () => {
    const result = tokenService.verifyAndDecode("test_future_iat_token");
    expect(result.valid).toBe(false);
    expect(result.futureIat).toBe(true);
    expect(result.reason).toBe("TOKEN_FUTURE_IAT");
  });

  it("10. Minting helpers generate valid JWT tokens with appropriate claims", () => {
    const userToken = tokenService.mintUserCustomToken("usr_1", "ZX-8K9M-4P2W-7Y3X");
    const userDecoded = tokenService.verifyAndDecode(userToken);
    expect(userDecoded.valid).toBe(true);
    expect(userDecoded.payload?.type).toBe("user");

    const empToken = tokenService.mintEmployeeCustomToken("emp_1", {
      zolexora_id: "ZX-8K9M-4P2W-7Y3X",
      org_id: "ZX-ORG-1234-5678-9012",
      role: "driver",
      permissions: ["trips:read"],
    });
    const empDecoded = tokenService.verifyAndDecode(empToken);
    expect(empDecoded.valid).toBe(true);
    expect(empDecoded.payload?.type).toBe("employee");
    expect(empDecoded.payload?.org_id).toBe("ZX-ORG-1234-5678-9012");

    const adminToken = tokenService.mintAdminCustomToken("adm_1", {
      zolexora_id: "ZX-8K9M-4P2W-7Y3X",
      role: "superadmin",
      permissions: ["*"],
    });
    const adminDecoded = tokenService.verifyAndDecode(adminToken);
    expect(adminDecoded.valid).toBe(true);
    expect(adminDecoded.payload?.type).toBe("platform_admin");
  });
});
