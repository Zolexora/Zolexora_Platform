import { FastifyInstance } from "fastify";
import { CONSTANTS } from "../config/constants.js";
import { env } from "../config/env.js";
import { IAuthRepository } from "../repositories/types.js";
import { getSecretsDiagnostics } from "../config/infisical.js";

export async function healthRoutes(app: FastifyInstance, opts: { repo: IAuthRepository }) {
  app.get(
    "/api/v1/health",
    {
      schema: {
        description: "Service liveness and health probe",
        tags: ["System"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              service: { type: "string" },
              port: { type: "number" },
              timestamp: { type: "string" },
              version: { type: "string" },
              secrets: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  provider: { type: "string" },
                  synced_count: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      const healthy = await opts.repo.isHealthy();
      const diag = getSecretsDiagnostics();
      return reply.status(200).send({
        status: healthy ? "ok" : "degraded",
        service: CONSTANTS.SERVICE_NAME,
        port: env.PORT,
        timestamp: new Date().toISOString(),
        version: CONSTANTS.SERVICE_VERSION,
        secrets: {
          status: diag.status,
          provider: diag.provider,
          synced_count: diag.syncedCount,
        },
      });
    }
  );

  app.get("/health", async (_req, reply) => {
    const healthy = await opts.repo.isHealthy();
    const diag = getSecretsDiagnostics();
    return reply.status(200).send({
      status: healthy ? "ok" : "degraded",
      service: CONSTANTS.SERVICE_NAME,
      port: env.PORT,
      timestamp: new Date().toISOString(),
      version: CONSTANTS.SERVICE_VERSION,
      secrets: {
        status: diag.status,
        provider: diag.provider,
        synced_count: diag.syncedCount,
      },
    });
  });

  app.get(
    "/api/v1/health/secrets",
    {
      schema: {
        description: "Infisical secrets management sync and fallback diagnostics probe",
        tags: ["System"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              provider: { type: "string" },
              workspaceId: { type: "string" },
              environment: { type: "string" },
              secretsPath: { type: "string" },
              syncedCount: { type: "number" },
              timestamp: { type: "string" },
              durationMs: { type: "number" },
              diagnostics: {
                type: "array",
                items: { type: "string" },
              },
              missingCriticalKeys: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      const diag = getSecretsDiagnostics();
      return reply.status(200).send(diag);
    }
  );
}
