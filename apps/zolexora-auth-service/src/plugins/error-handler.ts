import { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from "fastify";

export interface AppErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, any>;
  headers?: Record<string, string>;
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, any>;
  public headers?: Record<string, string>;

  constructor(opts: AppErrorPayload) {
    super(opts.message);
    this.name = "AppError";
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
    this.headers = opts.headers;
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | AppError | Error, _req: FastifyRequest, reply: FastifyReply) => {
    _req.log.error(error);
    let statusCode = 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = error.message || "An unexpected error occurred.";
    let details: Record<string, any> = {};

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      details = error.details || {};
      if (error.headers) {
        for (const [key, val] of Object.entries(error.headers)) {
          reply.header(key, val);
        }
      }
    } else if (
(error as any).code === "FST_ERR_CTP_BODY_TOO_LARGE"
    ) {
      statusCode = 400;
      code = "AUTH_FILE_TOO_LARGE";
      message = "File size exceeds 10MB limit.";
      details = {};
    } else if ("statusCode" in error && typeof error.statusCode === "number") {
      statusCode = error.statusCode;
      code = (error as any).code || (statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST");
      message = error.message;
    } else if (error.name === "ZodError" && "issues" in (error as any)) {
      statusCode = 400;
      code = "VALIDATION_ERROR";
      details = { issues: (error as any).issues };
    }

    // Never leak internal error details (DB errors, stack messages) to clients.
    if (statusCode >= 500) {
      code = statusCode === 500 ? "INTERNAL_SERVER_ERROR" : code;
      message = error instanceof AppError ? error.message : "An unexpected error occurred.";
      details = {};
    }

    reply.status(statusCode).send({
      success: false,
      code,
      message,
      error: {
        code,
        message,
        details,
      },
    });
  });

  app.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      success: false,
      code: "NOT_FOUND",
      message: `Route ${_req.method} ${_req.url} not found`,
      error: {
        code: "NOT_FOUND",
        message: `Route ${_req.method} ${_req.url} not found`,
        details: {},
      },
    });
  });
}
