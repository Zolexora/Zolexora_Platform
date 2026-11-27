import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { PaymentService } from "../../../modules/payment/payment.service.js";

export async function paymentRoutes(server: FastifyInstance) {
  const svc = new PaymentService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PAYMENT_READ)],
      schema: { tags: ["payments"], summary: "List payments" },
    },
    async (req) => {
      const query = z.object({
        appointmentId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        status: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }).parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.post(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PAYMENT_WRITE)],
      schema: { tags: ["payments"], summary: "Record payment" },
    },
    async (req, reply) => {
      const body = z.object({
        appointmentId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        amount: z.number().int().min(1),
        currency: z.string().length(3).default("INR"),
        method: z.enum(["cash", "card", "upi", "online", "wallet", "other"]),
        notes: z.string().max(500).optional(),
      }).parse(req.body);
      return reply.status(201).send(await svc.record(req.actor!.org_id, body));
    },
  );

  server.post(
    "/:id/refund",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.PAYMENT_REFUND)],
      schema: { tags: ["payments"], summary: "Refund payment" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = z.object({ reason: z.string().optional() }).parse(req.body);
      return svc.refund(req.actor!.org_id, id, body.reason);
    },
  );
}
