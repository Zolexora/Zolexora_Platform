import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerRoutes } from "./routes/index.js";
import { db } from "./db.js";

export async function buildApp() {
  const server = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty" } }
        : {}),
    },
    ajv: { customOptions: { coerceTypes: false, allErrors: true } },
  });

  // ── Security ──────────────────────────────────────────────────────
  await server.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await server.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (req) =>
      req.headers["x-forwarded-for"]?.toString() ?? req.ip,
  });

  // ── Plugins ───────────────────────────────────────────────────────
  await registerSwagger(server);
  registerErrorHandler(server);

  // ── Shared context ────────────────────────────────────────────────
  server.decorate("db", db);

  // ── Routes ────────────────────────────────────────────────────────
  await registerRoutes(server);

  return server;
}
