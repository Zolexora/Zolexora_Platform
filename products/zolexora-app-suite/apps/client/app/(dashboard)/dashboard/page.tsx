import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge, requestStatusColor, contractStatusColor } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import {
  REQUEST_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  type AppRequest,
  type Contract,
} from '@/lib/types'
import { PlusCircle, ArrowRight, FileText, FolderOpen } from 'lucide-react'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const userId = user?.id

  const [{ rows: requests }, { rows: contracts }] = await Promise.all([
    userId
      ? query<AppRequest>(
          'SELECT * FROM public.app_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
          [userId]
        )
      : Promise.resolve({ rows: [] as AppRequest[] }),
    userId
      ? query<Contract>(
          'SELECT * FROM public.contracts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3',
          [userId]
        )
      : Promise.resolve({ rows: [] as Contract[] }),
  ])


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            App Suite Workspace 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Here&apos;s an overview of your projects and contracts.
          </p>
        </div>
        <LinkButton href="/dashboard/new-request" className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4" /> New Request
        </LinkButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Requests',
            value: requests?.length ?? 0,
            icon: FolderOpen,
          },
          {
            label: 'In Development',
            value:
              requests?.filter((r: AppRequest) => r.status === 'in_development')
                .length ?? 0,
            icon: ArrowRight,
          },
          {
            label: 'Delivered',
            value:
              requests?.filter((r: AppRequest) => r.status === 'delivered')
                .length ?? 0,
            icon: ArrowRight,
          },
          {
            label: 'Active Contracts',
            value:
              contracts?.filter(
                (c: Contract) => c.status === 'sent' || c.status === 'signed'
              ).length ?? 0,
            icon: FileText,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
            <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Recent Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Recent Requests
          </h2>
          <Link
            href="/dashboard/requests"
            className="text-sm text-[var(--color-brand-primary)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!requests || requests.length === 0 ? (
          <Card className="text-center py-12">
            <FolderOpen className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No requests yet.{' '}
              <Link
                href="/dashboard/new-request"
                className="text-[var(--color-brand-primary)] hover:underline"
              >
                Submit your first one
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req: AppRequest) => (
              <Link
                key={req.id}
                href={`/dashboard/requests/${req.id}`}
                className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand-primary)] transition-colors">
                      {req.title}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {req.category ?? 'Uncategorized'} ·{' '}
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
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

      {/* Contracts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Recent Contracts
          </h2>
          <Link
            href="/dashboard/contracts"
            className="text-sm text-[var(--color-brand-primary)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!contracts || contracts.length === 0 ? (
          <Card className="text-center py-10">
            <FileText className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No contracts yet. Contracts are generated after your request is reviewed.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {contracts.map((contract: Contract) => (
              <Link
                key={contract.id}
                href={`/dashboard/contracts/${contract.id}`}
                className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4 hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-brand-primary)] transition-colors">
                    {contract.title}
                  </p>
                  <Badge color={contractStatusColor[contract.status]}>
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
