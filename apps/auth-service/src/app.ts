import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { AppError, registerErrorHandler } from "./plugins/error-handler.js";
import { registerOpenApi } from "./plugins/openapi.js";
import { getAuthRepository, PostgresAuthRepository } from "./repositories/index.js";
import { TurnstileService } from "./services/turnstile.service.js";
import { RateLimitService } from "./services/rate-limit.service.js";
import { TokenService } from "./services/token.service.js";
import { StorageService } from "./services/storage.service.js";
import { KycStorageService } from "./services/kyc-storage.service.js";
import { OtpService } from "./services/otp.service.js";
import { MailService } from "./services/mail.service.js";
import { FirebaseService } from "./services/firebase.service.js";
import { SignupTicketService } from "./services/signup-ticket.service.js";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { track1PublicRoutes } from "./routes/auth/track1-public.routes.js";
import { track2EmployeeRoutes } from "./routes/auth/track2-employee.routes.js";
import { track3AdminRoutes } from "./routes/auth/track3-admin.routes.js";
import { sessionRoutes } from "./routes/auth/session.routes.js";
import { mediaRoutes } from "./routes/storage/media.routes.js";
import { kycRoutes } from "./routes/storage/kyc.routes.js";
import { CipherService } from "./services/cipher.service.js";
import { PwnedPasswordService } from "./services/pwned.service.js";
import { LockoutService } from "./services/lockout.service.js";
import { BusinessSessionService } from "./services/business-session.service.js";
import { TeamStore } from "./stores/team.store.js";
import { SecurityStore } from "./stores/security.store.js";
import { CatalogStore } from "./stores/catalog.store.js";
import { BusinessDeps } from "./routes/business/context.js";
import { organizationRoutes } from "./routes/business/organizations.routes.js";
import { teamRoutes } from "./routes/business/team.routes.js";
import { businessSessionRoutes } from "./routes/business/session.routes.js";
import { catalogRoutes } from "./routes/business/catalog.routes.js";
import { scopeToProduct } from "./rbac/engine.js";
import { VerificationService } from "./verification/verification.service.js";
import { CashfreeClient, ClearTaxClient, DigioClient } from "./verification/providers.js";
import { verificationRoutes } from "./routes/business/verification.routes.js";

