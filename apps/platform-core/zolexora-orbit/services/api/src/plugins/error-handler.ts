import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export class OrbitError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "OrbitError";
  }
}

export function notFound(message = "Not found") {
  return new OrbitError(message, "NOT_FOUND", 404);
}

export function forbidden(message = "Forbidden") {
  return new OrbitError(message, "FORBIDDEN", 403);
}

export function unauthorized(message = "Unauthorized") {
  return new OrbitError(message, "UNAUTHORIZED", 401);
}

export function conflict(message: string) {
  return new OrbitError(message, "CONFLICT", 409);
}

export function registerErrorHandler(server: FastifyInstance) {
  server.setErrorHandler((error, _req, reply) => {
    if (error instanceof OrbitError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.flatten().fieldErrors,
        },
      });
    }

    // Fastify's own validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request",
          details: error.validation,
        },
      });
    }

    server.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  });
}
