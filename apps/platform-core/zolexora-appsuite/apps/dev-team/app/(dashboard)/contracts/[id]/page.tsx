import { notFound } from 'next/navigation'
import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, contractStatusColor } from '@/components/ui/badge'
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type Contract,
  type ContractAuditLog,
} from '@/lib/types'
import {
  ArrowLeft,
  ShieldCheck,
  ExternalLink,
  Calendar,
  Hash,
  User,
  Clock,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Contract #${id.slice(0, 8)} | DevTeam Legal` }
}

export default async function TeamContractDetailPage({ params }: Props) {
  const { id } = await params

  const [{ rows: contracts }, { rows: auditLogs }] = await Promise.all([
    query<Contract & { user_email: string; request_title?: string }>(
      `SELECT c.*, u.email as user_email, r.title as request_title
       FROM public.contracts c
       JOIN public.zolexora_auth_users u ON c.user_id = u.id
       LEFT JOIN public.app_requests r ON c.request_id = r.id
       WHERE c.id = $1 LIMIT 1`,
      [id]
    ),
    query<ContractAuditLog>(
      `SELECT * FROM public.contract_audit_logs
       WHERE contract_id = $1
       ORDER BY timestamp_utc DESC`,
      [id]
    ),
  ])

  const contract = contracts[0]
  if (!contract) notFound()

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#CBD5E1]/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#404040] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">
              {contract.title}
            </h1>
            <Badge color={contractStatusColor[contract.status]}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Badge>
          </div>
          <p className="text-xs text-[#CBD5E1]/70 mt-1.5 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-[#CBD5E1]" />
            Client Signatory: <span className="font-mono text-white">{contract.user_email}</span>
            <span>•</span>
            <Calendar className="w-3.5 h-3.5 text-[#CBD5E1]" />
            Created {new Date(contract.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        <a
          href={`http://localhost:3070/api/contracts/${contract.id}/document`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#0B1F3A] border border-[#CBD5E1]/40 hover:bg-[#142E54] text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors shrink-0 shadow-xs"
        >
          <ExternalLink className="w-4 h-4 text-[#CBD5E1]" /> Preview Legal Document HTML
        </a>
      </div>

      {/* Contract Metadata Grid */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-[#0A0A0A] border border-[#404040]">
          <p className="text-xs text-[#CBD5E1]/70 font-semibold uppercase tracking-wider">
            Contract Type
          </p>
          <p className="text-base font-bold text-white mt-1">
            {CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type}
          </p>
        </Card>

        <Card className="p-4 bg-[#0A0A0A] border border-[#404040]">
          <p className="text-xs text-[#CBD5E1]/70 font-semibold uppercase tracking-wider">
            Total Contract Value
          </p>
          <p className="text-base font-bold text-white mt-1">
            {contract.total_value_inr
              ? `₹${Number(contract.total_value_inr).toLocaleString('en-IN')}`
              : 'Variable'}
          </p>
        </Card>

        <Card className="p-4 bg-[#0A0A0A] border border-[#404040]">
          <p className="text-xs text-[#CBD5E1]/70 font-semibold uppercase tracking-wider">
            Signing Mode
          </p>
          <p className="text-base font-bold text-[#CBD5E1] mt-1">
            {contract.signing_mode}
          </p>
        </Card>
      </div>

      {/* Legal Integrity & Cryptography Hashes */}
      <Card className="p-5 space-y-3 bg-[#0A0A0A] border border-[#404040]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-2">
          <Hash className="w-4 h-4 text-[#CBD5E1]" /> Cryptographic Integrity Hashes (SHA-256)
        </h2>

        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded bg-[#080C14] border border-[#404040]">
            <span className="text-[#CBD5E1]/60">Pre-signature Document Hash:</span>
            <p className="text-[#CBD5E1] mt-0.5 break-all">
              {contract.document_hash || 'Will be generated upon client initial preview'}
            </p>
          </div>

          <div className="p-2.5 rounded bg-[#080C14] border border-[#404040]">
            <span className="text-[#CBD5E1]/60">Signed Executed Document Hash:</span>
            <p className="text-white font-semibold mt-0.5 break-all">
              {contract.signed_document_hash || 'Pending client signature execution'}
            </p>
          </div>
        </div>

        {contract.signed_at && (
          <div className="flex items-center gap-2 text-xs text-white font-semibold pt-1">
            <ShieldCheck className="w-4 h-4 text-[#CBD5E1]" /> Legally executed on{' '}
            {new Date(contract.signed_at).toLocaleString('en-IN')}
          </div>
        )}
      </Card>

      {/* Scope Summary */}
      <Card className="p-5 space-y-2 bg-[#0A0A0A] border border-[#404040]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]/70">
          Scope Summary &amp; Deliverables
        </h2>
        <p className="text-sm text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
          {contract.scope_summary || 'No custom scope notes recorded.'}
        </p>
      </Card>

      {/* Section 65B Audit Trail */}
      <Card className="p-5 space-y-3 bg-[#0A0A0A] border border-[#404040]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#CBD5E1]" /> Evidence Act Section 65B Audit Trail ({auditLogs.length})
          </h2>
          <span className="text-[10px] text-[#CBD5E1] bg-[#080C14] border border-[#404040] px-2 py-0.5 rounded">
            Tamper-evident Event Log
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-[#CBD5E1]/60 italic">
            No audit events logged yet. Events are logged when the client views or signs the document.
          </p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-[#404040] bg-[#080C14] text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white tracking-wide">
                    {log.action}
                  </span>
                  <span className="text-[#CBD5E1]/60">
                    {new Date(log.timestamp_utc).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#CBD5E1]/70">
                  <span>Signer: <strong className="text-white">{log.signer_name}</strong></span>
                  <span>IP: <strong className="text-white font-mono">{log.ip_address}</strong></span>
                  <span>Verification: <strong className="text-white">{log.verification_method}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
