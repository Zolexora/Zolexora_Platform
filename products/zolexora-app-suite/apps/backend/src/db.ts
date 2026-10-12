import { Pool, type QueryResult, type QueryResultRow } from 'pg'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
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

    pool = new Pool({
      host: parsed.hostname,
      port: Number(parsed.port) || 5432,
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      max: 10,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    })
  }

  return pool
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getDbPool()
  return p.query<T>(text, params)
}
