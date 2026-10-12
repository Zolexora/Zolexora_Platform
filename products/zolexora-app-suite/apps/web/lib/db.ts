import { Pool, type QueryResult, type QueryResultRow } from 'pg'

// Global pool to prevent connection exhaustion during development HMR
const globalForDb = globalThis as unknown as {
  dbPool?: Pool
}

export function getDbPool(): Pool {
  if (!globalForDb.dbPool) {
    const databaseUrl = process.env.ZOLEXORA_AUTHENTICATION_DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        'Database connection URL missing. Ensure ZOLEXORA_AUTHENTICATION_DATABASE_URL is provided in Infisical.'
      )
    }

    const parsed = new URL(databaseUrl)
    const isSsl =
      parsed.searchParams.get('sslmode') === 'require' ||
      parsed.hostname.includes('supabase.com') ||
      parsed.hostname.includes('render.com') ||
      parsed.hostname.includes('neon.tech') ||
      parsed.hostname.includes('pooler.supabase.com')

    globalForDb.dbPool = new Pool({
      host: parsed.hostname,
      port: Number(parsed.port) || 5432,
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      max: 10,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    })
  }

  return globalForDb.dbPool
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getDbPool()
  return pool.query<T>(text, params)
}
