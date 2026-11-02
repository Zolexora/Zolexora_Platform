import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerOpenApi } from "./plugins/openapi.js";
import { getAuthRepository, IAuthRepository } from "./repositories/index.js";
import { TurnstileService } from "./services/turnstile.service.js";
import { RateLimitService } from "./services/rate-limit.service.js";
import { TokenService } from "./services/token.service.js";
import { StorageService } from "./services/storage.service.js";
import { KycStorageService } from "./services/kyc-storage.service.js";
import { OtpService } from "./services/otp.service.js";
import { MailService } from "./services/mail.service.js";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { track1PublicRoutes } from "./routes/auth/track1-public.routes.js";
import { track2EmployeeRoutes } from "./routes/auth/track2-employee.routes.js";
import { track3AdminRoutes } from "./routes/auth/track3-admin.routes.js";
import { sessionRoutes } from "./routes/auth/session.routes.js";
import { mediaRoutes } from "./routes/storage/media.routes.js";
import { kycRoutes } from "./routes/storage/kyc.routes.js";

export interface BuildAppOptions {
  repo?: IAuthRepository;
  turnstile?: TurnstileService;
  mail?: MailService;
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
  const tokenService = new TokenService(env.SESSION_SECRET, env.TOKEN_TTL_SECONDS);
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

  await app.register(healthRoutes, { repo });
  await app.register(track1PublicRoutes, { repo, turnstile, rateLimiter, tokenService, otp, mail });
  await app.register(track2EmployeeRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(track3AdminRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(sessionRoutes, { repo, tokenService });
  await app.register(mediaRoutes, { storage, repo, tokenService });
  await app.register(kycRoutes, { kycStorage, repo, tokenService });

  return app;
}
