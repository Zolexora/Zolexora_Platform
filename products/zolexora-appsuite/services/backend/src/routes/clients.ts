import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'

export const clientsRouter = Router()

// GET /api/clients
clientsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT
        u.id,
        u.email,
        u.email_verified_at,
        u.created_at,
        COUNT(DISTINCT r.id)::text as total_requests,
        COUNT(DISTINCT c.id)::text as total_contracts
      FROM public.zolexora_auth_users u
      LEFT JOIN public.app_requests r ON u.id = r.user_id
      LEFT JOIN public.contracts c ON u.id = c.user_id
      GROUP BY u.id, u.email, u.email_verified_at, u.created_at
      ORDER BY u.created_at DESC
    `)

    res.json({ data: rows })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})
