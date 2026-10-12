import type { Pool } from 'pg'
import type { StoredZolexoraUser, ZolexoraAuthStore, ZolexoraTokenPurpose } from './types'

type UserRow = {
  id: string
  email: string
  password_hash: string
  email_verified_at: Date | null
}

function toUser(row: UserRow): StoredZolexoraUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
  }
}

/** PostgreSQL storage adapter. Pass a shared pg Pool when hosting multiple app instances. */
export function createPostgresAuthStore(pool: Pool): ZolexoraAuthStore {
  return {
    async findUserByEmail(email) {
      const { rows } = await pool.query<UserRow>(
        'SELECT id, email, password_hash, email_verified_at FROM public.zolexora_auth_users WHERE email = $1 LIMIT 1',
        [email],
      )
      return rows[0] ? toUser(rows[0]) : null
    },

    async createUser(input) {
      try {
        const { rows } = await pool.query<UserRow>(
          'INSERT INTO public.zolexora_auth_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash, email_verified_at',
          [input.email, input.passwordHash],
        )
        return toUser(rows[0])
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error('An account with this email already exists.')
        }
        throw error
      }
    },

    async setEmailVerified(userId, verifiedAt) {
      const { rowCount } = await pool.query(
        'UPDATE public.zolexora_auth_users SET email_verified_at = $2 WHERE id = $1',
        [userId, verifiedAt],
      )
      if (!rowCount) throw new Error('Account no longer exists.')
    },

    async updatePassword(userId, passwordHash) {
      const { rowCount } = await pool.query(
        `WITH updated AS (
          UPDATE public.zolexora_auth_users SET password_hash = $2 WHERE id = $1 RETURNING id
        ), revoked AS (
          DELETE FROM public.zolexora_auth_sessions WHERE user_id IN (SELECT id FROM updated) RETURNING user_id
        )
        SELECT id FROM updated`,
        [userId, passwordHash],
      )
      if (!rowCount) throw new Error('Account no longer exists.')
    },

    async createSession(input) {
      await pool.query(
        'INSERT INTO public.zolexora_auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [input.userId, input.tokenHash, input.expiresAt],
      )
    },

    async findUserBySession(input) {
      const { rows } = await pool.query<UserRow>(
        `SELECT u.id, u.email, u.password_hash, u.email_verified_at
         FROM public.zolexora_auth_sessions s
         JOIN public.zolexora_auth_users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > $2
         LIMIT 1`,
        [input.tokenHash, input.now],
      )
      return rows[0] ? toUser(rows[0]) : null
    },

    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM public.zolexora_auth_sessions WHERE token_hash = $1', [tokenHash])
    },

    async createToken(input) {
      await pool.query(
        'INSERT INTO public.zolexora_auth_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)',
        [input.userId, input.tokenHash, input.purpose, input.expiresAt],
      )
    },

    async consumeToken(input) {
      const { rows } = await pool.query<{ user_id: string }>(
        `DELETE FROM public.zolexora_auth_tokens
         WHERE token_hash = $1 AND purpose = $2 AND expires_at > $3
         RETURNING user_id`,
        [input.tokenHash, input.purpose satisfies ZolexoraTokenPurpose, input.now],
      )
      return rows[0]?.user_id ?? null
    },
  }
}
