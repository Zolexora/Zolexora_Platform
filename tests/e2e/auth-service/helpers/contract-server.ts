import http from "node:http";
import { AddressInfo } from "node:net";
import {
  isValidZolexoraOrgId,
  normalizeZolexoraOrgId,
  isValidZolexoraId,
  generateZolexoraId,
  validatePassword,
  hashPasswordScrypt,
  verifyPasswordScrypt,
  timingSafeEqual,
} from "./crypto";
import { FIXTURES } from "./fixtures";

export interface RateLimitEntry {
  failures: number;
  lockedUntil: number;
  timestamps: number[];
}

export class AuthContractServer {
  private server: http.Server;
  private port = 0;
  private rateLimits = new Map<string, RateLimitEntry>();
  private revokedTokens = new Map<string, number>(); // uid -> revokedAt timestamp (ms)
  private registeredUsers = new Map<string, any>();
  private employees = new Map<string, any>();
  private admins = new Map<string, any>();
  private kycDocuments = new Map<string, any>();

  constructor() {
    this.initDefaults();
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: String(err) }));
        }
      });
    });
  }

  private initDefaults() {
    // Default platform admin
    this.admins.set(FIXTURES.emails.adminUser, {
      id: "adm_101",
      zolexora_id: "ZX-0001-ADMIN-ROOT",
      email: FIXTURES.emails.adminUser,
      password: FIXTURES.passwords.admin,
      role: "superadmin",
      is_platform_admin: true,
      permissions: ["*"],
      active: true,
    });

    // Default org employee
    const defaultOrg = FIXTURES.ids.validOrg;
    this.employees.set(`${defaultOrg}:dispatcher@zolexora.com`, {
      uid: "emp_982348",
      zolexora_id: "ZX-7K2M-9P4W-1Y8X",
      org_id: defaultOrg,
      email: "dispatcher@zolexora.com",
      password: FIXTURES.passwords.standard,
      role: "manager",
      product: "zolexora-tms",
      permissions: ["dispatch:read", "dispatch:write"],
      status: "active",
    });
  }

  public resetState() {
    this.rateLimits.clear();
    this.revokedTokens.clear();
    this.registeredUsers.clear();
    this.employees.clear();
    this.admins.clear();
    this.kycDocuments.clear();
    this.initDefaults();
  }

  public async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server.address() as AddressInfo;
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  public getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any, headers: Record<string, string> = {}) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    });
    res.end(JSON.stringify(data));
  }

  private verifyTurnstile(token?: string | null): { success: boolean; errorCode?: string } {
    if (!token) return { success: false, errorCode: "AUTH_TURNSTILE_REQUIRED" };
    if (token === FIXTURES.turnstile.timeoutDuplicate) {
      return { success: false, errorCode: "AUTH_TURNSTILE_TIMEOUT_OR_DUPLICATE" };
    }
    if (token !== FIXTURES.turnstile.valid && !token.startsWith("0.valid")) {
      return { success: false, errorCode: "AUTH_TURNSTILE_FAILED" };
    }
    return { success: true };
  }

  private checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry) return { allowed: true };

    if (entry.lockedUntil > now) {
      const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Prune events older than 15 minutes
    entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (entry.timestamps.length >= 5) {
      entry.lockedUntil = now + 15 * 60 * 1000;
      return { allowed: false, retryAfter: 900 };
    }

    return { allowed: true };
  }

  private recordFailure(key: string) {
    const now = Date.now();
    let entry = this.rateLimits.get(key);
    if (!entry) {
      entry = { failures: 0, lockedUntil: 0, timestamps: [] };
      this.rateLimits.set(key, entry);
    }
    entry.failures++;
    entry.timestamps.push(now);
    if (entry.timestamps.length >= 5) {
      entry.lockedUntil = now + 15 * 60 * 1000;
    }
  }

  private recordSuccess(key: string) {
    this.rateLimits.delete(key);
  }

  private async parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        totalLength += chunk.length;
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          try {
            resolve(raw.length > 0 ? JSON.parse(raw.toString("utf8")) : {});
          } catch (e) {
            reject(new Error("Invalid JSON body"));
          }
        } else {
          resolve({ raw, byteLength: totalLength });
        }
      });
      req.on("error", reject);
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase();
    const remoteIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    // OpenAPI & Health
    if (pathname === "/api/v1/health" && method === "GET") {
      return this.sendJson(res, 200, { status: "ok", service: "zolexora-auth-service" });
    }

    if ((pathname === "/docs" || pathname === "/openapi.json") && method === "GET") {
      return this.sendJson(res, 200, {
        openapi: "3.0.0",
        info: { title: "Zolexora Centralized Authentication Service", version: "2.0.0" },
        paths: {},
      });
    }

    // TRACK 1: Public Registration & Verification
    if (pathname === "/api/v1/auth/public/signup" && method === "POST") {
      const body = await this.parseBody(req);
      const turnstileToken = body.turnstile_token || (req.headers["cf-turnstile-token"] as string);
      const turnstile = this.verifyTurnstile(turnstileToken);
      if (!turnstile.success) {
        return this.sendJson(res, turnstile.errorCode === "AUTH_TURNSTILE_REQUIRED" ? 400 : 403, {
          code: turnstile.errorCode,
          message: "Turnstile verification failed",
        });
      }

      try {
        validatePassword(body.password || "");
      } catch (err: any) {
        return this.sendJson(res, 400, {
          code: "AUTH_PASSWORD_POLICY_VIOLATION",
          message: err.message,
        });
      }

      if (!body.email || !body.phoneNumber) {
        return this.sendJson(res, 400, {
          code: "AUTH_VERIFICATION_REQUIRED",
          message: "Both email and phone number are required for dual verification.",
        });
      }

      const attemptId = `att_${Date.now()}`;
      this.registeredUsers.set(body.email, {
        attemptId,
        email: body.email,
        phone: body.phoneNumber,
        displayName: body.displayName,
        password: body.password,
        emailVerified: false,
        zolexora_id: generateZolexoraId(),
      });

      return this.sendJson(res, 201, {
        success: true,
        attempt_id: attemptId,
        status: "contact_verification",
      });
    }

    if (pathname === "/api/v1/auth/public/verify-email-otp" && method === "POST") {
      const body = await this.parseBody(req);
      const user = this.registeredUsers.get(body.email);
      if (!user) {
        return this.sendJson(res, 404, { code: "AUTH_USER_NOT_FOUND", message: "User not found" });
      }
      if (body.otp !== "123456" && body.otp !== "000000") {
        return this.sendJson(res, 400, { code: "AUTH_OTP_INVALID_OR_EXPIRED", message: "Invalid OTP" });
      }
      user.emailVerified = true;
      return this.sendJson(res, 200, { success: true, email_verified: true });
    }

    if (pathname === "/api/v1/auth/public/login" && method === "POST") {
      const body = await this.parseBody(req);
      const turnstileToken = body.turnstile_token || (req.headers["cf-turnstile-token"] as string);
      const turnstile = this.verifyTurnstile(turnstileToken);
      if (!turnstile.success) {
        return this.sendJson(res, turnstile.errorCode === "AUTH_TURNSTILE_REQUIRED" ? 400 : 403, {
          code: turnstile.errorCode,
          message: "Turnstile verification failed",
        });
      }

      const email = (body.email || "").toLowerCase();
      const ipKey = `ip:${remoteIp}`;
      const acctKey = `account:${email}`;

      const rateCheck = this.checkRateLimit(ipKey);
      if (!rateCheck.allowed) {
        return this.sendJson(
          res,
          429,
          { code: "AUTH_RATE_LIMITED", message: "Rate limit exceeded", retry_after_seconds: rateCheck.retryAfter },
          { "Retry-After": String(rateCheck.retryAfter) }
        );
      }

      if (body.password !== FIXTURES.passwords.standard && body.password !== FIXTURES.passwords.exact12Chars) {
        this.recordFailure(ipKey);
        this.recordFailure(acctKey);
        return this.sendJson(res, 401, { code: "AUTH_INVALID_CREDENTIALS", message: "Invalid credentials" });
      }

      this.recordSuccess(ipKey);
      this.recordSuccess(acctKey);

      const targetProduct = (req.headers["x-target-product"] as string) || body.product || "clarityfi";
      const isConsumer = FIXTURES.products.consumer.includes(targetProduct);

      return this.sendJson(res, 200, {
        success: true,
        customToken: `mock_jwt_firebase_user_${Date.now()}`,
        user: {
          uid: "usr_9981",
          zolexora_id: FIXTURES.ids.validUser,
          email,
          email_verified: true,
        },
        routing: {
          user_type: isConsumer ? "consumer" : "enterprise",
          redirect_route: isConsumer ? "/dashboard" : "/select-organization",
        },
      });
    }

    // TRACK 2: Org Employee Login
    if (pathname === "/api/v1/auth/employee/login" && method === "POST") {
      const body = await this.parseBody(req);
      const turnstileToken = body.turnstile_token || (req.headers["cf-turnstile-token"] as string);
      const turnstile = this.verifyTurnstile(turnstileToken);
      if (!turnstile.success) {
        return this.sendJson(res, turnstile.errorCode === "AUTH_TURNSTILE_REQUIRED" ? 400 : 403, {
          code: turnstile.errorCode,
          message: "Turnstile verification failed",
        });
      }

      // Canonical Org ID validation
      const rawOrgId = body.org_id || "";
      if (!isValidZolexoraOrgId(rawOrgId)) {
        return this.sendJson(res, 400, {
          code: "AUTH_INVALID_ORG_ID_FORMAT",
          message: `Invalid Zolexora Org ID format: "${rawOrgId}". Expected ZX-ORG-XXXX-XXXX-XXXX`,
        });
      }
      const canonicalOrgId = normalizeZolexoraOrgId(rawOrgId);

      const identifier = (body.user_id_or_email || "").toLowerCase();
      const ipKey = `ip:${remoteIp}`;
      const acctKey = `org:${canonicalOrgId}:${identifier}`;

      const rateCheck = this.checkRateLimit(ipKey);
      if (!rateCheck.allowed) {
        return this.sendJson(
          res,
          429,
          { code: "AUTH_RATE_LIMITED", message: "Rate limit exceeded", retry_after_seconds: rateCheck.retryAfter },
          { "Retry-After": String(rateCheck.retryAfter) }
        );
      }

      const empKey = `${canonicalOrgId}:${identifier}`;
      const employee = this.employees.get(empKey);
      if (!employee || employee.password !== body.password) {
        this.recordFailure(ipKey);
        this.recordFailure(acctKey);
        return this.sendJson(res, 401, { code: "AUTH_INVALID_CREDENTIALS", message: "Invalid employee credentials" });
      }

      this.recordSuccess(ipKey);
      this.recordSuccess(acctKey);

      return this.sendJson(res, 200, {
        success: true,
        customToken: `mock_jwt_custom_token_${employee.uid}_${Date.now()}`,
        claims: {
          zolexora_id: employee.zolexora_id,
          org_id: employee.org_id,
          role: employee.role,
          product: employee.product || body.product || "zolexora-tms",
          permissions: employee.permissions,
        },
        user: {
          uid: employee.uid,
          zolexora_id: employee.zolexora_id,
          email: employee.email,
          status: employee.status,
        },
        org: {
          zolexora_org_id: employee.org_id,
          role: employee.role,
        },
      });
    }

    // TRACK 2: Employee Provisioning (Webmail rejection & zero friction)
    if (pathname === "/api/v1/auth/employee/create" && method === "POST") {
      const body = await this.parseBody(req);
      const email = (body.email || "").toLowerCase();

      // Check webmail rejection
      const domain = email.split("@")[1] || "";
      const isWebmail = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain);
      if (isWebmail) {
        return this.sendJson(res, 400, {
          code: "AUTH_WEBMAIL_DOMAIN_FORBIDDEN",
          message: "Public email domains like gmail.com are not permitted for corporate employees.",
        });
      }

      const orgId = normalizeZolexoraOrgId(body.org_id || FIXTURES.ids.validOrg);
      const zxId = generateZolexoraId();
      const newEmp = {
        uid: `emp_${Date.now()}`,
        zolexora_id: zxId,
        org_id: orgId,
        email,
        password: body.password || FIXTURES.passwords.standard,
        role: body.role || "member",
        permissions: body.permissions || ["trips:read"],
        status: "active",
      };
      this.employees.set(`${orgId}:${email}`, newEmp);

      return this.sendJson(res, 201, {
        success: true,
        employee: {
          zolexora_id: zxId,
          email,
          org_id: orgId,
          status: "active",
        },
      });
    }

    // TRACK 3: Platform Admin Login
    if (pathname === "/api/v1/auth/admin/login" && method === "POST") {
      const body = await this.parseBody(req);
      const turnstileToken = body.turnstile_token || (req.headers["cf-turnstile-token"] as string);
      const turnstile = this.verifyTurnstile(turnstileToken);
      if (!turnstile.success) {
        return this.sendJson(res, turnstile.errorCode === "AUTH_TURNSTILE_REQUIRED" ? 400 : 403, {
          code: turnstile.errorCode,
          message: "Turnstile verification failed",
        });
      }

      const identifier = (body.username_or_email || "").toLowerCase();
      const admin = this.admins.get(identifier);
      if (!admin || admin.password !== body.password) {
        return this.sendJson(res, 401, { code: "AUTH_INVALID_ADMIN_CREDENTIALS", message: "Invalid admin credentials" });
      }

      if (!admin.active) {
        return this.sendJson(res, 403, { code: "AUTH_ADMIN_ACCESS_DENIED", message: "Admin account suspended" });
      }

      return this.sendJson(res, 200, {
        success: true,
        customToken: `mock_jwt_superadmin_${admin.id}_${Date.now()}`,
        admin: {
          id: admin.id,
          zolexora_id: admin.zolexora_id,
          email: admin.email,
          role: "superadmin",
          is_platform_admin: true,
          permissions: ["*"],
        },
      });
    }

    // TRACK 3: Public Admin Registration Disabled
    if (pathname === "/api/v1/auth/admin/signup") {
      return this.sendJson(res, 403, {
        code: "AUTH_ADMIN_SIGNUP_FORBIDDEN",
        message: "Platform Admin accounts cannot be created publicly.",
      });
    }

    // Token Revocation
    if (pathname === "/api/v1/auth/tokens/revoke" && method === "POST") {
      const body = await this.parseBody(req);
      const uid = body.uid;
      const revokedAt = Date.now();
      this.revokedTokens.set(uid, revokedAt);
      return this.sendJson(res, 200, { success: true, uid, revoked_at: new Date(revokedAt).toISOString() });
    }

    // Authenticated session validation endpoint (/api/v1/auth/me)
    if (pathname === "/api/v1/auth/me" && method === "GET") {
      const authHeader = req.headers["authorization"] || "";
      if (!authHeader.startsWith("Bearer ")) {
        return this.sendJson(res, 401, { code: "AUTH_UNAUTHORIZED", message: "Missing token" });
      }
      const token = authHeader.replace("Bearer ", "");
      if (token === "expired_token" || token.includes("expired")) {
        return this.sendJson(res, 401, { code: "AUTH_TOKEN_EXPIRED", message: "Token expired" });
      }
      if (token.includes("future_iat") || token.includes("future_token")) {
        return this.sendJson(res, 401, { code: "AUTH_TOKEN_FUTURE_IAT", message: "Token issued in the future (clock skew exceeded)" });
      }
      if (token.includes("invalid_sig") || token.includes("tampered") || token.includes("forged") || token.includes("malicious")) {
        return this.sendJson(res, 401, { code: "AUTH_UNAUTHORIZED", message: "Invalid or forged token signature" });
      }
      // Check if token belongs to revoked uid
      for (const [uid, revokedAt] of this.revokedTokens.entries()) {
        if (token.includes(uid) || token.includes("revoked")) {
          return this.sendJson(res, 401, { code: "AUTH_TOKEN_REVOKED", message: "Session was invalidated" });
        }
      }

      return this.sendJson(res, 200, {
        user: { uid: "usr_active", email: "user@zolexora.com" },
        authenticated: true,
      });
    }

    // Storage: Avatars & Logos
    if (pathname === "/api/v1/storage/avatars/upload" && method === "POST") {
      const body = await this.parseBody(req);
      const mimeType = (req.headers["x-file-mime"] as string) || (body.file?.startsWith("data:") ? body.file.match(/^data:([^;]+);/)?.[1] : "image/jpeg") || "image/jpeg";
      const fileSize = Number(req.headers["x-file-size"]) || body.file_size || 1024;

      const allowedAvatarMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedAvatarMimes.includes(mimeType)) {
        return this.sendJson(res, 415, {
          code: "AUTH_INVALID_MIME_TYPE",
          message: `Permitted avatar MIME types: ${allowedAvatarMimes.join(", ")}`,
        });
      }

      if (fileSize > 10 * 1024 * 1024) {
        return this.sendJson(res, 400, {
          code: "AUTH_FILE_TOO_LARGE",
          message: "Avatar file size exceeds 10MB limit.",
        });
      }

      const zxId = (req.headers["x-zolexora-id"] as string) || FIXTURES.ids.validUser;
      return this.sendJson(res, 200, {
        url: `https://res.cloudinary.com/zolexora/image/upload/f_auto,q_auto/users/avatars/${zxId}.jpg`,
        public_id: `users/avatars/${zxId}`,
      });
    }

    if (pathname === "/api/v1/storage/logos/upload" && method === "POST") {
      const body = await this.parseBody(req);
      const mimeType = (req.headers["x-file-mime"] as string) || (body.file?.startsWith("data:") ? body.file.match(/^data:([^;]+);/)?.[1] : "image/png") || "image/png";
      const fileSize = Number(req.headers["x-file-size"]) || body.file_size || 1024;

      const allowedLogoMimes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
      if (!allowedLogoMimes.includes(mimeType)) {
        return this.sendJson(res, 415, {
          code: "AUTH_INVALID_MIME_TYPE",
          message: `Permitted logo MIME types: ${allowedLogoMimes.join(", ")}`,
        });
      }

      if (fileSize > 10 * 1024 * 1024) {
        return this.sendJson(res, 400, {
          code: "AUTH_FILE_TOO_LARGE",
          message: "Logo file size exceeds 10MB limit.",
        });
      }

      const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace(/^Bearer\s+/, "").trim();
        if (token.includes("invalid_sig") || token.includes("tampered") || token.includes("forged") || token.includes("malicious")) {
          return this.sendJson(res, 401, { code: "AUTH_UNAUTHORIZED", message: "Invalid or forged token signature" });
        }
        if (token.includes("viewer") || token.includes("wrong_org") || token.includes("cross_tenant") || token.includes("cross_org")) {
          return this.sendJson(res, 403, { code: "AUTH_FORBIDDEN", message: "Cross-organization logo upload forbidden." });
        }
      }

      const orgId = (req.headers["x-organisation-id"] as string) || FIXTURES.ids.validOrg;
      return this.sendJson(res, 200, {
        url: `https://res.cloudinary.com/zolexora/image/upload/f_auto,q_auto/orgs/logos/${orgId}.png`,
        public_id: `orgs/logos/${orgId}`,
      });
    }

    // Storage: KYC Document Upload
    if (pathname === "/api/v1/storage/kyc/upload" && method === "POST") {
      const body = await this.parseBody(req);
      const mimeType = (req.headers["x-file-mime"] as string) || body.mime_type || "application/pdf";
      const fileSize = Number(req.headers["x-file-size"]) || body.file_size || 1024;

      if (!FIXTURES.storage.allowedMimes.includes(mimeType)) {
        return this.sendJson(res, 415, {
          code: "AUTH_INVALID_MIME_TYPE",
          message: `Permitted MIME types: ${FIXTURES.storage.allowedMimes.join(", ")}`,
        });
      }

      if (fileSize > FIXTURES.storage.maxFileSize) {
        return this.sendJson(res, 400, {
          code: "AUTH_FILE_TOO_LARGE",
          message: "Maximum file size is 10MB.",
        });
      }

      const docId = `kyc_${Date.now()}`;
      this.kycDocuments.set(docId, {
        document_id: docId,
        mime_type: mimeType,
        file_size: fileSize,
        owner_id: req.headers["x-zolexora-id"] || "ZX-8K9M-4P2W-7Y3X",
        org_id: req.headers["x-organisation-id"] || "ZX-ORG-4B8T-9M2K-7Y4X",
      });

      return this.sendJson(res, 201, {
        document_id: docId,
        storage_key: `private/kyc/${docId}.enc`,
        file_size: fileSize,
        mime_type: mimeType,
        created_at: new Date().toISOString(),
      });
    }

    // Storage: KYC Signed URL
    if (pathname === "/api/v1/storage/kyc/signed-url" && method === "POST") {
      const body = await this.parseBody(req);
      const doc = this.kycDocuments.get(body.document_id);
      if (!doc) {
        return this.sendJson(res, 404, { code: "AUTH_DOCUMENT_NOT_FOUND", message: "Document not found" });
      }

      const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace(/^Bearer\s+/, "").trim();
        if (token.includes("invalid_sig") || token.includes("tampered") || token.includes("forged") || token.includes("malicious")) {
          return this.sendJson(res, 401, { code: "AUTH_UNAUTHORIZED", message: "Invalid or forged token signature" });
        }
        if (token.includes("expired")) {
          return this.sendJson(res, 401, { code: "AUTH_TOKEN_EXPIRED", message: "Token expired" });
        }
        if (token.includes("future_iat") || token.includes("future_token")) {
          return this.sendJson(res, 401, { code: "AUTH_TOKEN_FUTURE_IAT", message: "Token issued in the future" });
        }
        if (token.includes("cross_tenant") || token.includes("wrong_org") || token.includes("unauthorized_org") || token.includes("intruder")) {
          return this.sendJson(res, 403, {
            code: "AUTH_FORBIDDEN",
            message: "Access denied: only document owner, organization admin/owner, or platform superadmin can generate signed URLs.",
          });
        }
      }

      const expiry = Math.min(Math.max(body.expiry_seconds || 600, 600), 900); // 10–15 min
      return this.sendJson(res, 200, {
        signed_url: `https://storage.zolexora.com/private/kyc/${doc.document_id}?expires=${Date.now() + expiry * 1000}&sig=mock_hmac_sig`,
        expires_at: new Date(Date.now() + expiry * 1000).toISOString(),
        expires_in_seconds: expiry,
      });
    }

    return this.sendJson(res, 404, { code: "NOT_FOUND", message: `Route ${pathname} not found` });
  }
}
