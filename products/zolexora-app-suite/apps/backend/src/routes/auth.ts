import { Router, type Request, type Response } from 'express'
import { createZolexoraAuth } from '@zolexora/user-auth-zolexora'

export const authRouter = Router()

let authInstance: ReturnType<typeof createZolexoraAuth> | null = null

function getAuth() {
  if (!authInstance) {
    authInstance = createZolexoraAuth({
      appUrl: process.env.APP_SUITE_AUTH_APP_URL || 'http://localhost:3070',
    })
  }
  return authInstance
}

// POST /api/auth/sign-in
authRouter.post('/sign-in', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await getAuth().signIn(email, password)
    res.json({
      success: true,
      user: result.user,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    })
  } catch (error: unknown) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Invalid credentials',
    })
  }
})

// POST /api/auth/sign-up
authRouter.post('/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    await getAuth().signUp(email, password)
    res.json({
      success: true,
      message: 'User created. OTP verification email sent.',
    })
  } catch (error: unknown) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Signup failed',
    })
  }
})

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const user = await getAuth().verifyEmailOtp(email, otp)
    res.json({
      success: true,
      user,
    })
  } catch (error: unknown) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Verification failed',
    })
  }
})

// GET /api/auth/session
authRouter.get('/session', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query.token as string)

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const user = await getAuth().getUser(token)
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    res.json({ user })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Session verification failed',
    })
  }
})
