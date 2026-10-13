import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, requestStatusColor, contractStatusColor } from '@/components/ui/badge'
import {
  REQUEST_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  type AppRequest,
  type Contract,
} from '@/lib/types'
import {
  GitPullRequest,
  FileCheck,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  PlusCircle,
  Users,
} from 'lucide-react'

export const metadata = { title: 'Overview | DevTeam Console' }

export default async function TeamOverviewPage() {
  const [
    { rows: requests },
    { rows: contracts },
    { rows: clientCountRow },
  ] = await Promise.all([
    query<AppRequest & { user_email: string }>(
      `SELECT r.*, u.email as user_email
       FROM public.app_requests r
       JOIN public.zolexora_auth_users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT 6`
    ),
    query<Contract & { user_email: string }>(
      `SELECT c.*, u.email as user_email
       FROM public.contracts c
       JOIN public.zolexora_auth_users u ON c.user_id = u.id
       ORDER BY c.created_at DESC
       LIMIT 6`
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM public.zolexora_auth_users`
    ),
  ])

  // Aggregate metrics
  const { rows: statsRows } = await query<{
    total_requests: string
    pending_review: string
    in_development: string
    delivered: string
  }>(`
    SELECT
      COUNT(*)::text as total_requests,
      COUNT(CASE WHEN status = 'submitted' THEN 1 END)::text as pending_review,
      COUNT(CASE WHEN status = 'in_development' THEN 1 END)::text as in_development,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END)::text as delivered
    FROM public.app_requests
  `)

  const { rows: contractStatsRows } = await query<{
    total_contracts: string
    signed_contracts: string
    pipeline_inr: string
  }>(`
    SELECT
      COUNT(*)::text as total_contracts,
      COUNT(CASE WHEN status = 'signed' THEN 1 END)::text as signed_contracts,
      COALESCE(SUM(total_value_inr), 0)::text as pipeline_inr
    FROM public.contracts
  `)

  const stats = statsRows[0] || {
    total_requests: '0',
    pending_review: '0',
    in_development: '0',
    delivered: '0',
  }

  const cStats = contractStatsRows[0] || {
    total_contracts: '0',
    signed_contracts: '0',
    pipeline_inr: '0',
  }

  const totalClients = clientCountRow[0]?.count || '0'
  const pipelineInrFormatted = Number(cStats.pipeline_inr).toLocaleString('en-IN')

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Engineering & Ops Console
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Review client requests, approve scopes, and dispatch legally binding contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/contracts/new"
            className="inline-flex items-center gap-2 bg-[var(--color-brand-primary)] text-black font-semibold text-xs px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <PlusCircle className="w-4 h-4" /> Dispatch Contract
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-[var(--color-text-primary)] mt-2">
            {stats.pending_review}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            New client submissions
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>In Development</span>
            <GitPullRequest className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-extrabold text-[var(--color-text-primary)] mt-2">
            {stats.in_development}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Active building phase
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Signed Contracts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-[var(--color-text-primary)] mt-2">
            {cStats.signed_contracts}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Executed with Sec 65B Audit
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-[var(--color-brand-primary)]">
          <div className="flex items-center justify-between text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Total Value Pipeline</span>
            <TrendingUp className="w-4 h-4 text-[var(--color-brand-primary)]" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--color-text-primary)] mt-2 truncate">
            ₹{pipelineInrFormatted}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Across {cStats.total_contracts} agreements
          </p>
        </Card>
      </div>

      {/* Grid: Recent Requests & Recent Contracts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Client Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-[var(--color-brand-primary)]" />
              Latest Client Requests
            </h2>
            <Link
              href="/requests"
              className="text-xs text-[var(--color-brand-primary)] hover:underline flex items-center gap-1"
            >
              All Requests <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {requests.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
              No application requests submitted yet.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {requests.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] p-3.5 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                        {r.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                        Client: <span className="text-zinc-300">{r.user_email}</span>
                      </p>
                    </div>
                    <Badge color={requestStatusColor[r.status]}>
                      {REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--color-text-muted)]">
                    <span>{r.category || 'General'}</span>
                    <span>•</span>
                    <span>{r.budget_range || 'Flexible budget'}</span>
                    <span>•</span>
                    <span>{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Contracts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Recent Legal Contracts
            </h2>
            <Link
              href="/contracts"
              className="text-xs text-[var(--color-brand-primary)] hover:underline flex items-center gap-1"
            >
              All Contracts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {contracts.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
              No contracts dispatched yet.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {contracts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] p-3.5 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                        {c.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                        Client: <span className="text-zinc-300">{c.user_email}</span>
                      </p>
                    </div>
                    <Badge color={contractStatusColor[c.status]}>
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--color-text-muted)]">
                    <span>{c.contract_type}</span>
                    <span>•</span>
                    <span>
                      {c.total_value_inr
                        ? `₹${Number(c.total_value_inr).toLocaleString('en-IN')}`
                        : 'Custom Value'}
                    </span>
                    <span>•</span>
                    <span>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
