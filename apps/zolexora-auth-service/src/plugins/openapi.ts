import { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { CONSTANTS } from "../config/constants.js";

export async function registerOpenApi(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Zolexora Centralized Authentication Service",
        version: CONSTANTS.SERVICE_VERSION,
        description:
          "Production-hardened Central Authentication Microservice for Zolexora Platform, supporting Track 1 (Global Identity), Track 2 (Organization-Scoped Employee), and Track 3 (Platform Admin) authentication, Argon2id/Scrypt crypto, Turnstile anti-abuse, and secure storage.",
      },
      servers: [
        { url: "http://localhost:3081", description: "Local Development Gateway" },
        { url: "https://auth.zolexora.com", description: "Production Authority Gateway" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          turnstileHeader: {
            type: "apiKey",
            in: "header",
            name: "CF-Turnstile-Token",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Raw OpenAPI JSON specification
  app.get("/openapi.json", async (_req, reply) => {
    return reply.type("application/json").send(app.swagger());
  });

  // Support /docs responding with json if requested via Accept: application/json
  app.addHook("onRequest", async (req, reply) => {
    if (
      (req.url === "/docs" || req.url === "/docs/") &&
      req.headers.accept?.includes("application/json")
    ) {
      return reply.type("application/json").send(app.swagger());
    }
  });
}
