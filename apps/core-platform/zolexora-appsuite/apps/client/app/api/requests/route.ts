import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { AppRequest } from '@/lib/types'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { rows } = await query<AppRequest>(
      'SELECT * FROM public.app_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    )
    return NextResponse.json({ data: rows })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { title, description, category, budget_range } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      )
    }

    const { rows } = await query<AppRequest>(
      `INSERT INTO public.app_requests (user_id, title, description, category, budget_range, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, title, description, category ?? null, budget_range ?? null, 'submitted']
    )

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
