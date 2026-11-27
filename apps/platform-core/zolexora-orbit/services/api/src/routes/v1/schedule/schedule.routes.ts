import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { ScheduleService } from "../../../modules/schedule/schedule.service.js";

export async function scheduleRoutes(server: FastifyInstance) {
  const svc = new ScheduleService();

  server.get(
    "/availability",
    {
      preHandler: [requireAuth()],
      schema: { tags: ["schedule"], summary: "Get availability slots" },
    },
    async (req) => {
      const query = z.object({
        professionalId: z.string().uuid().optional(),
        serviceId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        branchId: z.string().uuid().optional(),
      }).parse(req.query);
      return svc.getAvailableSlots(req.actor!.org_id, query);
    },
  );

  server.get(
    "/templates",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SCHEDULE_READ)],
      schema: { tags: ["schedule"], summary: "List schedule templates" },
    },
    async (req) => svc.listTemplates(req.actor!.org_id),
  );

  server.post(
    "/templates",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SCHEDULE_WRITE)],
      schema: { tags: ["schedule"], summary: "Create schedule template" },
    },
    async (req, reply) => {
      const body = z.object({
        name: z.string().min(1),
        professionalId: z.string().uuid().optional(),
        branchId: z.string().uuid().optional(),
        weeklyPattern: z.array(z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string().regex(/^\d{2}:\d{2}$/),
          endTime: z.string().regex(/^\d{2}:\d{2}$/),
          isAvailable: z.boolean(),
        })),
        effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(req.body);
      const template = await svc.createTemplate(req.actor!.org_id, body);
      return reply.status(201).send(template);
    },
  );

  server.post(
    "/overrides",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.SCHEDULE_WRITE)],
      schema: { tags: ["schedule"], summary: "Create schedule override (holiday/special hours)" },
    },
    async (req, reply) => {
      const body = z.object({
        professionalId: z.string().uuid().optional(),
        branchId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        isAvailable: z.boolean().default(false),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        reason: z.string().max(200).optional(),
      }).parse(req.body);
      const override = await svc.createOverride(req.actor!.org_id, body);
      return reply.status(201).send(override);
    },
  );
}
