import Link from 'next/link'
import { query } from '@/lib/db'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Mail, CheckCircle2, XCircle, PlusCircle } from 'lucide-react'

export const metadata = { title: 'Client Accounts | DevTeam Console' }

export default async function TeamClientsPage() {
  const { rows: clients } = await query<{
    id: string
    email: string
    email_verified_at: string | null
    created_at: string
    total_requests: string
    total_contracts: string
  }>(`
    SELECT
      u.id,
      u.email,
      u.email_verified_at,
      u.created_at,
      COUNT(DISTINCT r.id)::text as total_requests,
      COUNT(DISTINCT c.id)::text as total_contracts
    FROM public.zolexora_auth_users u
    LEFT JOIN public.app_requests r ON u.id = r.user_id
    LEFT JOIN public.contracts c ON u.id = c.user_id
    GROUP BY u.id, u.email, u.email_verified_at, u.created_at
    ORDER BY u.created_at DESC
  `)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Client Accounts Roster
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            All registered users across Zolexora App Suite and their associated activity.
          </p>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg">
          Total: <span className="font-semibold text-white">{clients.length}</span> clients
        </div>
      </div>

      {clients.length === 0 ? (
        <Card className="p-12 text-center text-sm text-[var(--color-text-muted)]">
          <Users className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          No client accounts found.
        </Card>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-5 py-3">Client Email</th>
                  <th className="px-5 py-3">Email Verification</th>
                  <th className="px-5 py-3">Total Requests</th>
                  <th className="px-5 py-3">Contracts</th>
                  <th className="px-5 py-3">Registered Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-white">
                      {c.email}
                    </td>
                    <td className="px-5 py-4">
                      {c.email_verified_at ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Pending OTP
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-zinc-300 font-semibold">
                      {c.total_requests}
                    </td>
                    <td className="px-5 py-4 text-zinc-300 font-semibold">
                      {c.total_contracts}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-muted)]">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/contracts/new?userId=${c.id}`}
                        className="inline-flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-2.5 py-1 rounded transition-colors text-[11px]"
                      >
                        <PlusCircle className="w-3 h-3" /> Contract
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