export interface BuildAppOptions {
  repo?: PostgresAuthRepository;
  turnstile?: TurnstileService;
  mail?: MailService;
  firebase?: FirebaseService;
  /** Overrides MOBILE_OTP_VERIFICATION (tests). */
  mobileVerificationRequired?: boolean;
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({ logger: opts.logger ?? env.NODE_ENV === "development", trustProxy: env.TRUST_PROXY });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Organisation-ID",
      "X-Organization-ID",
      "X-Zolexora-ID",
      "X-Target-Product",
      "CF-Turnstile-Token",
      "X-File-Mime",
      "X-File-Size",
      "X-MFA-Code",
    ],
    credentials: true,
  });

  registerErrorHandler(app);
  if (env.NODE_ENV !== "production") await registerOpenApi(app);

  const repo = opts.repo ?? (await getAuthRepository());
  app.addHook("onClose", () => repo.close());

  const turnstile = opts.turnstile ?? new TurnstileService(env.TURNSTILE_SECRET_KEY, env.TURNSTILE_VERIFY_URL, {
    timeoutMs: env.TURNSTILE_TIMEOUT_MS,
    expectedHostnames: env.TURNSTILE_EXPECTED_HOSTNAMES,
  });
  const rateLimiter = new RateLimitService({
    maxAttempts: env.RATE_LIMIT_MAX_ATTEMPTS,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    lockoutSeconds: env.RATE_LIMIT_LOCKOUT_SECONDS,
  });
  const tokenService = new TokenService(env.SESSION_SECRET, env.TOKEN_TTL_SECONDS, undefined, env.AUTH_SIGNING_PRIVATE_KEY);
  const otp = new OtpService(repo, {
    secret: env.SESSION_SECRET,
    ttlSeconds: env.OTP_TTL_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });
  const mail = opts.mail ?? new MailService({ apiUrl: env.RESEND_API_URL, apiKey: env.RESEND_API_KEY, from: env.AUTH_FROM_EMAIL });
  const storage = new StorageService({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  });
  const kycStorage = new KycStorageService({
    endpoint: env.KYC_STORAGE_S3_ENDPOINT,
    region: env.KYC_STORAGE_S3_REGION,
    bucket: env.KYC_STORAGE_BUCKET,
    accessKeyId: env.KYC_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.KYC_STORAGE_SECRET_ACCESS_KEY,
    defaultSignedUrlTtl: env.KYC_SIGNED_URL_DEFAULT_TTL,
  });

  const firebase = opts.firebase ?? new FirebaseService({
    projectId: env.FIREBASE_PROJECT_ID,
    authIssuer: env.FIREBASE_AUTH_ISSUER,
    authJwksUrl: env.FIREBASE_AUTH_JWKS_URL,
    pnv: env.FIREBASE_PNV_JWKS_URL
      ? { jwksUrl: env.FIREBASE_PNV_JWKS_URL, issuer: env.FIREBASE_PNV_ISSUER!, audience: env.FIREBASE_PNV_AUDIENCE! }
      : undefined,
  });
  const tickets = new SignupTicketService(env.SESSION_SECRET, env.SIGNUP_TICKET_TTL_SECONDS);
  const mobileVerificationRequired = opts.mobileVerificationRequired ?? env.MOBILE_OTP_VERIFICATION;

  // Businesses, teams, roles and business sessions (ADR 0004, ADR 0005).
  const team = new TeamStore(repo.authDb);
  const security = new SecurityStore(repo.authDb);
  const catalog = new CatalogStore(repo.authDb);
  const cipher = new CipherService(env.AUTH_ENCRYPTION_KEY);
  const sessions = new BusinessSessionService(team, security, catalog, tokenService, cipher);
  const biz: BusinessDeps = {
    repo, team, security, catalog, sessions, tokens: tokenService, cipher, mail, turnstile,
    pwned: new PwnedPasswordService(env.PWNED_PASSWORDS_API_URL, (m) => app.log.warn(m)),
    lockout: new LockoutService(security, {
      maxAttempts: env.RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      lockoutSeconds: env.RATE_LIMIT_LOCKOUT_SECONDS,
    }),
    inviteUrl: env.INVITE_ACCEPT_URL,
    productKeys: env.CATALOG_PRODUCT_KEYS,
  };
  // Verification providers (ADR 0004 §4.3): config checks already ensured each chosen provider has its keys.
  const verification = new VerificationService(repo.authDb, team, cipher, mail, {
    providers: {
      identity: env.IDENTITY_VERIFICATION_PROVIDER,
      pan: env.PAN_VERIFICATION_PROVIDER,
      gst: env.GST_VERIFICATION_PROVIDER,
      registration: env.REGISTRATION_VERIFICATION_PROVIDER,
      authority: env.AUTHORITY_VERIFICATION_PROVIDER,
    },
    bankProvider: env.BANK_VERIFICATION_PROVIDER,
    bankMethods: env.BANK_VERIFICATION_METHODS ?? [],
    uidaiCert: env.UIDAI_OFFLINE_EKYC_CERT,
    cashfree: env.CASHFREE_VERIFICATION_BASE_URL ? new CashfreeClient({
      baseUrl: env.CASHFREE_VERIFICATION_BASE_URL, clientId: env.CASHFREE_VERIFICATION_CLIENT_ID!, clientSecret: env.CASHFREE_VERIFICATION_CLIENT_SECRET!,
    }) : undefined,
    cleartax: env.GST_CLEARTAX_BASE_URL ? new ClearTaxClient({
      baseUrl: env.GST_CLEARTAX_BASE_URL, authToken: env.GST_CLEARTAX_AUTH_TOKEN!, taxableEntityId: env.GST_CLEARTAX_TAXABLE_ENTITY_ID!,
    }) : undefined,
    digio: env.DIGIO_BASE_URL ? new DigioClient({
      baseUrl: env.DIGIO_BASE_URL, clientId: env.DIGIO_CLIENT_ID!, clientSecret: env.DIGIO_CLIENT_SECRET!,
    }) : undefined,
    digioTemplates: {
      identity: env.DIGIO_IDENTITY_TEMPLATE,
      pan: env.DIGIO_PAN_TEMPLATE,
      reverse_penny_drop: env.DIGIO_REVERSE_PENNY_DROP_TEMPLATE,
      penny_drop: env.DIGIO_PENNY_DROP_TEMPLATE,
    },
  });

  const memberMe = async (memberId: string, product: string | null) => {
    const a = await sessions.access(memberId);
    const who = await team.getMemberIdentity(memberId);
    if (!a || !who || !a.input.memberActive || !a.input.orgActive) {
      throw new AppError({ statusCode: 401, code: "AUTH_UNAUTHORIZED", message: "Your access to this business is not active." });
    }
    return {
      user: {
        member_id: memberId, kind: who.user_id ? "person" : "employee", zolexora_id: who.zolexora_id, email: who.email,
        phone_number: who.phone_number, display_name: who.display_name,
      },
      org: { zolexora_org_id: a.org.zolexora_org_id, name: a.org.name, status: a.org.status, business_kind: a.org.business_kind },
      role: a.access.orgRoleKey,
      product,
      permissions: scopeToProduct(a.access.permissions, product),
      mfa_setup_required: a.access.mfaSetupRequired,
      verification: await verification.orgStatusMap(a.org),
    };
  };

  await app.register(healthRoutes, { repo });
  await app.register(track1PublicRoutes, {
    repo, turnstile, rateLimiter, tokenService, otp, mail, firebase, tickets, mobileVerificationRequired,
  });
  await app.register(track2EmployeeRoutes, biz);
  await app.register(track3AdminRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(sessionRoutes, { repo, tokenService, memberMe });
  await app.register(organizationRoutes, { ...biz, onOrgEdited: (org, changed) => verification.onOrgEdited(org, changed) });
  await app.register(teamRoutes, biz);
  await app.register(businessSessionRoutes, biz);
  await app.register(catalogRoutes, biz);
  await app.register(verificationRoutes, { ...biz, verification });
  await app.register(mediaRoutes, { storage, repo, tokenService });
  await app.register(kycRoutes, { kycStorage, repo, tokenService });

  return app;
}
