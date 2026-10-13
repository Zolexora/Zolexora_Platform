import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dbStart = Date.now()
    const { rows } = await query('SELECT NOW() as current_time, 1 as status')
    const latencyMs = Date.now() - dbStart

    res.json({
      status: 'healthy',
      service: '@zas/backend',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latencyMs,
        serverTime: rows[0]?.current_time,
      },
    })
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      service: '@zas/backend',
      error: error instanceof Error ? error.message : 'Database error',
    })
  }
})
