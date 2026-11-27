import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { ServiceCatalogueService } from "../../../modules/service/service.service.js";

const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  code: z.string().max(50).optional(),
  categoryId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(5).max(1440).default(30),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  priceAmount: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("INR"),
  isActive: z.boolean().default(true),
  acceptsOnlineBooking: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  maxAdvanceBookingDays: z.number().int().min(1).max(365).default(90),
  minAdvanceBookingHours: z.number().int().min(0).max(168).default(1),
});

export async function serviceRoutes(server: FastifyInstance) {
  const svc = new ServiceCatalogueService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SERVICE_READ)],
      schema: { tags: ["services"], summary: "List services" },
    },
    async (req) => {
      const query = z.object({
        categoryId: z.string().uuid().optional(),
        isActive: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }).parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.post(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SERVICE_WRITE)],
      schema: { tags: ["services"], summary: "Create service" },
    },
    async (req, reply) => {
      const body = createServiceSchema.parse(req.body);
      const service = await svc.create(req.actor!.org_id, body);
      return reply.status(201).send(service);
    },
  );

  server.get(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SERVICE_READ)],
      schema: { tags: ["services"], summary: "Get service" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return svc.getById(req.actor!.org_id, id);
    },
  );

  server.put(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SERVICE_WRITE)],
      schema: { tags: ["services"], summary: "Update service" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = createServiceSchema.partial().parse(req.body);
      return svc.update(req.actor!.org_id, id, body);
    },
  );

  server.delete(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SERVICE_DELETE)],
      schema: { tags: ["services"], summary: "Delete service" },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await svc.softDelete(req.actor!.org_id, id);
      return reply.status(204).send();
    },
  );
}
