import type { FastifyInstance } from "fastify";
import { db } from "../../../db.js";

export async function healthRoutes(server: FastifyInstance) {
  server.get(
    "/health",
    { schema: { tags: ["health"], summary: "Liveness check" } },
    async () => ({ status: "ok", service: "zolexora-orbit-api" }),
  );

  server.get(
    "/health/ready",
    { schema: { tags: ["health"], summary: "Readiness check" } },
    async (_req, reply) => {
      try {
        await db.execute("SELECT 1" as any);
        return { status: "ready" };
      } catch {
        return reply
          .status(503)
          .send({ status: "not_ready", reason: "database unavailable" });
      }
    },
  );
}
