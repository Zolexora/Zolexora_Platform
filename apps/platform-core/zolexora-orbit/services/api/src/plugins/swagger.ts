import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function registerSwagger(server: FastifyInstance) {
  if (!env.SWAGGER_ENABLED) return;

  const { default: swagger } = await import("@fastify/swagger");
  const { default: swaggerUi } = await import("@fastify/swagger-ui");

  await server.register(swagger, {
    openapi: {
      info: {
        title: "Zolexora Orbit API",
        description:
          "Universal Appointment & Professional Service Management Platform",
        version: "1.0.0",
      },
      servers: [{ url: "/api/v1" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Business session access token issued by Zolexora Auth Service",
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: "health", description: "Health checks" },
        { name: "organization", description: "Organization operations" },
        { name: "customers", description: "Customer management" },
        { name: "professionals", description: "Professional profiles" },
        { name: "services", description: "Service catalogue" },
        { name: "appointments", description: "Appointment management" },
        { name: "schedule", description: "Scheduling" },
        { name: "resources", description: "Resource management" },
        { name: "payments", description: "Payment management" },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
  });
}
