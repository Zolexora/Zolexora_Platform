import { notFound } from 'next/navigation'
import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, requestStatusColor } from '@/components/ui/badge'
import { RequestStatusUpdater } from '@/components/dashboard/request-status-updater'
import {
  REQUEST_STATUS_LABELS,
  type AppRequest,
  type Contract,
} from '@/lib/types'
import {
  ArrowLeft,
  Calendar,
  FileCheck,
  User,
  PlusCircle,
  FolderOpen,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Manage Request #${id.slice(0, 8)} | DevTeam` }
}

export default async function TeamRequestDetailPage({ params }: Props) {
  const { id } = await params

  const { rows } = await query<AppRequest & { user_email: string }>(
    `SELECT r.*, u.email as user_email
     FROM public.app_requests r
     JOIN public.zolexora_auth_users u ON r.user_id = u.id
     WHERE r.id = $1 LIMIT 1`,
    [id]
  )

  const request = rows[0]
  if (!request) notFound()

  // Find any contracts already linked to this request
  const { rows: linkedContracts } = await query<Contract>(
    `SELECT * FROM public.contracts WHERE request_id = $1 ORDER BY created_at DESC`,
    [id]
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back button */}
      <Link
        href="/requests"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to All Requests
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--color-border)] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {request.title}
            </h1>
            <Badge color={requestStatusColor[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            Client: <span className="font-mono text-zinc-200">{request.user_email}</span>
            <span>•</span>
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            Submitted {new Date(request.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <Link
          href={`/contracts/new?requestId=${request.id}&userId=${request.user_id}&title=${encodeURIComponent(
            `${request.title} Agreement`
          )}`}
          className="inline-flex items-center gap-2 bg-[var(--color-brand-primary)] text-black font-semibold text-xs px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Generate & Dispatch Contract
        </Link>
      </div>

      {/* Status Management Bar */}
      <Card className="p-5 bg-zinc-900/40 border-l-4 border-l-[var(--color-brand-primary)]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] mb-3">
          Workflow Pipeline State
        </h2>
        <RequestStatusUpdater
          requestId={request.id}
          currentStatus={request.status}
        />
      </Card>

      {/* Request Specifications */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Client Requirements & Scope Description
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 border-y border-[var(--color-border)] py-4">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Category</p>
            <p className="text-sm font-medium text-white mt-0.5">
              {request.category || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Indicated Budget</p>
            <p className="text-sm font-medium text-white mt-0.5">
              {request.budget_range || 'Flexible'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Description & Notes</p>
          <div className="p-4 rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
            {request.description}
          </div>
        </div>
      </Card>

      {/* Linked Contracts */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" /> Linked Legal Contracts ({linkedContracts.length})
          </h2>
          {linkedContracts.length === 0 && (
            <Link
              href={`/contracts/new?requestId=${request.id}&userId=${request.user_id}&title=${encodeURIComponent(
                `${request.title} Agreement`
              )}`}
              className="text-xs text-[var(--color-brand-primary)] hover:underline"
            >
              + Create Contract
            </Link>
          )}
        </div>

        {linkedContracts.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] italic">
            No contract dispatched for this request yet. Click &quot;Generate &amp; Dispatch Contract&quot; above to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedContracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dark)] hover:border-[var(--color-brand-primary)]/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{contract.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {contract.contract_type} • ₹{Number(contract.total_value_inr || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge
                  color={
                    contract.status === 'signed'
                      ? 'emerald'
                      : contract.status === 'sent'
                      ? 'yellow'
                      : 'gray'
                  }
                >
                  {contract.status.toUpperCase()}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
