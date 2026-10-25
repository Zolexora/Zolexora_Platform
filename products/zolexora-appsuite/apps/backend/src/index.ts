import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { requestsRouter } from './routes/requests.js'
import { contractsRouter } from './routes/contracts.js'
import { clientsRouter } from './routes/clients.js'
import { getDbPool } from './db.js'

const app = express()
const port = Number(process.env.PORT) || 3072

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3070',
      'http://localhost:3071',
      process.env.APP_SUITE_CLIENT_URL || '',
      process.env.APP_SUITE_DEV_TEAM_URL || '',
    ].filter(Boolean),
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Root welcome route
app.get('/', (_req, res) => {
  res.json({
    service: 'Zolexora App Suite Backend API',
    version: '1.0.0',
    port,
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      auth: '/api/auth',
      requests: '/api/requests',
      contracts: '/api/contracts',
      clients: '/api/clients',
    },
  })
})

// Route mounts
app.use('/health', healthRouter)
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/requests', requestsRouter)
app.use('/api/contracts', contractsRouter)
app.use('/api/clients', clientsRouter)

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Error Handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Server Error]:', err)
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error',
  })
})

// Boot server
async function start() {
  try {
    const pool = getDbPool()
    const { rows } = await pool.query('SELECT NOW() as boot_time')
    console.log(`[Database] Connected to PostgreSQL at ${rows[0].boot_time}`)

    app.listen(port, () => {
      console.log(`🚀 Zolexora App Suite Backend API listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('[Boot Error] Failed to connect to database:', error)
    process.exit(1)
  }
}

start()
