import { FastifyInstance } from "fastify";
import { CONSTANTS } from "../config/constants.js";
import { IAuthRepository } from "../repositories/types.js";

export async function healthRoutes(app: FastifyInstance, opts: { repo: IAuthRepository }) {
  // 503 when the database is unreachable so container healthchecks and load balancers react.
  const handler = async (_req: unknown, reply: any) => {
    const healthy = await opts.repo.isHealthy();
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      service: CONSTANTS.SERVICE_NAME,
      version: CONSTANTS.SERVICE_VERSION,
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/api/v1/health", { schema: { description: "Liveness and database health probe", tags: ["System"] } }, handler);
  app.get("/health", handler);
}
