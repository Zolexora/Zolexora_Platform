import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { ResourceService } from "../../../modules/resource/resource.service.js";

export async function resourceRoutes(server: FastifyInstance) {
  const svc = new ResourceService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.RESOURCE_READ)],
      schema: { tags: ["resources"], summary: "List resources" },
    },
    async (req) => {
      const query = z.object({ branchId: z.string().uuid().optional(), type: z.string().optional() }).parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.post(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.RESOURCE_WRITE)],
      schema: { tags: ["resources"], summary: "Create resource" },
    },
    async (req, reply) => {
      const body = z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["room", "equipment", "vehicle", "other"]),
        branchId: z.string().uuid().optional(),
        description: z.string().optional(),
        capacity: z.number().int().min(1).default(1),
      }).parse(req.body);
      return reply.status(201).send(await svc.create(req.actor!.org_id, body));
    },
  );
}
