import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge, requestStatusColor } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { REQUEST_STATUS_LABELS, type AppRequest } from '@/lib/types'
import { ArrowLeft, Calendar, Tag, DollarSign, FileText } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Request #${id.slice(0, 8)}` }
}

export default async function RequestDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: request } = await supabase
    .from('app_requests')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!request) notFound()

  const req = request as AppRequest

  const statusSteps = [
    'submitted',
    'in_review',
    'contracted',
    'in_development',
    'delivered',
  ] as const

  const currentIndex = statusSteps.indexOf(req.status)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/requests"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Requests
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {req.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Submitted on{' '}
            {new Date(req.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Badge color={requestStatusColor[req.status]}>
          {REQUEST_STATUS_LABELS[req.status]}
        </Badge>
      </div>

      {/* Progress */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Project Progress
        </h2>
        <div className="flex items-center gap-0">
          {statusSteps.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    i <= currentIndex
                      ? 'bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)] text-white'
                      : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {i < currentIndex ? '✓' : i + 1}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] text-center w-16 leading-tight hidden sm:block">
                  {REQUEST_STATUS_LABELS[step]}
                </span>
              </div>
              {i < statusSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 transition-colors ${
                    i < currentIndex
                      ? 'bg-[var(--color-brand-primary)]'
                      : 'bg-[var(--color-border)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Project Details
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {req.category && (
            <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
              <Tag className="w-4 h-4 shrink-0" />
              <span>
                <span className="text-[var(--color-text-primary)] font-medium">
                  Category:
                </span>{' '}
                {req.category}
              </span>
            </div>
          )}
          {req.budget_range && (
            <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>
                <span className="text-[var(--color-text-primary)] font-medium">
                  Budget:
                </span>{' '}
                {req.budget_range}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>
              <span className="text-[var(--color-text-primary)] font-medium">
                Last updated:
              </span>{' '}
              {new Date(req.updated_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Description
          </p>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
            {req.description}
          </p>
        </div>
      </Card>

      {/* Next Steps */}
      {req.status === 'submitted' && (
        <Card className="border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/5">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[var(--color-brand-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                What happens next?
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Our team will review your request within 48 hours and reach out
                to you with a detailed proposal including scope, timeline, and
                cost estimate.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
