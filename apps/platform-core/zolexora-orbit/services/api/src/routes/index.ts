import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./v1/health/health.routes.js";
import { organizationRoutes } from "./v1/organization/organization.routes.js";
import { customerRoutes } from "./v1/customer/customer.routes.js";
import { professionalRoutes } from "./v1/professional/professional.routes.js";
import { serviceRoutes } from "./v1/service/service.routes.js";
import { appointmentRoutes } from "./v1/appointment/appointment.routes.js";
import { scheduleRoutes } from "./v1/schedule/schedule.routes.js";
import { resourceRoutes } from "./v1/resource/resource.routes.js";
import { paymentRoutes } from "./v1/payment/payment.routes.js";

export async function registerRoutes(server: FastifyInstance) {
  // Health (no auth)
  await server.register(healthRoutes);

  // All business routes under /api/v1
  await server.register(
    async (v1) => {
      await v1.register(organizationRoutes, { prefix: "/organizations" });
      await v1.register(customerRoutes, { prefix: "/customers" });
      await v1.register(professionalRoutes, { prefix: "/professionals" });
      await v1.register(serviceRoutes, { prefix: "/services" });
      await v1.register(appointmentRoutes, { prefix: "/appointments" });
      await v1.register(scheduleRoutes, { prefix: "/schedules" });
      await v1.register(resourceRoutes, { prefix: "/resources" });
      await v1.register(paymentRoutes, { prefix: "/payments" });
    },
    { prefix: "/api/v1" },
  );
}
