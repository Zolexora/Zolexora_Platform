import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, RefreshCw, AlertCircle, Crown } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface Member {
  id: string;
  organisation_id: string;
  user_id: string;
  status: string;
  is_creator: boolean;
  is_commander: boolean;
  created_at: string;
  email?: string;
}

interface OrgWithMembers {
  id: string;
  name: string;
  status: string;
  members: Member[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function MembersPage() {
  const { data: orgs = [], isLoading, error, refetch } = useQuery<OrgWithMembers[]>({
    queryKey: ['admin-orgs-members'],
    queryFn: () => apiClient<OrgWithMembers[]>('/api/v1/admin/organisations?include_members=true'),
    retry: false,
  });

  const totalMembers = orgs.reduce((acc, o) => acc + (o.members?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Member Overview</h1>
          <p className="mt-0.5 text-sm text-silver-500">View members across all tenant organisations.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-silver-800 bg-brand-near px-3 py-1 text-xs font-medium text-silver-400">
            {totalMembers} total members
          </span>
          <button onClick={() => refetch()} className="flex items-center gap-2 rounded-xl border border-silver-800 bg-brand-near px-3 py-2 text-xs font-medium text-silver-300 hover:bg-silver-900 transition">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-silver-800 bg-silver-900/30 px-4 py-3 text-sm text-silver-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-silver-500" />
          {(error as Error).message}. Make sure your account has Platform Admin privileges.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-silver-500 text-sm">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : orgs.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-silver-600">
          <Users className="mb-3 h-8 w-8" />
          <p className="text-sm">No organisations found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map(org => (
            <div key={org.id} className="overflow-hidden rounded-2xl border border-silver-900/60 bg-brand-near/40">
              {/* Org header */}
              <div className="flex items-center justify-between border-b border-silver-900/40 bg-brand-near/60 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900/60 border border-navy-800/40 text-xs font-bold text-silver-300">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">{org.name}</span>
                    <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      org.status === 'ACTIVE' ? 'border-silver-700/40 text-silver-400' : 'border-silver-800/40 text-silver-600'
                    }`}>{org.status}</span>
                  </div>
                </div>
                <span className="text-xs text-silver-600">{org.members?.length ?? 0} member{(org.members?.length ?? 0) !== 1 ? 's' : ''}</span>
              </div>

              {/* Members list */}
              {!org.members?.length ? (
                <p className="px-5 py-4 text-xs text-silver-600">No members found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-silver-900/30">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-700">User ID</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-700">Role</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-700">Status</th>
                      <th className="hidden px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-silver-700 md:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silver-900/30">
                    {org.members.map(m => (
                      <tr key={m.id} className="hover:bg-silver-900/10 transition">
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs text-silver-400">{m.user_id.slice(0, 12)}…</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {m.is_commander && <Crown className="h-3 w-3 text-silver-300" />}
                            <span className="text-xs text-silver-300">
                              {m.is_commander ? 'Commander' : m.is_creator ? 'Creator' : 'Member'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium ${m.status === 'ACTIVE' ? 'text-silver-200' : 'text-silver-600'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 md:table-cell">
                          <div className="flex items-center gap-1.5 text-xs text-silver-600">
                            <Calendar className="h-3 w-3" />
                            {formatDate(m.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
