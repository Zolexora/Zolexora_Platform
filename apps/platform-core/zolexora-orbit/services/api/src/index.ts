import "dotenv/config"; // only for local dev outside infisical
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const server = await buildApp();

try {
  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  server.log.info(`Zolexora Orbit API listening on port ${env.PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
