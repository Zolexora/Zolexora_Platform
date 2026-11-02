import { IAuthRepository } from "./types.js";
import { PostgresAuthRepository } from "./postgres-auth.repository.js";
import { env } from "../config/env.js";

/** Connects to PostgreSQL and fails startup if either database is unreachable. */
export async function getAuthRepository(): Promise<IAuthRepository> {
  const repo = new PostgresAuthRepository(env.AUTH_DATABASE_URL, env.ADMIN_DATABASE_URL);
  if (!(await repo.isHealthy())) {
    await repo.close();
    throw new Error("[DB_FATAL] Auth or admin PostgreSQL database is unreachable.");
  }
  return repo;
}

export * from "./types.js";
