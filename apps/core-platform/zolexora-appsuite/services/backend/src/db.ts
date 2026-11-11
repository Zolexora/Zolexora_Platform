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
      databaseUrl.includes('sslmode=') ||
      databaseUrl.includes('supabase.com') ||
      databaseUrl.includes('render.com') ||
      databaseUrl.includes('neon.tech') ||
      databaseUrl.includes('pooler.supabase.com')

    pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      ssl: isSsl ? { rejectUnauthorized: false, servername: parsed.hostname } : false,
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
