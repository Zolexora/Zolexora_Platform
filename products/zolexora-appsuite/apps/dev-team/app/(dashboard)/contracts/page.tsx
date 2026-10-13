import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, contractStatusColor } from '@/components/ui/badge'
import {
  CONTRACT_STATUS_LABELS,
  type Contract,
} from '@/lib/types'
import { FileCheck, PlusCircle, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata = { title: 'Contracts & Legal | DevTeam Console' }

export default async function TeamContractsPage() {
  const { rows: contracts } = await query<Contract & { user_email: string; request_title?: string }>(
    `SELECT c.*, u.email as user_email, r.title as request_title
     FROM public.contracts c
     JOIN public.zolexora_auth_users u ON c.user_id = u.id
     LEFT JOIN public.app_requests r ON c.request_id = r.id
     ORDER BY c.created_at DESC`
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Legal Contracts &amp; Execution Pipeline
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Indian IT Act 2000 Section 10A &amp; Evidence Act Section 65B compliant agreements.
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 bg-[var(--color-brand-primary)] text-black font-semibold text-xs px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Create &amp; Dispatch Contract
        </Link>
      </div>

      {/* List */}
      {contracts.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-text-muted)]">
          <FileCheck className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          No contracts have been generated yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-base text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                      {c.title}
                    </p>
                    <Badge color={contractStatusColor[c.status]}>
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </Badge>
                  </div>

                  <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                    Client: <span className="text-zinc-200 font-mono">{c.user_email}</span>
                    {c.request_title && (
                      <>
                        {' '}• Request: <span className="text-zinc-300">{c.request_title}</span>
                      </>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-300">
                      {c.contract_type}
                    </span>
                    <span>
                      Value:{' '}
                      <strong className="text-zinc-200">
                        {c.total_value_inr
                          ? `₹${Number(c.total_value_inr).toLocaleString('en-IN')}`
                          : '₹0'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Mode: <strong className="text-zinc-300">{c.signing_mode}</strong></span>
                    <span>•</span>
                    <span>
                      {c.signed_at
                        ? `Signed on ${new Date(c.signed_at).toLocaleDateString('en-IN')}`
                        : `Dispatched on ${new Date(c.created_at).toLocaleDateString('en-IN')}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-[var(--color-brand-primary)] font-medium shrink-0 self-center">
                  <span>View Legal File</span>
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
