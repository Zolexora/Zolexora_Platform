import pg from "pg";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/** The only database surface the service uses: PostgreSQL in production, PGlite (real Postgres in WASM) in tests. */
export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Runs `fn` in one transaction; nested calls join the outer one. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function pgDb(connectionString: string, max: number): Db {
  const pool = new pg.Pool({ connectionString, max, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 2_000 });
  const run = async (c: pg.Pool | pg.PoolClient, sql: string, params?: unknown[]) => {
    const r = await c.query(sql, params as unknown[]);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  };
  return {
    query: (sql, params) => run(pool, sql, params),
    async tx(fn) {
      const client = await pool.connect();
      const inner: Db = { query: (sql, params) => run(client, sql, params), tx: (f) => f(inner), close: async () => {} };
      try {
        await client.query("BEGIN");
        const out = await fn(inner);
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
