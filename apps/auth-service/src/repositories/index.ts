import { PostgresAuthRepository } from "./postgres-auth.repository.js";
import { env } from "../config/env.js";
import { pgDb } from "../db.js";

/** Connects to PostgreSQL and fails startup if either database is unreachable. */
export async function getAuthRepository(): Promise<PostgresAuthRepository> {
  const repo = new PostgresAuthRepository(pgDb(env.AUTH_DATABASE_URL, 10), pgDb(env.ADMIN_DATABASE_URL, 5));
  if (!(await repo.isHealthy())) {
    await repo.close();
    throw new Error("[DB_FATAL] Auth or admin PostgreSQL database is unreachable.");
  }
  return repo;
}

export * from "./types.js";
export { PostgresAuthRepository };
