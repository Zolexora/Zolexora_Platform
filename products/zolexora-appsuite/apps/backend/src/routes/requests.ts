import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import type { AppRequest } from '../types.js'

export const requestsRouter = Router()

// GET /api/requests?userId=&status=
requestsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query

    let sql = `
      SELECT r.*, u.email as user_email
      FROM public.app_requests r
      JOIN public.zolexora_auth_users u ON r.user_id = u.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (userId) {
      params.push(userId)
      sql += ` AND r.user_id = $${params.length}`
    }

    if (status) {
      params.push(status)
      sql += ` AND r.status = $${params.length}`
    }

    sql += ' ORDER BY r.created_at DESC'

    const { rows } = await query<AppRequest & { user_email: string }>(sql, params)
    res.json({ data: rows })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})

// GET /api/requests/:id
requestsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { rows } = await query<AppRequest & { user_email: string }>(
      `SELECT r.*, u.email as user_email
       FROM public.app_requests r
       JOIN public.zolexora_auth_users u ON r.user_id = u.id
       WHERE r.id = $1 LIMIT 1`,
      [id]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Request not found' })
    }

    res.json({ data: rows[0] })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})

// POST /api/requests
requestsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, title, description, category, budget_range } = req.body

    if (!userId || !title || !description) {
      return res.status(400).json({ error: 'userId, title, and description are required' })
    }

    const { rows } = await query<AppRequest>(
      `INSERT INTO public.app_requests (user_id, title, description, category, budget_range, status)
       VALUES ($1, $2, $3, $4, $5, 'submitted')
       RETURNING *`,
      [userId, title, description, category || null, budget_range || null]
    )

    res.status(201).json({ data: rows[0] })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create request',
    })
  }
})

// PATCH /api/requests/:id/status
requestsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['submitted', 'in_review', 'contracted', 'in_development', 'delivered']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const { rows } = await query<AppRequest>(
      `UPDATE public.app_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'Request not found' })
    }

    res.json({ data: rows[0] })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update request',
    })
  }
})
