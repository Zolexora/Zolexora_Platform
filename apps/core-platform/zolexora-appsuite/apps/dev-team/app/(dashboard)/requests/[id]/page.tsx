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
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#CBD5E1]/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to All Requests
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#404040] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">
              {request.title}
            </h1>
            <Badge color={requestStatusColor[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>
          <p className="text-xs text-[#CBD5E1]/70 mt-1.5 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#CBD5E1]" />
            Client: <span className="font-mono text-white">{request.user_email}</span>
            <span>•</span>
            <Calendar className="w-3.5 h-3.5 text-[#CBD5E1]" />
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
          className="inline-flex items-center gap-2 bg-[#0B1F3A] hover:bg-[#142E54] text-white border border-[#CBD5E1]/40 font-semibold text-xs px-4 py-2 rounded-lg transition-colors shrink-0 shadow-xs"
        >
          <PlusCircle className="w-4 h-4 text-[#CBD5E1]" /> Generate &amp; Dispatch Contract
        </Link>
      </div>

      {/* Status Management Bar */}
      <Card className="p-5 bg-[#0A0A0A] border-l-4 border-l-[#0B1F3A] border-y-[#404040] border-r-[#404040]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
          Workflow Pipeline State
        </h2>
        <RequestStatusUpdater
          requestId={request.id}
          currentStatus={request.status}
        />
      </Card>

      {/* Request Specifications */}
      <Card className="p-6 space-y-4 bg-[#0A0A0A] border border-[#404040]">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#CBD5E1]/80">
          Client Requirements &amp; Scope Description
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 border-y border-[#404040] py-4">
          <div>
            <p className="text-xs text-[#CBD5E1]/70">Category</p>
            <p className="text-sm font-medium text-white mt-0.5">
              {request.category || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#CBD5E1]/70">Indicated Budget</p>
            <p className="text-sm font-medium text-white mt-0.5">
              {request.budget_range || 'Flexible'}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs text-[#CBD5E1]/70 mb-2">Description &amp; Notes</p>
          <div className="p-4 rounded-lg bg-[#080C14] border border-[#404040] text-sm text-[#CBD5E1] whitespace-pre-wrap leading-relaxed font-sans">
            {request.description}
          </div>
        </div>
      </Card>

      {/* Linked Contracts */}
      <Card className="p-6 space-y-4 bg-[#0A0A0A] border border-[#404040]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#CBD5E1]/80 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#CBD5E1]" /> Linked Legal Contracts ({linkedContracts.length})
          </h2>
          {linkedContracts.length === 0 && (
            <Link
              href={`/contracts/new?requestId=${request.id}&userId=${request.user_id}&title=${encodeURIComponent(
                `${request.title} Agreement`
              )}`}
              className="text-xs font-semibold text-[#CBD5E1] hover:text-white transition-colors"
            >
              + Create Contract
            </Link>
          )}
        </div>

        {linkedContracts.length === 0 ? (
          <p className="text-xs text-[#CBD5E1]/60 italic">
            No contract dispatched for this request yet. Click &quot;Generate &amp; Dispatch Contract&quot; above to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {linkedContracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-[#404040] bg-[#080C14] hover:border-[#CBD5E1]/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{contract.title}</p>
                  <p className="text-xs text-[#CBD5E1]/70 mt-0.5">
                    {contract.contract_type} • ₹{Number(contract.total_value_inr || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge
                  color={
                    contract.status === 'signed'
                      ? 'white'
                      : contract.status === 'sent'
                      ? 'navy'
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
