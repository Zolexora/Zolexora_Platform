import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { AppointmentService } from "../../../modules/appointment/appointment.service.js";

const createAppointmentSchema = z.object({
  orgId: z.string(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  resourceId: z.string().uuid().optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  channel: z.enum(["walk_in", "phone", "online", "app", "reception"]).default("online"),
  notes: z.string().max(1000).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  orgId: z.string(),
  branchId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  date: z.string().optional(), // YYYY-MM-DD
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function appointmentRoutes(server: FastifyInstance) {
  const svc = new AppointmentService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.APPOINTMENT_READ)],
      schema: { tags: ["appointments"], summary: "List appointments" },
    },
    async (req) => {
      const query = listQuerySchema.parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.post(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.APPOINTMENT_WRITE)],
      schema: { tags: ["appointments"], summary: "Create appointment" },
    },
    async (req, reply) => {
      const body = createAppointmentSchema.parse(req.body);
      const appointment = await svc.create(req.actor!.org_id, req.actor!.zolexora_id, body);
      return reply.status(201).send(appointment);
    },
  );

  server.get(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.APPOINTMENT_READ)],
      schema: { tags: ["appointments"], summary: "Get appointment" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return svc.getById(req.actor!.org_id, id);
    },
  );

  server.patch(
    "/:id/status",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.APPOINTMENT_WRITE)],
      schema: { tags: ["appointments"], summary: "Update appointment status" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = z.object({
        status: z.enum(["confirmed", "in_progress", "completed", "cancelled", "no_show"]),
        reason: z.string().optional(),
      }).parse(req.body);
      return svc.updateStatus(req.actor!.org_id, id, body.status, req.actor!.zolexora_id, body.reason);
    },
  );

  server.delete(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.APPOINTMENT_CANCEL)],
      schema: { tags: ["appointments"], summary: "Cancel appointment" },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = z.object({ reason: z.string().optional() }).parse(req.body);
      await svc.cancel(req.actor!.org_id, id, req.actor!.zolexora_id, body.reason);
      return reply.status(204).send();
    },
  );
}
