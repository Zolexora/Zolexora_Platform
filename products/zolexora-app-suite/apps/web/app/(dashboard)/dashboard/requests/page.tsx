import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { Badge, requestStatusColor } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card } from '@/components/ui/card'
import { REQUEST_STATUS_LABELS, type AppRequest } from '@/lib/types'
import { PlusCircle, FolderOpen } from 'lucide-react'

export const metadata = { title: 'My Requests' }

export default async function RequestsPage() {
  const user = await getCurrentUser()
  const userId = user?.id

  const { rows: requests } = userId
    ? await query<AppRequest>(
        'SELECT * FROM public.app_requests WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      )
    : { rows: [] as AppRequest[] }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            My Requests
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            All your application development requests.
          </p>
        </div>
        <LinkButton href="/dashboard/new-request" className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> New Request
        </LinkButton>
      </div>

      {!requests || requests.length === 0 ? (
        <Card className="py-16 text-center">
          <FolderOpen className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">
            No requests yet
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            Submit your first app development request to get started.
          </p>
          <LinkButton href="/dashboard/new-request">
            Submit a Request
          </LinkButton>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req: AppRequest) => (
            <Link
              key={req.id}
              href={`/dashboard/requests/${req.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                    {req.title}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1 line-clamp-2">
                    {req.description}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                    {req.category && <span>{req.category}</span>}
                    {req.budget_range && (
                      <>
                        <span>·</span>
                        <span>{req.budget_range}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <Badge color={requestStatusColor[req.status]}>
                  {REQUEST_STATUS_LABELS[req.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
