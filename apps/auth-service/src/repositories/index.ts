import { IAuthRepository } from "./types.js";
import { PostgresAuthRepository } from "./postgres-auth.repository.js";
import { InMemoryAuthRepository } from "./in-memory-auth.repository.js";
import { env } from "../config/env.js";

let repoInstance: IAuthRepository | null = null;

export async function getAuthRepository(): Promise<IAuthRepository> {
  if (repoInstance) return repoInstance;

  // In test mode or when configured, can use memory directly
  if (process.env.AUTH_REPO_MODE === "memory") {
    repoInstance = new InMemoryAuthRepository();
    return repoInstance;
  }

  const pgRepo = new PostgresAuthRepository(
    env.AUTH_DATABASE_URL,
    env.ADMIN_DATABASE_URL
  );

  // Probe health
  const healthy = await pgRepo.isHealthy();
  if (!healthy) {
    // If postgres isn't running or accessible, pgRepo will seamlessly use fallback
    console.warn(
      `[AUTH_REPO_NOTICE] PostgreSQL connection at ${env.AUTH_DATABASE_URL} not immediately available. Dual repository running with initialized seeded in-memory fallback.`
    );
  }

  repoInstance = pgRepo;
  return repoInstance;
}

export * from "./types.js";
