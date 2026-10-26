import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, contractStatusColor } from '@/components/ui/badge'
import {
  CONTRACT_STATUS_LABELS,
  type Contract,
} from '@/lib/types'
import { FileCheck, PlusCircle } from 'lucide-react'

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
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Legal Contracts &amp; Execution Pipeline
          </h1>
          <p className="text-sm text-[#CBD5E1]/70 mt-1">
            Indian IT Act 2000 Section 10A &amp; Evidence Act Section 65B compliant agreements.
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 bg-[#0B1F3A] hover:bg-[#142E54] text-white border border-[#CBD5E1]/40 font-semibold text-xs px-4 py-2 rounded-lg transition-colors shrink-0 shadow-xs"
        >
          <PlusCircle className="w-4 h-4 text-[#CBD5E1]" /> Create &amp; Dispatch Contract
        </Link>
      </div>

      {/* List */}
      {contracts.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[#CBD5E1]/60 bg-[#0A0A0A] border border-[#404040]">
          <FileCheck className="w-8 h-8 text-[#CBD5E1]/40 mx-auto mb-3" />
          No contracts have been generated yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="block rounded-xl border border-[#404040] bg-[#0A0A0A] p-5 hover:border-[#CBD5E1]/40 hover:bg-[#121824] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-base text-white group-hover:text-[#CBD5E1] transition-colors truncate">
                      {c.title}
                    </p>
                    <Badge color={contractStatusColor[c.status]}>
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </Badge>
                  </div>

                  <p className="text-xs text-[#CBD5E1]/70 mt-1 truncate">
                    Client: <span className="text-white font-mono">{c.user_email}</span>
                    {c.request_title && (
                      <>
                        {' '}• Request: <span className="text-[#CBD5E1]">{c.request_title}</span>
                      </>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#CBD5E1]/60">
                    <span className="bg-[#080C14] border border-[#404040] px-2 py-0.5 rounded text-[11px] font-mono text-[#CBD5E1]">
                      {c.contract_type}
                    </span>
                    <span>
                      Value:{' '}
                      <strong className="text-white">
                        {c.total_value_inr
                          ? `₹${Number(c.total_value_inr).toLocaleString('en-IN')}`
                          : '₹0'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Mode: <strong className="text-[#CBD5E1]">{c.signing_mode}</strong></span>
                    <span>•</span>
                    <span>
                      {c.signed_at
                        ? `Signed on ${new Date(c.signed_at).toLocaleDateString('en-IN')}`
                        : `Dispatched on ${new Date(c.created_at).toLocaleDateString('en-IN')}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-[#CBD5E1] font-medium shrink-0 self-center">
                  <span>View Legal File</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
