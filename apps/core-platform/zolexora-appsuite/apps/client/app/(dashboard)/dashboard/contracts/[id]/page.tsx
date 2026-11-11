import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { Badge, contractStatusColor } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DigitalSigningModal } from '@/components/dashboard/digital-signing-modal'
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  type Contract,
  type ContractAuditLog,
} from '@/lib/types'
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  FileEdit,
  ShieldAlert,
  Hash,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `Contract #${id.slice(0, 8)}` }
}

const statusIcons = {
  draft: FileEdit,
  sent: Clock,
  signed: CheckCircle2,
  declined: XCircle,
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  const userId = user?.id

  if (!userId) notFound()

  const [{ rows: contracts }, { rows: auditLogs }] = await Promise.all([
    query<Contract>(
      'SELECT * FROM public.contracts WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId]
    ),
    query<ContractAuditLog>(
      'SELECT * FROM public.contract_audit_logs WHERE contract_id = $1 ORDER BY timestamp_utc DESC',
      [id]
    ),
  ])

  const contract = contracts[0]
  if (!contract) notFound()

  const c = contract as Contract
  const logs = (auditLogs || []) as ContractAuditLog[]
  const StatusIcon = statusIcons[c.status]
  const defaultSigner = 'Authorized Signatory'

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/contracts"
        className="inline-flex items-center gap-2 text-sm text-[#CBD5E1]/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0B1F3A] border border-[#CBD5E1]/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#CBD5E1]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {c.title}
            </h1>
            <p className="text-xs text-[#CBD5E1]/70 mt-0.5">
              {CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type} · Issued{' '}
              {new Date(c.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <Badge color={contractStatusColor[c.status]}>
          {CONTRACT_STATUS_LABELS[c.status]}
        </Badge>
      </div>

      {/* Indian Stamp Duty Notice Banner */}
      <div className="rounded-xl border border-[#CBD5E1]/30 bg-[#0B1F3A]/40 p-4 text-xs text-[#CBD5E1] flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 text-[#CBD5E1] mt-0.5" />
        <div>
          <span className="font-semibold text-white">Indian Stamp Act & Legal Enforceability:</span>{' '}
          Governing state: {c.stamp_state || 'MAHARASHTRA'} · e-Stamp Reference:{' '}
          <span className="font-mono text-white">{c.stamp_duty_ref || 'PENDING_ADHESIVE_DUTY'}</span>.
          Compliant with Section 10A of the Information Technology Act, 2000.
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#121824] border border-[#404040] flex items-center justify-center shrink-0">
            <StatusIcon className="w-5 h-5 text-[#CBD5E1]" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">
              {c.status === 'draft' && 'Contract is being drafted with legal clauses'}
              {c.status === 'sent' && 'Contract issued — awaiting your digital signature'}
              {c.status === 'signed' && 'Contract digitally executed — legally active'}
              {c.status === 'declined' && 'Contract was declined'}
            </p>
            <p className="text-sm text-[#CBD5E1]/70 mt-1">
              {c.status === 'draft' &&
                'Our team is tailoring the Master Services Agreement & IP transfer clauses. You will be notified once ready.'}
              {c.status === 'sent' &&
                'Please review the clauses below and complete the digital execution using the sign dialog.'}
              {c.status === 'signed' &&
                `Executed on ${c.signed_at ? new Date(c.signed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'} IST. IP transfer is conditional on full fee settlement.`}
              {c.status === 'declined' &&
                'This contract was declined. Reach out to discuss revisions.'}
            </p>

            <div className="mt-4 flex gap-3">
              <a
                href={`/api/contracts/${c.id}/document`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-white bg-[#0B1F3A] border border-[#CBD5E1]/30 px-3 py-1.5 rounded-lg hover:bg-[#142E54] hover:border-[#CBD5E1]/60 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#CBD5E1]" /> View Printable Legal Document
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* Digital Execution Area (if awaiting signature) */}
      {c.status === 'sent' && (
        <DigitalSigningModal contractId={c.id} defaultSignerName={defaultSigner} />
      )}

      {/* Cryptographic Hashes (Section 65B Certificate Data) */}
      {(c.document_hash || c.signed_document_hash) && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-[#CBD5E1]" />
            <h2 className="text-sm font-semibold text-white">
              Cryptographic Integrity Hashes (Sec 65B Indian Evidence Act)
            </h2>
          </div>
          <div className="space-y-2 text-xs font-mono">
            {c.document_hash && (
              <div className="p-2.5 rounded-lg bg-[#121824] border border-[#404040]/50 break-all">
                <span className="text-[#CBD5E1]/70 block font-sans text-[11px] mb-0.5">Pre-Signature SHA-256 Hash:</span>
                <span className="text-[#CBD5E1]">{c.document_hash}</span>
              </div>
            )}
            {c.signed_document_hash && (
              <div className="p-2.5 rounded-lg bg-[#121824] border border-[#404040]/50 break-all">
                <span className="text-[#CBD5E1]/70 block font-sans text-[11px] mb-0.5">Executed Document SHA-256 Hash:</span>
                <span className="text-white font-semibold">{c.signed_document_hash}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Immutable Audit Log Trail */}
      <Card>
        <h2 className="text-sm font-semibold text-white mb-3">
          Chain of Custody & Audit Trail ({logs.length} Events)
        </h2>
        {logs.length === 0 ? (
          <p className="text-xs text-[#CBD5E1]/70">
            No audit events logged yet. Events will appear when viewed, downloaded, or executed.
          </p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 rounded-lg bg-[#080C14] border border-[#404040] text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white uppercase text-[11px] bg-[#0B1F3A] border border-[#CBD5E1]/30 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                    <span className="text-white font-medium">{log.signer_name}</span>
                    <span className="text-[#CBD5E1]/70">({log.signer_email})</span>
                  </div>
                  <p className="text-[11px] text-[#CBD5E1]/60 mt-1">
                    IP: {log.ip_address} · Method: {log.verification_method}
                  </p>
                </div>
                <span className="text-[11px] text-[#CBD5E1]/60 whitespace-nowrap ml-4">
                  {new Date(log.timestamp_utc).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
