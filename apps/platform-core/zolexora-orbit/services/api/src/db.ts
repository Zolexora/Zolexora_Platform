import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "./config/env.js";
import * as schema from "./db/schema.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.ORBIT_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === "development" });
export type Database = typeof db;
