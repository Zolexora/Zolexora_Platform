import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { ProfessionalService } from "../../../modules/professional/professional.service.js";

export async function professionalRoutes(server: FastifyInstance) {
  const svc = new ProfessionalService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PROFESSIONAL_READ)],
      schema: { tags: ["professionals"], summary: "List professionals" },
    },
    async (req) => {
      const query = z.object({
        branchId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        isActive: z.coerce.boolean().optional(),
      }).parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.get(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PROFESSIONAL_READ)],
      schema: { tags: ["professionals"], summary: "Get professional" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return svc.getById(req.actor!.org_id, id);
    },
  );

  server.put(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PROFESSIONAL_WRITE)],
      schema: { tags: ["professionals"], summary: "Update professional profile" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = z.object({
        displayName: z.string().min(1).max(100).optional(),
        title: z.string().max(20).optional(),
        specializations: z.array(z.string()).optional(),
        qualifications: z.array(z.string()).optional(),
        bio: z.string().max(2000).optional(),
        color: z.string().optional(),
        acceptsOnlineBooking: z.boolean().optional(),
      }).parse(req.body);
      return svc.update(req.actor!.org_id, id, body);
    },
  );
}
