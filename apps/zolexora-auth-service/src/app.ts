import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerOpenApi } from "./plugins/openapi.js";
import { getAuthRepository, IAuthRepository } from "./repositories/index.js";
import { TurnstileService } from "./services/turnstile.service.js";
import { RateLimitService } from "./services/rate-limit.service.js";
import { TokenService } from "./services/token.service.js";
import { StorageService } from "./services/storage.service.js";
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
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: opts.logger ?? (env.NODE_ENV === "development"),
    trustProxy: true,
  });

  // CORS
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
      "X-Forwarded-For",
      "CF-Turnstile-Token",
      "X-File-Mime",
      "X-File-Size",
    ],
    credentials: true,
  });

  // Multipart upload support (10MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  // Error Handler
  registerErrorHandler(app);

  // OpenAPI 3.1 & Interactive Docs
  await registerOpenApi(app);

  // Shared Services & Repositories
  const repo = opts.repo || (await getAuthRepository());
  const expectedHostnames = env.TURNSTILE_EXPECTED_HOSTNAMES
    ? env.TURNSTILE_EXPECTED_HOSTNAMES.split(",").map((h) => h.trim()).filter(Boolean)
    : [];
  const turnstile = new TurnstileService(
    env.TURNSTILE_SECRET_KEY,
    env.TURNSTILE_VERIFY_URL,
    {
      timeoutMs: env.TURNSTILE_TIMEOUT_MS,
      expectedHostnames,
    }
  );
  const rateLimiter = new RateLimitService();
  const tokenService = new TokenService();
  const storage = new StorageService(
    {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    },
    env.KYC_STORAGE_ENDPOINT
  );

  // Register All Route Modules
  await app.register(healthRoutes, { repo });
  await app.register(track1PublicRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(track2EmployeeRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(track3AdminRoutes, { repo, turnstile, rateLimiter, tokenService });
  await app.register(sessionRoutes, { repo, tokenService });
  await app.register(mediaRoutes, { storage, repo, tokenService });
  await app.register(kycRoutes, { storage, repo, tokenService });

  app.post("/api/v1/test/reset", async (_req, reply) => {
    rateLimiter.reset();
    tokenService.reset();
    if ("reset" in repo && typeof (repo as any).reset === "function") {
      await (repo as any).reset();
    }
    return reply.status(200).send({ success: true });
  });

  return app;
}
