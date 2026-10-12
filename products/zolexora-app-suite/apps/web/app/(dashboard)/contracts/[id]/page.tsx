import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge, contractStatusColor } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CONTRACT_STATUS_LABELS, type Contract } from '@/lib/types'
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileEdit,
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!contract) notFound()

  const c = contract as Contract
  const StatusIcon = statusIcons[c.status]

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/contracts"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[var(--color-brand-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              {c.title}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Created{' '}
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

      {/* Status Card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center shrink-0">
            <StatusIcon className="w-5 h-5 text-[var(--color-brand-primary)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">
              {c.status === 'draft' && 'Contract is being prepared'}
              {c.status === 'sent' && 'Contract sent — awaiting your signature'}
              {c.status === 'signed' && 'Contract signed — project is active'}
              {c.status === 'declined' && 'Contract was declined'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {c.status === 'draft' &&
                'Our team is finalising the contract terms. You will receive a notification when it is ready for your review.'}
              {c.status === 'sent' &&
                'Please review and sign the contract using the link below. If you have questions, contact your project manager.'}
              {c.status === 'signed' &&
                `Contract was signed on ${c.signed_at ? new Date(c.signed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Development is now underway.`}
              {c.status === 'declined' &&
                'This contract was declined. Please reach out to our team to discuss revisions.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Details */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Contract Information
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>
              <span className="text-[var(--color-text-primary)] font-medium">
                Date Created:
              </span>{' '}
              {new Date(c.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          {c.signed_at && (
            <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
              <span>
                <span className="text-[var(--color-text-primary)] font-medium">
                  Date Signed:
                </span>{' '}
                {new Date(c.signed_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Document Link */}
      {c.document_url && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Contract Document
          </h2>
          <a
            href={c.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-2.5 text-sm font-medium text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/20 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {c.status === 'sent' ? 'Review & Sign Contract' : 'View Contract Document'}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Opens in a new tab. Contact us if you have trouble accessing the document.
          </p>
        </Card>
      )}
    </div>
  )
}
