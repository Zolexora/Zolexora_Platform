import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, requestStatusColor } from '@/components/ui/badge'
import {
  REQUEST_STATUS_LABELS,
  type AppRequest,
  type RequestStatus,
} from '@/lib/types'
import { GitPullRequest, ArrowRight, Filter } from 'lucide-react'

export const metadata = { title: 'All App Requests | DevTeam Console' }

export default async function TeamRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  const statusFilter = status && ['submitted', 'in_review', 'contracted', 'in_development', 'delivered'].includes(status)
    ? status
    : null

  const sql = statusFilter
    ? `SELECT r.*, u.email as user_email
       FROM public.app_requests r
       JOIN public.zolexora_auth_users u ON r.user_id = u.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC`
    : `SELECT r.*, u.email as user_email
       FROM public.app_requests r
       JOIN public.zolexora_auth_users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`

  const params = statusFilter ? [statusFilter] : []
  const { rows: requests } = await query<AppRequest & { user_email: string }>(sql, params)

  const tabs: { label: string; value?: RequestStatus }[] = [
    { label: 'All' },
    { label: 'Submitted (New)', value: 'submitted' },
    { label: 'In Review', value: 'in_review' },
    { label: 'Contracted', value: 'contracted' },
    { label: 'In Development', value: 'in_development' },
    { label: 'Delivered', value: 'delivered' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Application Development Requests
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Browse and manage all customer requests across Zolexora App Suite.
          </p>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg">
          Total: <span className="font-semibold text-white">{requests.length}</span> requests
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] pb-3">
        {tabs.map((tab) => {
          const isActive = (!tab.value && !statusFilter) || tab.value === statusFilter
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/requests?status=${tab.value}` : '/requests'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--color-brand-primary)] text-black font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* List */}
      {requests.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-text-muted)]">
          <GitPullRequest className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          No requests found matching this filter.
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-base text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                      {r.title}
                    </p>
                    <Badge color={requestStatusColor[r.status]}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>

                  <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                    Client: <span className="text-zinc-200 font-mono">{r.user_email}</span>
                  </p>

                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                    {r.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                    <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-[11px] text-zinc-300">
                      {r.category || 'Web Application'}
                    </span>
                    <span>Budget: <strong className="text-zinc-200">{r.budget_range || 'Flexible'}</strong></span>
                    <span>•</span>
                    <span>Submitted: {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-[var(--color-brand-primary)] font-medium shrink-0 self-center">
                  <span>Manage</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
