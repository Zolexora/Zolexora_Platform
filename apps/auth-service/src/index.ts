import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  const app = await buildApp({ logger: true });

  const shutdown = async (signal: string) => {
    app.log.info(`[SHUTDOWN] ${signal} received, closing.`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, "[SHUTDOWN_ERROR]");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const address = await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Zolexora auth service listening on ${address} (${env.NODE_ENV})`);
}

main().catch((err) => {
  console.error("[FATAL] Startup failed:", err?.message ?? err);
  process.exit(1);
});
