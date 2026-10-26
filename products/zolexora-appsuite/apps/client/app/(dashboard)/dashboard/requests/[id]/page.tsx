import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
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
  const user = await getCurrentUser()
  const userId = user?.id

  if (!userId) notFound()

  const { rows } = await query<AppRequest>(
    'SELECT * FROM public.app_requests WHERE id = $1 AND user_id = $2 LIMIT 1',
    [id, userId]
  )

  const request = rows[0]
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
        className="inline-flex items-center gap-2 text-sm text-[#CBD5E1]/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Requests
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {req.title}
          </h1>
          <p className="text-sm text-[#CBD5E1]/70 mt-1">
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
        <h2 className="text-sm font-semibold text-white mb-4">
          Project Progress
        </h2>
        <div className="flex items-center gap-0">
          {statusSteps.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    i <= currentIndex
                      ? 'bg-[#0B1F3A] border-[#CBD5E1] text-white'
                      : 'bg-[#080C14] border-[#404040] text-[#CBD5E1]/50'
                  }`}
                >
                  {i < currentIndex ? '✓' : i + 1}
                </div>
                <span className="text-[10px] text-[#CBD5E1]/70 text-center w-16 leading-tight hidden sm:block">
                  {REQUEST_STATUS_LABELS[step]}
                </span>
              </div>
              {i < statusSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 transition-colors ${
                    i < currentIndex
                      ? 'bg-[#CBD5E1]'
                      : 'bg-[#404040]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="text-sm font-semibold text-white mb-4">
          Project Details
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {req.category && (
            <div className="flex items-center gap-2.5 text-sm text-[#CBD5E1]/70">
              <Tag className="w-4 h-4 shrink-0 text-[#CBD5E1]" />
              <span>
                <span className="text-white font-medium">
                  Category:
                </span>{' '}
                {req.category}
              </span>
            </div>
          )}
          {req.budget_range && (
            <div className="flex items-center gap-2.5 text-sm text-[#CBD5E1]/70">
              <DollarSign className="w-4 h-4 shrink-0 text-[#CBD5E1]" />
              <span>
                <span className="text-white font-medium">
                  Budget:
                </span>{' '}
                {req.budget_range}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm text-[#CBD5E1]/70">
            <Calendar className="w-4 h-4 shrink-0 text-[#CBD5E1]" />
            <span>
              <span className="text-white font-medium">
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
          <p className="text-sm font-medium text-white mb-2">
            Description
          </p>
          <p className="text-sm text-[#CBD5E1]/70 leading-relaxed whitespace-pre-wrap">
            {req.description}
          </p>
        </div>
      </Card>

      {/* Next Steps */}
      {req.status === 'submitted' && (
        <Card className="border border-[#CBD5E1]/30 bg-[#0B1F3A]/40">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[#CBD5E1] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">
                What happens next?
              </p>
              <p className="text-sm text-[#CBD5E1]/80 mt-1">
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
