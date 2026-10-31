import { buildApp } from "./app.js";
import { env, refreshEnv } from "./config/env.js";
import { syncSecretsFromInfisical } from "./config/infisical.js";

async function main() {
  const secretsDiag = await syncSecretsFromInfisical();
  refreshEnv();

  const app = await buildApp({ logger: true });

  app.log.info(
    `🔐 [SECRETS_SYNC] Provider: ${secretsDiag.provider} | Status: ${secretsDiag.status} | Synced: ${secretsDiag.syncedCount} keys (${secretsDiag.durationMs}ms)`
  );
  for (const msg of secretsDiag.diagnostics) {
    app.log.debug(`[SECRETS_DIAG] ${msg}`);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`[SHUTDOWN] Received signal ${signal}. Initiating graceful shutdown...`);
    try {
      await app.close();
      app.log.info("[SHUTDOWN] Closed all HTTP listeners and database pools cleanly.");
      process.exit(0);
    } catch (err) {
      app.log.error(err, "[SHUTDOWN_ERROR] Error encountered during shutdown:");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(
      `🚀 Zolexora Centralized Authentication Microservice listening on ${address} (Environment: ${env.NODE_ENV})`
    );
    app.log.info(`📖 Interactive OpenAPI 3.1 documentation available at ${address}/docs`);
    app.log.info(`📄 Raw OpenAPI 3.1 JSON available at ${address}/openapi.json`);
  } catch (err: any) {
    if (err.code === "EADDRINUSE") {
      app.log.error(
        `[PORT_CONFLICT] Port ${env.PORT} is already in use by another process. Please free port ${env.PORT} or set PORT environment variable.`
      );
    } else {
      app.log.error(err, "[FATAL_STARTUP] Failed to initialize server:");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FATAL] Unhandled bootstrap failure:", err);
  process.exit(1);
});
