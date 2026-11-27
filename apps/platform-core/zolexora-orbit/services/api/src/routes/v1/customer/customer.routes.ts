import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../../../middleware/auth.middleware.js";
import { ORBIT_PERMISSIONS } from "../../../config/constants.js";
import { CustomerService } from "../../../modules/customer/customer.service.js";

const createCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.string().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export async function customerRoutes(server: FastifyInstance) {
  const svc = new CustomerService();

  server.get(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.CUSTOMER_READ)],
      schema: { tags: ["customers"], summary: "List customers" },
    },
    async (req) => {
      const query = z.object({
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }).parse(req.query);
      return svc.list(req.actor!.org_id, query);
    },
  );

  server.post(
    "/",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.CUSTOMER_WRITE)],
      schema: { tags: ["customers"], summary: "Create customer profile" },
    },
    async (req, reply) => {
      const body = createCustomerSchema.parse(req.body);
      const customer = await svc.create(req.actor!.org_id, body);
      return reply.status(201).send(customer);
    },
  );

  server.get(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.CUSTOMER_READ)],
      schema: { tags: ["customers"], summary: "Get customer" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return svc.getById(req.actor!.org_id, id);
    },
  );

  server.put(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.CUSTOMER_WRITE)],
      schema: { tags: ["customers"], summary: "Update customer" },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = createCustomerSchema.partial().parse(req.body);
      return svc.update(req.actor!.org_id, id, body);
    },
  );

  server.delete(
    "/:id",
    {
      preHandler: [requireAuth(), requirePermissions(ORBIT_PERMISSIONS.CUSTOMER_DELETE)],
      schema: { tags: ["customers"], summary: "Delete customer" },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await svc.softDelete(req.actor!.org_id, id);
      return reply.status(204).send();
    },
  );
}
